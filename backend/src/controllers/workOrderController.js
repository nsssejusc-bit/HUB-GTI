import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { allowedOsNext, canOsTransition } from "../utils/osStateMachine.js";
import { nextOsSeq } from "../utils/nextSequence.js";

const TIPO_LABELS = {
  VISITA_TECNICA:           "Visita Técnica",
  TROCA_EQUIPAMENTO:        "Troca de Equipamento",
  ENTREGA:                  "Entrega",
  MANUTENCAO_REDE:          "Manutenção de Rede",
  MANUTENCAO_CAMERA:        "Manutenção de Câmera",
  RECOLHIMENTO_EQUIPAMENTO: "Recolhimento de Equipamento",
  ACAO:                     "Ação",
  OUTRO:                    "Outro",
};

function buildOsNumber(seq) {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `OS-${y}${m}${day}-${String(seq).padStart(4, "0")}`;
}

function formatOs(os) {
  return {
    id:            os.id,
    osNumber:      os.osNumber,
    tipo:          os.tipo,
    tipoLabel:     TIPO_LABELS[os.tipo] || os.tipo,
    status:        os.status,
    local:         os.local,
    problema:      os.problema,
    materiais:     os.materiais,
    prazo:         os.prazo,
    relatorio:     os.relatorio,
    // Ação-specific
    nomeEvento:    os.nomeEvento ?? null,
    startDateTime: os.startDateTime ?? null,
    endDateTime:   os.endDateTime ?? null,
    checklist:     os.checklist ? {
      id:        os.checklist.id,
      title:     os.checklist.title,
      nucleo:    os.checklist.nucleo,
      status:    os.checklist.status,
      itemCount: os.checklist.items?.length ?? 0,
      items:     os.checklist.items?.map((ci) => ({
        id:    ci.id,
        unitId: ci.unit?.id,
        tombo:  ci.unit?.tombo,
        status: ci.unit?.status,
        item:   ci.unit?.item ? { id: ci.unit.item.id, name: ci.unit.item.name, unitMeasure: ci.unit.item.unitMeasure } : null,
      })) ?? [],
    } : null,
    preVisita:     os.preVisita ? {
      id:            os.preVisita.id,
      osNumber:      os.preVisita.osNumber,
      local:         os.preVisita.local,
      startDateTime: os.preVisita.startDateTime,
      status:        os.preVisita.status,
      tecnicos:      os.preVisita.tecnicos?.map((t) => ({ id: t.user.id, name: t.user.name })) ?? [],
    } : null,
    unit:          os.unit ? { id: os.unit.id, name: os.unit.name } : null,
    createdBy:     os.createdBy ? { id: os.createdBy.id, name: os.createdBy.name } : null,
    tecnicos:      os.tecnicos?.map((t) => ({ id: t.user.id, name: t.user.name, unitId: t.user.unitId })) ?? [],
    tickets:       os.tickets?.map((tw) => ({
      id:            tw.ticket.id,
      ticketNumber:  tw.ticket.ticketNumber,
      requesterName: tw.ticket.requesterName,
      department:    tw.ticket.department,
      status:        tw.ticket.status,
    })) ?? [],
    createdAt:     os.createdAt,
    updatedAt:     os.updatedAt,
    startedAt:     os.startedAt,
    concludedAt:   os.concludedAt,
    cancelledAt:   os.cancelledAt,
    allowedNext:   allowedOsNext(os.status),
  };
}

// Lightweight include used for list queries (no heavy checklist items)
const osListInclude = {
  unit:      { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  tecnicos:  { include: { user: { select: { id: true, name: true, unitId: true } } } },
  tickets:   { include: { ticket: { select: { id: true, ticketNumber: true, requesterName: true, department: true, status: true } } } },
  checklist: { select: { id: true, title: true, status: true, nucleo: true } },
  preVisita: { select: { id: true, osNumber: true, local: true, startDateTime: true, status: true } },
};

// Full include used for detail/mutation queries (includes checklist items + preVisita tecnicos)
const osInclude = {
  unit:      true,
  createdBy: { select: { id: true, name: true } },
  tecnicos:  { include: { user: { select: { id: true, name: true, unitId: true } } } },
  tickets:   { include: { ticket: { select: { id: true, ticketNumber: true, requesterName: true, department: true, status: true } } } },
  checklist: { include: { items: { include: { unit: { include: { item: { select: { id: true, name: true, unitMeasure: true } } } } } } } },
  preVisita: { include: { tecnicos: { include: { user: { select: { id: true, name: true } } } } } },
};

const OS_TIPOS = ["VISITA_TECNICA","TROCA_EQUIPAMENTO","ENTREGA","MANUTENCAO_REDE","MANUTENCAO_CAMERA","RECOLHIMENTO_EQUIPAMENTO","ACAO","OUTRO"];

export async function createWorkOrder(req, res) {
  const checklistSchema = z.object({
    title:   z.string().min(2).max(300),
    nucleo:  z.enum(["NMT", "NIR"]),
    note:    z.string().max(1000).optional().nullable(),
    unitIds: z.array(z.number().int().positive()).min(1),
  });

  const preVisitaSchema = z.object({
    local:         z.string().min(2).max(300),
    startDateTime: z.string().datetime({ offset: true }),
    tecnicoIds:    z.array(z.number().int().positive()).optional(),
    problema:      z.string().max(2000).optional().nullable(),
  });

  const schema = z.object({
    tipo:          z.enum(OS_TIPOS),
    local:         z.string().min(2).max(300),
    problema:      z.string().max(2000).optional().nullable(),
    materiais:     z.string().max(1000).optional().nullable(),
    prazo:         z.string().datetime({ offset: true }).optional().nullable(),
    unitId:        z.number().int().positive().optional().nullable(),
    ticketId:      z.number().int().positive().optional().nullable(),
    // Ação-specific
    nomeEvento:    z.string().min(2).max(300).optional().nullable(),
    startDateTime: z.string().datetime({ offset: true }).optional().nullable(),
    endDateTime:   z.string().datetime({ offset: true }).optional().nullable(),
    tecnicoIds:    z.array(z.number().int().positive()).optional(),
    checklist:     checklistSchema.optional().nullable(),
    preVisita:     preVisitaSchema.optional().nullable(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });
  const data = parsed.data;

  if (data.tipo === "ACAO") {
    if (!data.nomeEvento)    return res.status(400).json({ error: "Nome do evento é obrigatório para Ações" });
    if (!data.startDateTime) return res.status(400).json({ error: "Data/hora de início é obrigatória para Ações" });
    if (!data.endDateTime)   return res.status(400).json({ error: "Data/hora de término é obrigatória para Ações" });
  }

  const seq = await nextOsSeq();
  const osNumber = buildOsNumber(seq);

  const os = await prisma.$transaction(async (tx) => {
    // 1. Create main WorkOrder
    const created = await tx.workOrder.create({
      data: {
        osNumber,
        tipo:          data.tipo,
        local:         data.local,
        problema:      data.problema ?? null,
        materiais:     data.materiais ?? null,
        prazo:         data.prazo ? new Date(data.prazo) : null,
        unitId:        data.unitId ?? null,
        createdById:   req.user.id,
        nomeEvento:    data.nomeEvento ?? null,
        startDateTime: data.startDateTime ? new Date(data.startDateTime) : null,
        endDateTime:   data.endDateTime   ? new Date(data.endDateTime)   : null,
        history:       { create: { toStatus: "ABERTA", actorId: req.user.id } },
        ...(data.ticketId ? { tickets: { create: { ticketId: data.ticketId } } } : {}),
        ...(data.tecnicoIds?.length ? { tecnicos: { createMany: { data: data.tecnicoIds.map((uid) => ({ userId: uid })), skipDuplicates: true } } } : {}),
      },
      include: osInclude,
    });

    // 2. Inline checklist creation (optional, for Ação)
    if (data.checklist) {
      const cl = data.checklist;
      const checklist = await tx.inventoryChecklist.create({
        data: {
          title:       cl.title,
          nucleo:      cl.nucleo,
          note:        cl.note ?? null,
          createdById: req.user.id,
          items:       { createMany: { data: cl.unitIds.map((uid) => ({ unitId: uid })) } },
        },
      });
      // Mark units as EM_USO
      await tx.inventoryUnit.updateMany({ where: { id: { in: cl.unitIds } }, data: { status: "EM_USO" } });
      // Link checklist to the work order
      await tx.workOrder.update({ where: { id: created.id }, data: { checklistId: checklist.id } });
    }

    // 3. Pre-visit work order creation (optional, for Ação)
    if (data.preVisita) {
      const pv = data.preVisita;
      const pvSeq = await nextOsSeq();
      const pvNumber = buildOsNumber(pvSeq);
      const preVisitaOs = await tx.workOrder.create({
        data: {
          osNumber:      pvNumber,
          tipo:          "VISITA_TECNICA",
          local:         pv.local,
          problema:      pv.problema ?? null,
          createdById:   req.user.id,
          startDateTime: new Date(pv.startDateTime),
          history:       { create: { toStatus: "ABERTA", actorId: req.user.id } },
          ...(pv.tecnicoIds?.length ? { tecnicos: { createMany: { data: pv.tecnicoIds.map((uid) => ({ userId: uid })), skipDuplicates: true } } } : {}),
        },
      });
      await tx.workOrder.update({ where: { id: created.id }, data: { preVisitaId: preVisitaOs.id } });
    }

    // Re-fetch with all relations
    return tx.workOrder.findUnique({ where: { id: created.id }, include: osInclude });
  });

  req.app.get("io")?.emit("workorder:created", { osNumber: os.osNumber });
  res.status(201).json(formatOs(os));
}

export async function listWorkOrders(req, res) {
  try {
    const { status, unitId, tipo, limit, offset, ticketId, from, to } = req.query;
    const where = {};
    if (status && ["ABERTA","EM_ANDAMENTO","CONCLUIDA","CANCELADA"].includes(status)) where.status = status;
    if (unitId && !isNaN(Number(unitId))) where.unitId = Number(unitId);
    if (tipo   && OS_TIPOS.includes(tipo)) where.tipo  = tipo;
    if (ticketId && !isNaN(Number(ticketId))) where.tickets = { some: { ticketId: Number(ticketId) } };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to)   where.createdAt.lte = new Date(to);
    }

    const take = Math.min(Number(limit)  || 100, 500);
    const skip = Math.max(Number(offset) || 0,   0);

    const rows = await prisma.workOrder.findMany({
      where,
      include: osListInclude,
      orderBy: { createdAt: "desc" },
      take,
      skip,
    });

    res.json(rows.map(formatOs));
  } catch (e) {
    console.error("listWorkOrders:", e);
    res.status(500).json({ error: "Erro ao listar ordens de serviço" });
  }
}

export async function getWorkOrder(req, res) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
    const os = await prisma.workOrder.findUnique({
      where: { id },
      include: {
        ...osInclude,
        history: {
          include: { actor: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!os) return res.status(404).json({ error: "OS não encontrada" });
    res.json({ ...formatOs(os), history: os.history });
  } catch (e) {
    console.error("getWorkOrder:", e);
    res.status(500).json({ error: "Erro ao buscar ordem de serviço" });
  }
}

export async function updateWorkOrder(req, res) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
    const schema = z.object({
      local:         z.string().min(2).max(300).optional(),
      problema:      z.string().max(2000).optional().nullable(),
      materiais:     z.string().max(1000).optional().nullable(),
      prazo:         z.string().datetime({ offset: true }).optional().nullable(),
      unitId:        z.number().int().positive().optional().nullable(),
      tipo:          z.enum(OS_TIPOS).optional(),
      nomeEvento:    z.string().min(2).max(300).optional().nullable(),
      startDateTime: z.string().datetime({ offset: true }).optional().nullable(),
      endDateTime:   z.string().datetime({ offset: true }).optional().nullable(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });

    const os = await prisma.workOrder.findUnique({ where: { id } });
    if (!os) return res.status(404).json({ error: "OS não encontrada" });
    if (os.status === "CONCLUIDA" || os.status === "CANCELADA") {
      return res.status(400).json({ error: "Não é possível editar uma OS concluída ou cancelada" });
    }

    const data = parsed.data;
    const updated = await prisma.workOrder.update({
      where: { id },
      data: {
        ...(data.local         !== undefined ? { local: data.local }                 : {}),
        ...(data.problema      !== undefined ? { problema: data.problema }           : {}),
        ...(data.materiais     !== undefined ? { materiais: data.materiais }         : {}),
        ...(data.unitId        !== undefined ? { unitId: data.unitId }               : {}),
        ...(data.tipo          !== undefined ? { tipo: data.tipo }                   : {}),
        ...(data.nomeEvento    !== undefined ? { nomeEvento: data.nomeEvento }       : {}),
        ...(data.startDateTime !== undefined ? { startDateTime: data.startDateTime ? new Date(data.startDateTime) : null } : {}),
        ...(data.endDateTime   !== undefined ? { endDateTime: data.endDateTime   ? new Date(data.endDateTime)   : null } : {}),
        prazo: data.prazo !== undefined ? (data.prazo ? new Date(data.prazo) : null) : undefined,
      },
      include: osInclude,
    });

    req.app.get("io")?.emit("workorder:updated", { id });
    res.json(formatOs(updated));
  } catch (e) {
    console.error("updateWorkOrder:", e);
    res.status(500).json({ error: "Erro ao atualizar OS" });
  }
}

export async function transitionWorkOrder(req, res) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
    const { toStatus, relatorio, note } = req.body || {};

    const os = await prisma.workOrder.findUnique({ where: { id } });
    if (!os) return res.status(404).json({ error: "OS não encontrada" });

    if (!canOsTransition(os.status, toStatus)) {
      return res.status(400).json({ error: `Transição inválida: ${os.status} → ${toStatus}` });
    }

    // Ação só pode iniciar depois que a visita técnica prévia estiver concluída
    if (os.tipo === "ACAO" && toStatus === "EM_ANDAMENTO" && os.preVisitaId) {
      const preVisita = await prisma.workOrder.findUnique({ where: { id: os.preVisitaId }, select: { status: true } });
      if (preVisita && preVisita.status !== "CONCLUIDA") {
        return res.status(400).json({ error: "A visita técnica prévia precisa ser concluída antes de iniciar a Ação" });
      }
    }

    const now = new Date();
    const timeFields = {};
    if (toStatus === "EM_ANDAMENTO") timeFields.startedAt   = now;
    if (toStatus === "CONCLUIDA")    timeFields.concludedAt = now;
    if (toStatus === "CANCELADA")    timeFields.cancelledAt = now;

    const updated = await prisma.workOrder.update({
      where: { id },
      data: {
        status: toStatus,
        ...timeFields,
        ...(relatorio !== undefined ? { relatorio } : {}),
        history: { create: { fromStatus: os.status, toStatus, actorId: req.user.id, note: note || null } },
      },
      include: osInclude,
    });

    req.app.get("io")?.emit("workorder:updated", { id });
    res.json(formatOs(updated));
  } catch (e) {
    console.error("transitionWorkOrder:", e);
    res.status(500).json({ error: "Erro ao alterar status da OS" });
  }
}

export async function addTecnico(req, res) {
  try {
    const id     = Number(req.params.id);
    const userId = Number(req.body.userId);
    if (isNaN(id) || !userId) return res.status(400).json({ error: "Parâmetros inválidos" });

    const os = await prisma.workOrder.findUnique({ where: { id } });
    if (!os) return res.status(404).json({ error: "OS não encontrada" });
    if (os.status === "CONCLUIDA" || os.status === "CANCELADA") {
      return res.status(400).json({ error: "Não é possível alterar técnicos de uma OS finalizada" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !["TECHNICIAN", "ADMIN"].includes(user.role)) {
      return res.status(400).json({ error: "Usuário não encontrado ou não é técnico/admin" });
    }

    await prisma.osTecnico.upsert({
      where: { osId_userId: { osId: id, userId } },
      create: { osId: id, userId },
      update: {},
    });

    const updated = await prisma.workOrder.findUnique({ where: { id }, include: osInclude });
    req.app.get("io")?.emit("workorder:updated", { id });
    res.json(formatOs(updated));
  } catch (e) {
    console.error("addTecnico:", e);
    res.status(500).json({ error: "Erro ao adicionar técnico" });
  }
}

export async function removeTecnico(req, res) {
  try {
    const id     = Number(req.params.id);
    const userId = Number(req.params.userId);
    if (isNaN(id) || isNaN(userId)) return res.status(400).json({ error: "Parâmetros inválidos" });

    const os = await prisma.workOrder.findUnique({ where: { id } });
    if (!os) return res.status(404).json({ error: "OS não encontrada" });

    await prisma.osTecnico.deleteMany({ where: { osId: id, userId } });
    const updated = await prisma.workOrder.findUnique({ where: { id }, include: osInclude });
    req.app.get("io")?.emit("workorder:updated", { id });
    res.json(formatOs(updated));
  } catch (e) {
    console.error("removeTecnico:", e);
    res.status(500).json({ error: "Erro ao remover técnico" });
  }
}

export async function linkTicket(req, res) {
  try {
    const id       = Number(req.params.id);
    const ticketId = Number(req.body.ticketId);
    if (isNaN(id) || !ticketId) return res.status(400).json({ error: "Parâmetros inválidos" });

    const [os, ticket] = await Promise.all([
      prisma.workOrder.findUnique({ where: { id } }),
      prisma.ticket.findUnique({ where: { id: ticketId } }),
    ]);
    if (!os)     return res.status(404).json({ error: "OS não encontrada" });
    if (!ticket) return res.status(404).json({ error: "Chamado não encontrado" });

    await prisma.ticketWorkOrder.upsert({
      where: { ticketId_workOrderId: { ticketId, workOrderId: id } },
      create: { ticketId, workOrderId: id },
      update: {},
    });

    const updated = await prisma.workOrder.findUnique({ where: { id }, include: osInclude });
    req.app.get("io")?.emit("workorder:updated", { id });
    res.json(formatOs(updated));
  } catch (e) {
    console.error("linkTicket:", e);
    res.status(500).json({ error: "Erro ao vincular chamado" });
  }
}

export async function unlinkTicket(req, res) {
  try {
    const id       = Number(req.params.id);
    const ticketId = Number(req.params.ticketId);
    if (isNaN(id) || isNaN(ticketId)) return res.status(400).json({ error: "Parâmetros inválidos" });

    const os = await prisma.workOrder.findUnique({ where: { id } });
    if (!os) return res.status(404).json({ error: "OS não encontrada" });

    await prisma.ticketWorkOrder.deleteMany({ where: { ticketId, workOrderId: id } });
    const updated = await prisma.workOrder.findUnique({ where: { id }, include: osInclude });
    req.app.get("io")?.emit("workorder:updated", { id });
    res.json(formatOs(updated));
  } catch (e) {
    console.error("unlinkTicket:", e);
    res.status(500).json({ error: "Erro ao desvincular chamado" });
  }
}

export async function deleteWorkOrder(req, res) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
    const os = await prisma.workOrder.findUnique({ where: { id } });
    if (!os) return res.status(404).json({ error: "OS não encontrada" });

    await prisma.workOrder.delete({ where: { id } });
    req.app.get("io")?.emit("workorder:deleted", { id });
    res.status(204).end();
  } catch (e) {
    console.error("deleteWorkOrder:", e);
    res.status(500).json({ error: "Erro ao excluir OS" });
  }
}
