import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { maskCpf } from "../utils/cpf.js";
import { buildTicketNumber } from "../utils/ticketNumber.js";
import { nextTicketSeq, nextOsSeq } from "../utils/nextSequence.js";
import { STATUS, canTransition, allowedNext, canReopen } from "../utils/ticketStateMachine.js";
import { IMG_PREFIX, saveImageFromDataUrl, resolveImagePath, mimeForFilename, deleteTicketImages } from "../utils/messageImages.js";
import { sendPushToUser, buildStatusPush } from "./pushController.js";

const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const createTicketSchema = z.object({
  departmentId:         z.number().int().positive().optional().nullable(),
  categoryId:           z.number().int().positive(),
  subcategoryId:        z.number().int().positive().optional().nullable(),
  freeTextDescription:  z.string().max(2000).optional().nullable(),
  anyDeskCode:          z.string().max(20).optional().nullable(),
  extraData:            z.record(z.unknown()).optional().nullable(),
  // Chamado aberto em nome de outra pessoa (todos opcionais)
  beneficiaryName:      z.string().min(2).max(191).optional().nullable(),
  beneficiaryMatricula: z.string().max(191).optional().nullable(),
  beneficiaryEmail:     z.string().email().max(191).optional().nullable(),
  beneficiaryDept:      z.string().max(191).optional().nullable(),
});

export async function createTicket(req, res) {
  const parsed = createTicketSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });
  }
  const data = parsed.data;

  const requester = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!requester || !requester.active) {
    return res.status(401).json({ error: "Usuário não encontrado" });
  }

  const deptId = data.departmentId || requester.departmentId;
  if (!deptId) return res.status(400).json({ error: "Selecione um setor" });

  const dept = await prisma.department.findUnique({ where: { id: deptId } });
  if (!dept || !dept.active) {
    return res.status(400).json({ error: "Setor inválido ou inativo" });
  }

  const category = await prisma.category.findUnique({
    where: { id: data.categoryId },
    include: { subcategories: true },
  });
  if (!category) return res.status(400).json({ error: "Categoria inexistente" });

  const isRemote    = category.code === "REMOTE";
  const selectedSub = (!isRemote && data.subcategoryId)
    ? category.subcategories.find((s) => s.id === data.subcategoryId)
    : null;
  const isOutro = selectedSub?.name === "Outro";

  if (isRemote) {
    if (!data.anyDeskCode || data.anyDeskCode.trim().length < 3) {
      return res.status(400).json({ error: "Informe o código do AnyDesk (mínimo 3 caracteres)" });
    }
  } else if (category.allowsFreeText) {
    if (!data.freeTextDescription || data.freeTextDescription.trim().length < 5) {
      return res.status(400).json({ error: "Descreva o problema (mínimo 5 caracteres)" });
    }
  } else {
    if (!data.subcategoryId) {
      return res.status(400).json({ error: "Subcategoria é obrigatória" });
    }
    if (!selectedSub) return res.status(400).json({ error: "Subcategoria inválida para essa categoria" });
    if (isOutro && (!data.freeTextDescription || data.freeTextDescription.trim().length < 5)) {
      return res.status(400).json({ error: "Descreva o problema (mínimo 5 caracteres)" });
    }
  }

  // ── Flags da subcategoria ────────────────────────────────────────────────
  const requiresApproval      = selectedSub?.requiresApproval      ?? false;
  const dualApproval          = selectedSub?.dualApproval           ?? false;
  const requiresPresential    = isRemote ? false : (selectedSub?.requiresPresential    ?? true);
  const requiresCauseSolution = isRemote ? true  : (selectedSub?.requiresCauseSolution ?? true);
  // Subcategoria com OS vinculada → fluxo de Solicitação de Evento (aprovação dupla: setor + GTI)
  const isEvento = !!(selectedSub?.linkedOsTypeId);

  // Para aprovação dupla padrão (ex: remanejamento de setor), o targetDeptId vem em extraData
  const extraData   = data.extraData ?? null;
  const targetDeptId = (dualApproval && !isEvento && extraData?.targetDeptId)
    ? Number(extraData.targetDeptId)
    : null;

  // Valida setor alvo para aprovação dupla padrão
  if (dualApproval && !isEvento && !targetDeptId) {
    return res.status(400).json({ error: "Selecione o setor de destino para a realocação" });
  }
  if (targetDeptId) {
    const targetDept = await prisma.department.findUnique({ where: { id: targetDeptId } });
    if (!targetDept || !targetDept.active) {
      return res.status(400).json({ error: "Setor de destino inválido ou inativo" });
    }
  }

  // ── Monta registros de aprovação ────────────────────────────────────────
  const approvalDeptId = (dualApproval && !isEvento && targetDeptId) ? targetDeptId : deptId;
  // Evento: sem auto-aprovação (requer deliberação explícita do setor + GTI)
  const selfApproval = requiresApproval && !isEvento
    && (req.user.role === "CHEFE_SETOR" || req.user.role === "ADMIN")
    && req.user.departmentId === approvalDeptId;

  let approvalRecords = [];
  if (isEvento && requiresApproval) {
    // Solicitação de Evento: chefe do setor solicitante + chefe da GTI
    approvalRecords = [
      { chefDeptId: deptId, isGtiApproval: false },
      { chefDeptId: null,   isGtiApproval: true  },
    ];
  } else if (requiresApproval && !selfApproval) {
    approvalRecords = [{ chefDeptId: approvalDeptId, isGtiApproval: false }];
  }

  // SLA: subcategoria tem precedência; REMOTE sempre usa categoria; fallback para categoria
  const effectiveSlaHours = isRemote
    ? category.slaHours
    : (selectedSub?.slaHours ?? category.slaHours);
  const slaDeadline = effectiveSlaHours
    ? new Date(Date.now() + effectiveSlaHours * 60 * 60 * 1000)
    : null;

  const ticketPayload = {
    requesterName:       requester.name,
    requesterCpf:        requester.cpf,
    requesterMatricula:   requester.matricula || null,
    requesterEmail:       requester.email     || null,
    beneficiaryName:      data.beneficiaryName      || null,
    beneficiaryMatricula: data.beneficiaryMatricula || null,
    beneficiaryEmail:     data.beneficiaryEmail     || null,
    beneficiaryDept:      data.beneficiaryDept      || null,
    department:           dept.name,
    departmentId:        dept.id,
    priority:            (selectedSub?.defaultPriority ?? category.defaultPriority ?? "MEDIUM"),
    nucleoResponsavel:   selectedSub?.nucleoResponsavel ?? null,
    slaDeadline,
    categoryId:          data.categoryId,
    subcategoryId:       (!isRemote && !category.allowsFreeText) ? data.subcategoryId : null,
    freeTextDescription: isRemote
      ? (data.freeTextDescription?.trim() || null)
      : (!isRemote && (category.allowsFreeText || isOutro))
        ? data.freeTextDescription.trim()
        : (data.freeTextDescription?.trim() || null),
    anyDeskCode:    isRemote ? data.anyDeskCode.trim() : null,
    extraData,
    presential:            requiresPresential,
    requiresCauseSolution: requiresCauseSolution,
    approvalStatus: requiresApproval ? (selfApproval ? "APPROVED" : "PENDING") : "NOT_REQUIRED",
    openedById:     req.user?.id ?? null,
    status:         STATUS.OPEN,
    history: { create: { toStatus: STATUS.OPEN } },
    ...(approvalRecords.length > 0 && {
      approvals: { create: approvalRecords },
    }),
  };

  const seq          = await nextTicketSeq();
  const ticketNumber = buildTicketNumber(seq);
  const ticket       = await prisma.ticket.create({ data: { ticketNumber, ...ticketPayload } });

  const io = req.app.get("io");
  io?.emit("ticket:created", {
    ticketNumber:      ticket.ticketNumber,
    department:        ticket.department,
    category:          category.name,
    subcategory:       selectedSub?.name ?? null,
    nucleoResponsavel: ticket.nucleoResponsavel ?? null,
    fromUserId:        req.user?.id ?? null,
  });

  if (requiresApproval && !selfApproval) {
    io?.emit("ticket:approval-needed", {
      ticketNumber: ticket.ticketNumber,
      department:   ticket.department,
      departmentId: ticket.departmentId,
      category:     category.name,
      subcategory:  selectedSub?.name ?? null,
    });
    if (isEvento) {
      io?.emit("ticket:gti-approval-needed", {
        ticketNumber: ticket.ticketNumber,
        department:   ticket.department,
        category:     category.name,
        subcategory:  selectedSub?.name ?? null,
      });
    }
  }

  res.status(201).json({
    ticketNumber: ticket.ticketNumber,
    openedAt:     ticket.openedAt,
    approvalStatus: ticket.approvalStatus,
  });
}

// ── GET público ──────────────────────────────────────────────────────────────
export async function getTicketPublic(req, res) {
  const { ticketNumber } = req.params;
  const ticket = await prisma.ticket.findUnique({
    where: { ticketNumber },
    include: {
      category:     true,
      subcategory:  true,
      unit:         true,
      assignedTech: { select: { name: true } },
      feedback:     true,
      approvals: {
        where:  { status: "REJECTED" },
        select: { note: true, decidedAt: true },
        take:   1,
      },
    },
  });
  if (!ticket) return res.status(404).json({ error: "Chamado não encontrado" });

  res.json({
    ticketNumber:        ticket.ticketNumber,
    status:              ticket.status,
    approvalStatus:      ticket.approvalStatus,
    approvalNote:        ticket.approvals?.[0]?.note || null,
    approvalDecidedAt:   ticket.approvals?.[0]?.decidedAt || null,
    requesterName:       ticket.requesterName,
    beneficiaryName:     ticket.beneficiaryName || null,
    department:          ticket.department,
    category:            ticket.category?.name,
    subcategory:         ticket.subcategory?.name,
    subcategoryCode:     ticket.subcategory?.code ?? null,
    freeTextDescription: ticket.freeTextDescription,
    anyDeskCode:         ticket.anyDeskCode || null,
    isRemote:            !!(ticket.anyDeskCode),
    presential:          ticket.presential,
    completionNote:      ticket.completionNote || null,
    cancelNote:          ticket.cancelNotePublic ? (ticket.cancelNote || null) : null,
    unit:                ticket.unit?.name || null,
    technician:          ticket.assignedTech?.name || null,
    openedAt:            ticket.openedAt,
    viewedAt:            ticket.viewedAt,
    enRouteAt:           ticket.enRouteAt,
    inServiceAt:         ticket.inServiceAt,
    completedAt:         ticket.completedAt,
    priority:            ticket.priority,
    slaDeadline:         ticket.slaDeadline,
    hasFeedback:         !!ticket.feedback,
  });
}

// ── LIST ─────────────────────────────────────────────────────────────────────
export async function listTickets(req, res) {
  const { status, unitId, technicianId, from, to, categoryId, cursor, limit, search, pendingForDept, department, pendingGti } = req.query;

  // Retorno antecipado para Chefe da GTI buscando aprovações de eventos pendentes
  if (pendingGti === "true") {
    const gtiUser = await prisma.user.findUnique({ where: { id: req.user.id }, select: { isGtiChief: true } });
    if (!gtiUser?.isGtiChief) return res.json({ tickets: [], nextCursor: null });
    const gtiTickets = await prisma.ticket.findMany({
      where: {
        approvalStatus: "PENDING",
        approvals: { some: { isGtiApproval: true, status: "PENDING" } },
      },
      include: {
        category:    true,
        subcategory: true,
        unit:        { select: { id: true, name: true } },
        assignedTech: { select: { id: true, name: true } },
        approvals: {
          include: {
            chefDept: { select: { id: true, name: true } },
            chefUser: { select: { name: true } },
          },
        },
      },
      orderBy: { openedAt: "asc" },
      take: Math.min(Number(limit) || 100, 100),
    });
    return res.json({ tickets: gtiTickets.map(formatTicket), nextCursor: null });
  }

  const where = {};

  if (status)       where.status      = status;
  if (unitId)       where.unitId      = Number(unitId);
  if (technicianId) where.assignedTechId = Number(technicianId);
  if (categoryId)   where.categoryId  = Number(categoryId);
  if (department)   where.department  = department;
  if (from || to) {
    where.openedAt = {};
    if (from) where.openedAt.gte = new Date(from);
    if (to)   where.openedAt.lte = new Date(to);
  }
  // Busca e filtro de role geram ORs independentes — combinados via AND no final
  const andClauses = [];
  if (search) {
    const q = search.trim();
    andClauses.push({
      OR: [
        { ticketNumber:        { contains: q } },
        { requesterName:       { contains: q } },
        { freeTextDescription: { contains: q } },
        { department:          { contains: q } },
      ],
    });
  }

  // ── Filtros por role ────────────────────────────────────────────────────
  if (req.user.role === "CHEFE_SETOR") {
    // Chefe vê apenas chamados PENDENTES da aprovação do seu setor
    const chefeUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { departmentId: true },
    });
    if (!chefeUser?.departmentId) return res.json({ tickets: [], nextCursor: null });

    where.approvalStatus = "PENDING";
    where.approvals = {
      some: { chefDeptId: chefeUser.departmentId, status: "PENDING" },
    };
  } else if (req.user.role === "ADMIN") {
    // Filtro especial: admin visualizando aprovações pendentes do seu setor
    if (pendingForDept) {
      where.approvalStatus = "PENDING";
      where.approvals = { some: { chefDeptId: Number(pendingForDept), status: "PENDING" } };
    }
    // ADMIN sem pendingForDept vê tudo (sem filtro adicional)
  } else if (req.user.role === "TECHNICIAN") {
    const techUser = await prisma.user.findUnique({ where: { id: req.user.id }, select: { unitId: true, nucleoResponsavel: true, isGtiChief: true } });
    // Técnico padrão não vê chamados aguardando aprovação; Chefe da GTI pode ver os de evento
    if (!techUser?.isGtiChief) {
      where.approvalStatus = { not: "PENDING" };
    }
    const orConditions = [
      { assignedTechId: req.user.id },
      { unitId: techUser?.unitId || -1 },
      // Cancelados por rejeição do chefe não têm atribuição — visíveis para todos os técnicos
      { status: STATUS.CANCELADO },
    ];
    if (techUser?.nucleoResponsavel) {
      orConditions.push({ nucleoResponsavel: techUser.nucleoResponsavel });
    }
    if (techUser?.isGtiChief) {
      // Chefe da GTI também vê tickets de evento aguardando sua aprovação
      orConditions.push({ approvals: { some: { isGtiApproval: true } } });
    }
    andClauses.push({ OR: orConditions });
  } else if (req.user.role === "USER") {
    where.openedById = req.user.id;
  }
  // ADMIN vê tudo (sem filtro adicional)

  if (andClauses.length > 0) where.AND = andClauses;

  const take        = Math.min(Number(limit) || 200, 200);
  const cursorClause = cursor ? { cursor: { id: Number(cursor) }, skip: 1 } : {};

  const rows = await prisma.ticket.findMany({
    where,
    select: {
      id:                    true,
      ticketNumber:          true,
      requesterName:         true,
      requesterCpf:          true,
      requesterMatricula:    true,
      requesterEmail:        true,
      beneficiaryName:       true,
      beneficiaryMatricula:  true,
      beneficiaryEmail:      true,
      beneficiaryDept:       true,
      department:            true,
      freeTextDescription:   true,
      extraData:             true,
      anyDeskCode:           true,
      priority:              true,
      nucleoResponsavel:     true,
      presential:            true,
      requiresCauseSolution: true,
      approvalStatus:        true,
      status:                true,
      slaDeadline:           true,
      openedAt:              true,
      viewedAt:              true,
      enRouteAt:             true,
      inServiceAt:           true,
      completedAt:           true,
      category:    { select: { id: true, name: true } },
      subcategory: { select: { id: true, name: true, code: true } },
      unit:        { select: { id: true, name: true } },
      assignedTech: { select: { id: true, name: true } },
      approvals: {
        select: {
          id: true, chefDeptId: true, isGtiApproval: true, status: true, note: true, decidedAt: true,
          chefDept: { select: { name: true } },
          chefUser: { select: { name: true } },
        },
      },
    },
    orderBy: { openedAt: "asc" },
    take:    take + 1,
    ...cursorClause,
  });

  const hasMore   = rows.length > take;
  const tickets   = hasMore ? rows.slice(0, take) : rows;
  const nextCursor = hasMore ? tickets[tickets.length - 1].id : null;

  res.json({ tickets: tickets.map(formatTicket), nextCursor });
}

// ── DETAIL ────────────────────────────────────────────────────────────────────
export async function getTicket(req, res) {
  const id = Number(req.params.id);
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      category:    true,
      subcategory: true,
      unit:        true,
      assignedTech: { select: { id: true, name: true } },
      history: {
        include: { actor: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      feedback: true,
      comments: {
        include: { author: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
      approvals: {
        include: {
          chefDept: { select: { id: true, name: true } },
          chefUser: { select: { name: true } },
        },
      },
    },
  });
  if (!ticket) return res.status(404).json({ error: "Chamado não encontrado" });
  res.json({
    ...formatTicket(ticket),
    anyDeskCode:  ticket.anyDeskCode || null,
    isRemote:     !!(ticket.anyDeskCode),
    cause:        ticket.cause,
    solution:     ticket.solution,
    history:      ticket.history,
    comments:     ticket.comments,
    allowedNext:  allowedNext(ticket.status),
    feedback:     ticket.feedback,
  });
}

// ── APPROVE / REJECT (Chefe de Setor, Admin, ou Chefe da GTI) ────────────────
export async function approveTicket(req, res) {
  const id = Number(req.params.id);
  const { status, note } = req.body || {};

  if (!["APPROVED", "REJECTED"].includes(status)) {
    return res.status(400).json({ error: "Status inválido. Use APPROVED ou REJECTED." });
  }

  // Verifica permissão: CHEFE_SETOR, ADMIN ou Chefe da GTI
  const actorUser = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { role: true, departmentId: true, isGtiChief: true },
  });
  const canApprove = ["CHEFE_SETOR", "ADMIN"].includes(actorUser?.role) || actorUser?.isGtiChief;
  if (!canApprove) {
    return res.status(403).json({ error: "Sem permissão para aprovar chamados." });
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { approvals: true },
  });
  if (!ticket) return res.status(404).json({ error: "Chamado não encontrado" });
  if (ticket.approvalStatus !== "PENDING") {
    return res.status(400).json({ error: "Este chamado não está aguardando aprovação." });
  }

  // Determina qual registro de aprovação atualizar
  let targetApproval = null;

  if (actorUser.role === "ADMIN") {
    // Admin pode aprovar qualquer pendência
    targetApproval = ticket.approvals.find((a) => a.status === "PENDING");
  } else if (actorUser.isGtiChief) {
    // Chefe da GTI: aprova o registro de aprovação GTI
    targetApproval = ticket.approvals.find((a) => a.isGtiApproval && a.status === "PENDING");
  } else {
    // Chefe de Setor: busca o registro do seu departamento
    if (!actorUser.departmentId) {
      return res.status(403).json({ error: "Você não está associado a nenhum setor." });
    }
    targetApproval = ticket.approvals.find(
      (a) => !a.isGtiApproval && a.chefDeptId === actorUser.departmentId && a.status === "PENDING"
    );
  }

  if (!targetApproval) {
    return res.status(403).json({ error: "Você não tem uma aprovação pendente neste chamado." });
  }

  await prisma.ticketApproval.update({
    where: { id: targetApproval.id },
    data: {
      status,
      note:       note || null,
      decidedAt:  new Date(),
      chefUserId: req.user.id,
    },
  });

  // Recalcula o status geral de aprovação
  const allApprovals = await prisma.ticketApproval.findMany({ where: { ticketId: id } });
  let newApprovalStatus;
  if (allApprovals.some((a) => a.status === "REJECTED")) {
    newApprovalStatus = "REJECTED";
  } else if (allApprovals.every((a) => a.status === "APPROVED")) {
    newApprovalStatus = "APPROVED";
  } else {
    newApprovalStatus = "PENDING";
  }

  const ticketPatch = { approvalStatus: newApprovalStatus };

  if (newApprovalStatus === "REJECTED") {
    ticketPatch.status         = STATUS.CANCELADO;
    ticketPatch.completionNote = note?.trim() || "Recusado";
  }

  // Aprovação total em Solicitação de Evento → cria OS automaticamente
  const io = req.app.get("io");
  if (newApprovalStatus === "APPROVED" && ticket.subcategoryId) {
    const sub = await prisma.subcategory.findUnique({
      where: { id: ticket.subcategoryId },
      select: { linkedOsTypeId: true },
    });
    if (sub?.linkedOsTypeId) {
      const seq      = await nextOsSeq();
      const d        = new Date();
      const osNumber = `OS-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(seq).padStart(4, "0")}`;
      const preFill  = ticket.extraData?.osPreFill ?? {};
      await prisma.workOrder.create({
        data: {
          osNumber,
          tipoId:      sub.linkedOsTypeId,
          status:      "ABERTA",
          problema:    preFill.problema   || null,
          formData:    preFill.formData   || undefined,
          createdById: ticket.openedById  || req.user.id,
          tickets: { create: { ticketId: ticket.id } },
        },
      });
      io?.emit("work-order:created", { osNumber });
    }
  }

  await prisma.ticket.update({
    where: { id },
    data: {
      ...ticketPatch,
      ...(newApprovalStatus === "REJECTED" && {
        history: {
          create: {
            fromStatus:   ticket.status,
            toStatus:     STATUS.CANCELADO,
            actorId:      req.user.id,
            internalNote: ticketPatch.completionNote,
          },
        },
      }),
    },
  });

  io?.emit("ticket:approval", { ticketId: id, approvalStatus: newApprovalStatus });

  res.json({ ok: true, approvalStatus: newApprovalStatus });
}

// ── TRANSITION ────────────────────────────────────────────────────────────────
export async function transitionTicket(req, res) {
  const id = Number(req.params.id);
  const { toStatus, unitId, assignedTechId, internalNote, cause, solution, completionNote, nucleoResponsavel } = req.body || {};

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return res.status(404).json({ error: "Chamado não encontrado" });

  if (!canTransition(ticket.status, toStatus)) {
    return res.status(400).json({
      error: `Transição inválida: ${ticket.status} → ${toStatus}`,
    });
  }

  if (!["TECHNICIAN", "ADMIN"].includes(req.user.role)) {
    return res.status(403).json({ error: "Apenas técnicos e administradores podem alterar o status" });
  }

  if (req.user.role === "TECHNICIAN" && ticket.assignedTechId !== null && ticket.assignedTechId !== req.user.id) {
    return res.status(403).json({ error: "Este chamado está atribuído a outro técnico" });
  }

  // Bloqueia transição se aprovação ainda pendente ou rejeitada
  if (toStatus === STATUS.VIEWED) {
    if (ticket.approvalStatus === "PENDING") {
      return res.status(400).json({ error: "Este chamado aguarda aprovação do Chefe de Setor antes de ser atendido." });
    }
    if (ticket.approvalStatus === "REJECTED") {
      return res.status(400).json({ error: "Este chamado foi reprovado pelo Chefe de Setor e não pode ser atendido." });
    }
  }

  const updateData = { status: toStatus };
  const now = new Date();

  if (toStatus === STATUS.VIEWED) {
    updateData.viewedAt = now;
    if (!assignedTechId) {
      return res.status(400).json({ error: "Técnico é obrigatório ao visualizar" });
    }
    const tech = await prisma.user.findUnique({
      where: { id: Number(assignedTechId) },
      select: { unitId: true },
    });
    if (!tech) return res.status(400).json({ error: "Técnico inválido" });
    // Unidade explícita tem precedência; senão herda a do técnico
    updateData.unitId          = unitId ? Number(unitId) : tech.unitId;
    updateData.assignedTechId  = Number(assignedTechId);
    // auto-preenche ou sobrescreve o núcleo
    if (nucleoResponsavel !== undefined) {
      updateData.nucleoResponsavel = nucleoResponsavel || null;
    }
  }
  if (toStatus === STATUS.EN_ROUTE)   updateData.enRouteAt   = now;
  if (toStatus === STATUS.IN_SERVICE) updateData.inServiceAt = now;
  if (toStatus === STATUS.COMPLETED) {
    if (ticket.requiresCauseSolution && (!cause || !solution)) {
      return res.status(400).json({ error: "Causa e solução são obrigatórias para concluir" });
    }
    updateData.completedAt    = now;
    updateData.cause          = cause          || null;
    updateData.solution       = solution       || null;
    updateData.completionNote = completionNote || null;
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: {
      ...updateData,
      history: {
        create: {
          fromStatus:   ticket.status,
          toStatus,
          actorId:      req.user.id,
          internalNote: internalNote || null,
        },
      },
    },
  });

  req.app.get("io")?.emit("ticket:updated", {
    ticketId:     updated.id,
    ticketNumber: updated.ticketNumber,
    status:       updated.status,
    openedById:   ticket.openedById,
  });

  // Notificação push para o solicitante
  if (ticket.openedById) {
    sendPushToUser(ticket.openedById, buildStatusPush(ticket, toStatus)).catch(() => {});
  }

  res.json({ ok: true, status: updated.status });
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function deleteTicket(req, res) {
  const id = Number(req.params.id);
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return res.status(404).json({ error: "Chamado não encontrado" });
  await prisma.ticket.delete({ where: { id } });
  await deleteTicketImages(id);
  req.app.get("io")?.emit("ticket:deleted", { id });
  res.json({ ok: true });
}

// ── FEEDBACK ─────────────────────────────────────────────────────────────────
export async function submitFeedback(req, res) {
  if (process.env.FEEDBACK_ENABLED !== "true") {
    return res.status(404).json({ error: "Módulo de avaliação desativado" });
  }
  const { ticketNumber } = req.params;
  const { rating, comment } = req.body || {};
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) {
    return res.status(400).json({ error: "Avaliação deve ser entre 1 e 5" });
  }
  const ticket = await prisma.ticket.findUnique({ where: { ticketNumber } });
  if (!ticket) return res.status(404).json({ error: "Chamado não encontrado" });
  if (ticket.status !== STATUS.COMPLETED) {
    return res.status(400).json({ error: "Chamado ainda não foi concluído" });
  }
  const existing = await prisma.feedback.findUnique({ where: { ticketId: ticket.id } });
  if (existing) return res.status(400).json({ error: "Avaliação já enviada" });

  const fb = await prisma.feedback.create({
    data: { ticketId: ticket.id, rating: r, comment: comment || null },
  });
  res.status(201).json({ ok: true, id: fb.id });
}

// ── REOPEN ────────────────────────────────────────────────────────────────────
export async function reopenTicket(req, res) {
  const id = Number(req.params.id);
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return res.status(404).json({ error: "Chamado não encontrado" });
  if (!canReopen(ticket.status)) {
    return res.status(400).json({ error: "Apenas chamados concluídos podem ser reabertos" });
  }

  // Usuário comum só pode reabrir o próprio chamado
  if (req.user.role === "USER" && ticket.openedById !== req.user.id) {
    return res.status(403).json({ error: "Você não tem permissão para reabrir este chamado" });
  }

  const { reason } = req.body || {};

  await prisma.ticket.update({
    where: { id },
    data: {
      status:      STATUS.OPEN,
      completedAt: null,
      cause:       null,
      solution:    null,
      history: {
        create: {
          fromStatus:   STATUS.COMPLETED,
          toStatus:     STATUS.OPEN,
          actorId:      req.user.id,
          internalNote: reason ? `Reaberto: ${reason}` : "Chamado reaberto",
        },
      },
    },
  });

  req.app.get("io")?.emit("ticket:updated", { ticketNumber: ticket.ticketNumber, status: STATUS.OPEN });
  res.json({ ok: true });
}

// ── ASSIGN (transferir técnico/unidade sem mudar status) ──────────────────────
export async function assignTicket(req, res) {
  const id = Number(req.params.id);
  const { assignedTechId, unitId, nucleoResponsavel } = req.body || {};
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return res.status(404).json({ error: "Chamado não encontrado" });
  if (ticket.status === STATUS.OPEN || ticket.status === STATUS.COMPLETED) {
    return res.status(400).json({ error: "Chamado precisa estar em andamento para transferir" });
  }

  const patch = {};
  if (assignedTechId !== undefined)     patch.assignedTechId    = assignedTechId ? Number(assignedTechId) : null;
  if (unitId !== undefined)             patch.unitId            = unitId         ? Number(unitId)         : null;
  if (nucleoResponsavel !== undefined)  patch.nucleoResponsavel = nucleoResponsavel || null;

  const updated = await prisma.ticket.update({
    where: { id },
    data: {
      ...patch,
      history: {
        create: {
          fromStatus:   ticket.status,
          toStatus:     ticket.status,
          actorId:      req.user.id,
          internalNote: "Transferência de responsabilidade",
        },
      },
    },
    include: { assignedTech: { select: { id: true, name: true } }, unit: true },
  });

  req.app.get("io")?.emit("ticket:updated", { ticketNumber: updated.ticketNumber, status: updated.status });
  res.json({ ok: true, technician: updated.assignedTech, unit: updated.unit ? { id: updated.unit.id, name: updated.unit.name } : null });
}

// ── RECATEGORIZE ─────────────────────────────────────────────────────────────
export async function recategorizeTicket(req, res) {
  const id = Number(req.params.id);
  const { categoryId, subcategoryId } = req.body || {};

  if (!categoryId) return res.status(400).json({ error: "Categoria é obrigatória" });

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return res.status(404).json({ error: "Chamado não encontrado" });
  if (["COMPLETED", "CANCELADO"].includes(ticket.status)) {
    return res.status(400).json({ error: "Não é possível alterar a categoria de chamados concluídos ou cancelados" });
  }

  const category = await prisma.category.findUnique({
    where: { id: Number(categoryId) },
    include: { subcategories: true },
  });
  if (!category) return res.status(400).json({ error: "Categoria não encontrada" });

  const isRemote = category.code === "REMOTE";

  let selectedSub = null;
  if (subcategoryId) {
    selectedSub = category.subcategories.find((s) => s.id === Number(subcategoryId));
    if (!selectedSub) return res.status(400).json({ error: "Subcategoria inválida para essa categoria" });
  } else if (!category.allowsFreeText && !isRemote) {
    return res.status(400).json({ error: "Subcategoria é obrigatória para essa categoria" });
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: {
      categoryId:       Number(categoryId),
      subcategoryId:    selectedSub?.id ?? null,
      nucleoResponsavel: selectedSub?.nucleoResponsavel ?? ticket.nucleoResponsavel,
      history: {
        create: {
          fromStatus:   ticket.status,
          toStatus:     ticket.status,
          actorId:      req.user.id,
          internalNote: `Categoria alterada: ${category.name}${selectedSub ? ` › ${selectedSub.name}` : ""}`,
        },
      },
    },
    include: { category: true, subcategory: true },
  });

  req.app.get("io")?.emit("ticket:updated", { ticketNumber: updated.ticketNumber, status: updated.status });
  res.json({ category: updated.category, subcategory: updated.subcategory });
}

// ── COMMENTS ─────────────────────────────────────────────────────────────────
export async function listComments(req, res) {
  const id = Number(req.params.id);
  const ticket = await prisma.ticket.findUnique({ where: { id }, select: { id: true, openedById: true } });
  if (!ticket) return res.status(404).json({ error: "Chamado não encontrado" });

  // Usuário comum só vê comentários do próprio chamado
  if (req.user.role === "USER" && ticket.openedById !== req.user.id) {
    return res.status(403).json({ error: "Acesso negado" });
  }

  const comments = await prisma.ticketComment.findMany({
    where: { ticketId: id },
    include: { author: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(comments);
}

export async function addComment(req, res) {
  const id = Number(req.params.id);
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: "Comentário não pode ser vazio" });

  const ticket = await prisma.ticket.findUnique({ where: { id }, select: { id: true, openedById: true, status: true } });
  if (!ticket) return res.status(404).json({ error: "Chamado não encontrado" });

  // Usuário comum só comenta no próprio chamado e apenas se não estiver concluído
  if (req.user.role === "USER") {
    if (ticket.openedById !== req.user.id) return res.status(403).json({ error: "Acesso negado" });
    if (ticket.status === STATUS.COMPLETED) return res.status(400).json({ error: "Não é possível comentar em chamados concluídos" });
  }

  const comment = await prisma.ticketComment.create({
    data: { ticketId: id, authorId: req.user.id, text: text.trim() },
    include: { author: { select: { id: true, name: true, role: true } } },
  });

  req.app.get("io")?.emit("ticket:comment", { ticketId: id });
  res.status(201).json(comment);
}

// ── FEEDBACK (autenticado — por id do ticket) ─────────────────────────────────
export async function submitFeedbackAuth(req, res) {
  if (process.env.FEEDBACK_ENABLED !== "true") {
    return res.status(404).json({ error: "Módulo de avaliação desativado" });
  }
  const id = Number(req.params.id);
  const { rating, comment } = req.body || {};
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) {
    return res.status(400).json({ error: "Avaliação deve ser entre 1 e 5" });
  }

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return res.status(404).json({ error: "Chamado não encontrado" });
  if (ticket.openedById !== req.user.id) return res.status(403).json({ error: "Acesso negado" });
  if (ticket.status !== STATUS.COMPLETED) return res.status(400).json({ error: "Chamado ainda não foi concluído" });

  const existing = await prisma.feedback.findUnique({ where: { ticketId: id } });
  if (existing) return res.status(400).json({ error: "Avaliação já enviada" });

  const fb = await prisma.feedback.create({
    data: { ticketId: id, rating: r, comment: comment || null },
  });
  res.status(201).json({ ok: true, id: fb.id });
}

// ── Formato base de ticket para listagens ─────────────────────────────────────
function formatTicket(t) {
  return {
    id:                  t.id,
    ticketNumber:        t.ticketNumber,
    requesterName:        t.requesterName,
    requesterMatricula:   t.requesterMatricula   || null,
    requesterEmail:       t.requesterEmail       || null,
    beneficiaryName:      t.beneficiaryName      || null,
    beneficiaryMatricula: t.beneficiaryMatricula || null,
    beneficiaryEmail:     t.beneficiaryEmail     || null,
    beneficiaryDept:      t.beneficiaryDept      || null,
    department:           t.department,
    category:            t.category     ? { id: t.category.id,     name: t.category.name }     : null,
    subcategory:         t.subcategory  ? { id: t.subcategory.id,  name: t.subcategory.name, code: t.subcategory.code } : null,
    freeTextDescription: t.freeTextDescription,
    extraData:           t.extraData,
    anyDeskCode:         t.anyDeskCode || null,
    priority:            t.priority ?? "MEDIUM",
    nucleoResponsavel:   t.nucleoResponsavel ?? null,
    isRemote:             !!(t.anyDeskCode),
    presential:           t.presential,
    requiresCauseSolution: t.requiresCauseSolution,
    approvalStatus:       t.approvalStatus,
    approvals:           t.approvals?.map((a) => ({
      id:            a.id,
      chefDeptId:    a.chefDeptId,
      chefDeptName:  a.chefDept?.name,
      chefUserName:  a.chefUser?.name,
      isGtiApproval: a.isGtiApproval ?? false,
      status:        a.status,
      note:          a.note,
      decidedAt:     a.decidedAt,
    })) ?? [],
    status:        t.status,
    unit:          t.unit        ? { id: t.unit.id,        name: t.unit.name }        : null,
    technician:    t.assignedTech || null,
    completionNote: t.completionNote || null,
    slaDeadline:   t.slaDeadline,
    openedAt:      t.openedAt,
    viewedAt:      t.viewedAt,
    enRouteAt:     t.enRouteAt,
    inServiceAt:   t.inServiceAt,
    completedAt:   t.completedAt,
  };
}

// ── MENSAGENS AO SOLICITANTE ──────────────────────────────────────────────────

// Imagens são gravadas em disco (utils/messageImages.js) e o content vira "img:<arquivo>".
// Na resposta da API, esse marcador é trocado pela URL de download — mensagens
// antigas em base64 (data:image/...) passam intactas e seguem renderizando no client.
function withImageUrl(msg, urlBase) {
  if (!msg.content.startsWith(IMG_PREFIX)) return msg;
  return { ...msg, content: `${urlBase}/${msg.id}/image` };
}

// Valida e persiste o conteúdo de uma mensagem; retorna { content } ou { error }
async function prepareMessageContent(content, ticketId) {
  if (content.startsWith("data:image/")) {
    if (content.length > MAX_IMG_B64) {
      return { error: "Imagem muito grande. Máximo 3 MB." };
    }
    const filename = await saveImageFromDataUrl(content, ticketId);
    if (!filename) return { error: "Imagem inválida. Use PNG, JPEG, GIF ou WebP." };
    return { content: `${IMG_PREFIX}${filename}` };
  }
  return { content: content.trim() };
}

// GET /tickets/:id/messages — staff
export async function listMessages(req, res) {
  const id = Number(req.params.id);
  const msgs = await prisma.ticketMessage.findMany({
    where: { ticketId: id },
    include: { author: { select: { name: true, role: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(msgs.map((m) => withImageUrl(m, `/api/tickets/${id}/messages`)));
}

// POST /tickets/:id/messages — staff envia mensagem ao solicitante
const MAX_IMG_B64 = 4 * 1024 * 1024; // 4 MB base64 ≈ 3 MB de arquivo

export async function sendMessage(req, res) {
  const id = Number(req.params.id);
  const { content } = req.body || {};
  if (!content?.trim()) return res.status(400).json({ error: "Mensagem vazia" });

  const ticket = await prisma.ticket.findUnique({ where: { id }, select: { id: true, openedById: true, nucleoResponsavel: true } });
  if (!ticket) return res.status(404).json({ error: "Chamado não encontrado" });

  const prepared = await prepareMessageContent(content, id);
  if (prepared.error) return res.status(400).json({ error: prepared.error });

  const msg = await prisma.ticketMessage.create({
    data: { ticketId: id, authorId: req.user.id, fromUser: false, content: prepared.content },
    include: { author: { select: { name: true, role: true } } },
  });

  req.app.get("io")?.emit("ticket:message", {
    ticketId: id,
    fromUserId: req.user.id,
    openedById: ticket.openedById,
    nucleoResponsavel: ticket.nucleoResponsavel ?? null,
  });
  res.status(201).json(withImageUrl(msg, `/api/tickets/${id}/messages`));
}

// GET /tickets/:id/messages/:msgId/image — staff
export async function getMessageImage(req, res) {
  return serveMessageImage(res, Number(req.params.id), Number(req.params.msgId));
}

// GET /tickets/track/:ticketNumber/messages/:msgId/image — público
export async function getMessageImagePublic(req, res) {
  const ticket = await prisma.ticket.findUnique({
    where: { ticketNumber: req.params.ticketNumber },
    select: { id: true },
  });
  if (!ticket) return res.status(404).json({ error: "Chamado não encontrado" });
  return serveMessageImage(res, ticket.id, Number(req.params.msgId));
}

async function serveMessageImage(res, ticketId, msgId) {
  const msg = await prisma.ticketMessage.findUnique({ where: { id: msgId } });
  if (!msg || msg.ticketId !== ticketId || !msg.content.startsWith(IMG_PREFIX)) {
    return res.status(404).json({ error: "Imagem não encontrada" });
  }
  const filename = msg.content.slice(IMG_PREFIX.length);
  const filePath = resolveImagePath(ticketId, filename);
  if (!filePath) return res.status(404).json({ error: "Imagem não encontrada" });

  res.setHeader("Content-Type", mimeForFilename(filename));
  res.setHeader("Cache-Control", "private, max-age=86400");
  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: "Imagem não encontrada" });
  });
}

// GET /tickets/track/:ticketNumber/messages — público
export async function listMessagesPublic(req, res) {
  const { ticketNumber } = req.params;
  const ticket = await prisma.ticket.findUnique({
    where: { ticketNumber },
    select: { id: true },
  });
  if (!ticket) return res.status(404).json({ error: "Chamado não encontrado" });

  const msgs = await prisma.ticketMessage.findMany({
    where: { ticketId: ticket.id },
    select: {
      id: true, fromUser: true, content: true, createdAt: true,
      author: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  res.json(msgs.map((m) => withImageUrl(m, `/api/tickets/track/${ticketNumber}/messages`)));
}

// Subcategorias que permitem o solicitante enviar a primeira mensagem
const COUNTER_SUBCATEGORY_CODES = ["PRINTER_NO_PAPER", "PRINTER_TONER"];

// POST /tickets/track/:ticketNumber/messages — solicitante responde (ou inicia, para subcategorias de contador)
export async function sendMessagePublic(req, res) {
  const { ticketNumber } = req.params;
  const { content } = req.body || {};
  if (!content?.trim()) return res.status(400).json({ error: "Mensagem vazia" });

  const ticket = await prisma.ticket.findUnique({
    where: { ticketNumber },
    select: { id: true, nucleoResponsavel: true, subcategory: { select: { code: true } } },
  });
  if (!ticket) return res.status(404).json({ error: "Chamado não encontrado" });

  const isCounterTicket = COUNTER_SUBCATEGORY_CODES.includes(ticket.subcategory?.code);

  if (!isCounterTicket) {
    // Para os demais tickets, só permite resposta se o técnico já enviou ao menos uma mensagem
    const techMsg = await prisma.ticketMessage.findFirst({
      where: { ticketId: ticket.id, fromUser: false },
    });
    if (!techMsg) {
      return res.status(403).json({ error: "Aguarde o técnico enviar uma mensagem primeiro" });
    }
  }

  const prepared = await prepareMessageContent(content, ticket.id);
  if (prepared.error) return res.status(400).json({ error: prepared.error });

  const msg = await prisma.ticketMessage.create({
    data: { ticketId: ticket.id, fromUser: true, content: prepared.content },
  });

  req.app.get("io")?.emit("ticket:message", {
    ticketId: ticket.id,
    fromUserId: null,
    nucleoResponsavel: ticket.nucleoResponsavel ?? null,
  });
  res.status(201).json(withImageUrl(msg, `/api/tickets/track/${ticketNumber}/messages`));
}

// ── CANCEL ────────────────────────────────────────────────────────────────────
export async function cancelTicket(req, res) {
  const id = Number(req.params.id);
  const { reason, showToUser } = req.body || {};

  const ticket = await prisma.ticket.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!ticket) return res.status(404).json({ error: "Chamado não encontrado" });
  if (ticket.status === "CANCELADO") return res.status(400).json({ error: "Chamado já está cancelado" });
  if (ticket.status === "COMPLETED") return res.status(400).json({ error: "Não é possível cancelar um chamado concluído" });

  await prisma.ticket.update({
    where: { id },
    data: {
      status:          "CANCELADO",
      cancelNote:      reason?.trim() || null,
      cancelNotePublic: Boolean(showToUser),
      history: {
        create: {
          fromStatus:   ticket.status,
          toStatus:     "CANCELADO",
          actorId:      req.user?.id ?? null,
          internalNote: reason?.trim() || null,
        },
      },
    },
  });

  req.app.get("io")?.emit("ticket:updated", { id });
  res.json({ ok: true });
}
