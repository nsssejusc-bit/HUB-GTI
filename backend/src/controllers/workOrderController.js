import { z } from "zod";
import multer from "multer";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { prisma } from "../config/prisma.js";
import { allowedOsNext, canOsTransition } from "../utils/osStateMachine.js";
import { nextOsSeq } from "../utils/nextSequence.js";

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_OS = path.join(__dirname, "../../uploads/os");

const _multer = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Apenas imagens são permitidas"));
    cb(null, true);
  },
});
export const uploadMiddleware = _multer.array("images", 10);

function fmtImage(img) {
  return {
    id:           img.id,
    url:          `/uploads/os/${img.workOrderId}/${img.filename}`,
    originalName: img.originalName,
    size:         img.size,
    createdBy:    img.createdBy ? { id: img.createdBy.id, name: img.createdBy.name } : null,
    createdAt:    img.createdAt,
  };
}

function buildOsNumber(seq) {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `OS-${y}${m}${day}-${String(seq).padStart(4, "0")}`;
}

function formatOs(os) {
  return {
    id:          os.id,
    osNumber:    os.osNumber,
    tipo:        os.tipo ? {
      id:     os.tipo.id,
      name:   os.tipo.name,
      color:  os.tipo.color,
      fields: os.tipo.fields ?? [],
    } : null,
    status:      os.status,
    formData:    os.formData ?? {},
    relatorio:   os.relatorio,
    problema:    os.problema ?? null,
    solucao:     os.solucao  ?? null,
    asset:       os.asset ? {
      id:              os.asset.id,
      tombo:           os.asset.tombo,
      hostname:        os.asset.hostname,
      cpu:             os.asset.cpu,
      ram:             os.asset.ram,
      storage:         os.asset.storage,
      operatingSystem: os.asset.operatingSystem,
      status:          os.asset.status,
      setor:           os.asset.setor,
      responsavel:     os.asset.responsavel,
    } : null,
    images:      os.images?.map(fmtImage) ?? [],
    checklist:   os.checklist ? {
      id:        os.checklist.id,
      title:     os.checklist.title,
      nucleo:    os.checklist.nucleo,
      status:    os.checklist.status,
      itemCount: os.checklist.items?.length ?? 0,
      items:     os.checklist.items?.map((ci) => ({
        id:     ci.id,
        unitId: ci.unit?.id,
        tombo:  ci.unit?.tombo,
        status: ci.unit?.status,
        item:   ci.unit?.item ? { id: ci.unit.item.id, name: ci.unit.item.name, unitMeasure: ci.unit.item.unitMeasure } : null,
      })) ?? [],
    } : null,
    preVisita:   os.preVisita ? {
      id:       os.preVisita.id,
      osNumber: os.preVisita.osNumber,
      tipo:     os.preVisita.tipo ? { id: os.preVisita.tipo.id, name: os.preVisita.tipo.name, color: os.preVisita.tipo.color } : null,
      formData: os.preVisita.formData ?? {},
      status:   os.preVisita.status,
      tecnicos: os.preVisita.tecnicos?.map((t) => ({ id: t.user.id, name: t.user.name })) ?? [],
    } : null,
    unit:        os.unit ? { id: os.unit.id, name: os.unit.name } : null,
    createdBy:   os.createdBy ? { id: os.createdBy.id, name: os.createdBy.name } : null,
    tecnicos:    os.tecnicos?.map((t) => ({ id: t.user.id, name: t.user.name, unitId: t.user.unitId })) ?? [],
    tickets:     os.tickets?.map((tw) => ({
      id:            tw.ticket.id,
      ticketNumber:  tw.ticket.ticketNumber,
      requesterName: tw.ticket.requesterName,
      department:    tw.ticket.department,
      status:        tw.ticket.status,
    })) ?? [],
    createdAt:   os.createdAt,
    updatedAt:   os.updatedAt,
    startedAt:   os.startedAt,
    concludedAt: os.concludedAt,
    cancelledAt: os.cancelledAt,
    allowedNext: allowedOsNext(os.status),
  };
}

const tipoSelect = { id: true, name: true, color: true, fields: true };

const assetSelect = { id: true, tombo: true, hostname: true, cpu: true, ram: true, storage: true, operatingSystem: true, status: true, setor: true, responsavel: true };

const osListInclude = {
  tipo:      { select: tipoSelect },
  unit:      { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  tecnicos:  { include: { user: { select: { id: true, name: true, unitId: true } } } },
  tickets:   { include: { ticket: { select: { id: true, ticketNumber: true, requesterName: true, department: true, status: true } } } },
  checklist: { select: { id: true, title: true, status: true, nucleo: true } },
  asset:     { select: assetSelect },
  preVisita: {
    select: {
      id: true, osNumber: true, formData: true, status: true,
      tipo: { select: { id: true, name: true, color: true } },
    },
  },
};

const osInclude = {
  tipo:      true,
  unit:      true,
  createdBy: { select: { id: true, name: true } },
  tecnicos:  { include: { user: { select: { id: true, name: true, unitId: true } } } },
  tickets:   { include: { ticket: { select: { id: true, ticketNumber: true, requesterName: true, department: true, status: true } } } },
  checklist: { include: { items: { include: { unit: { include: { item: { select: { id: true, name: true, unitMeasure: true } } } } } } } },
  asset:     { select: assetSelect },
  images:    { select: { id: true, workOrderId: true, filename: true, originalName: true, size: true, createdAt: true, createdBy: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
  preVisita: {
    include: {
      tipo:     { select: { id: true, name: true, color: true } },
      tecnicos: { include: { user: { select: { id: true, name: true } } } },
    },
  },
};

export async function createWorkOrder(req, res) {
  const schema = z.object({
    tipoId:      z.number().int().positive(),
    formData:    z.record(z.unknown()).default({}),
    unitId:      z.number().int().positive().optional().nullable(),
    ticketId:    z.number().int().positive().optional().nullable(),
    tecnicoIds:  z.array(z.number().int().positive()).optional(),
    preVisitaId: z.number().int().positive().optional().nullable(),
    assetId:     z.number().int().positive().optional().nullable(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });
  const data = parsed.data;

  const tipo = await prisma.workOrderType.findUnique({ where: { id: data.tipoId } });
  if (!tipo || !tipo.active) return res.status(400).json({ error: "Tipo de OS não encontrado ou inativo" });

  const fields = Array.isArray(tipo.fields) ? tipo.fields : [];
  for (const field of fields) {
    if (field.required) {
      const val = data.formData[field.key];
      if (val === undefined || val === null || val === "") {
        return res.status(400).json({ error: `Campo "${field.label}" é obrigatório` });
      }
    }
  }

  if (data.assetId) {
    const asset = await prisma.asset.findUnique({ where: { id: data.assetId } });
    if (!asset) return res.status(400).json({ error: "Ativo não encontrado" });
  }

  const seq = await nextOsSeq();
  const osNumber = buildOsNumber(seq);

  const os = await prisma.$transaction(async (tx) => {
    const created = await tx.workOrder.create({
      data: {
        osNumber,
        tipoId:      data.tipoId,
        formData:    data.formData,
        unitId:      data.unitId      ?? null,
        assetId:     data.assetId     ?? null,
        createdById: req.user.id,
        preVisitaId: data.preVisitaId ?? null,
        history:     { create: { toStatus: "ABERTA", actorId: req.user.id } },
        ...(data.ticketId ? { tickets: { create: { ticketId: data.ticketId } } } : {}),
        ...(data.tecnicoIds?.length
          ? { tecnicos: { createMany: { data: data.tecnicoIds.map((uid) => ({ userId: uid })), skipDuplicates: true } } }
          : {}),
      },
      include: osInclude,
    });

    if (data.assetId) {
      await tx.assetAllocation.updateMany({ where: { assetId: data.assetId, endedAt: null }, data: { endedAt: new Date() } });
      await tx.assetAllocation.create({
        data: { assetId: data.assetId, workOrderId: created.id, notes: `Recolhido — ${created.osNumber}`, createdById: req.user.id },
      });
      await tx.asset.update({ where: { id: data.assetId }, data: { status: "RECOLHIDO" } });
    }

    return created;
  });

  req.app.get("io")?.emit("workorder:created", { osNumber: os.osNumber });
  res.status(201).json(formatOs(os));
}

export async function listWorkOrders(req, res) {
  try {
    const { status, unitId, tipoId, limit, offset, ticketId, from, to } = req.query;
    const where = {};
    if (status  && ["ABERTA","EM_ANDAMENTO","CONCLUIDA","CANCELADA"].includes(status)) where.status  = status;
    if (unitId  && !isNaN(Number(unitId)))  where.unitId  = Number(unitId);
    if (tipoId  && !isNaN(Number(tipoId)))  where.tipoId  = Number(tipoId);
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
      formData:    z.record(z.unknown()).optional(),
      unitId:      z.number().int().positive().optional().nullable(),
      tipoId:      z.number().int().positive().optional(),
      preVisitaId: z.number().int().positive().optional().nullable(),
      assetId:     z.number().int().positive().optional().nullable(),
      problema:    z.string().max(10000).optional().nullable(),
      solucao:     z.string().max(10000).optional().nullable(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });

    const os = await prisma.workOrder.findUnique({ where: { id } });
    if (!os) return res.status(404).json({ error: "OS não encontrada" });
    if (os.status === "CONCLUIDA" || os.status === "CANCELADA") {
      return res.status(400).json({ error: "Não é possível editar uma OS concluída ou cancelada" });
    }

    const data = parsed.data;

    // Merge formData with existing (partial update)
    let newFormData = undefined;
    if (data.formData !== undefined) {
      newFormData = { ...(os.formData ?? {}), ...data.formData };
    }

    const updated = await prisma.workOrder.update({
      where: { id },
      data: {
        ...(newFormData !== undefined   ? { formData: newFormData }             : {}),
        ...(data.unitId      !== undefined ? { unitId: data.unitId }           : {}),
        ...(data.tipoId      !== undefined ? { tipoId: data.tipoId }           : {}),
        ...(data.preVisitaId !== undefined ? { preVisitaId: data.preVisitaId } : {}),
        ...(data.assetId     !== undefined ? { assetId: data.assetId }         : {}),
        ...(data.problema    !== undefined ? { problema: data.problema }       : {}),
        ...(data.solucao     !== undefined ? { solucao: data.solucao }         : {}),
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
    const { toStatus, relatorio, note, problema, solucao } = req.body || {};

    const os = await prisma.workOrder.findUnique({ where: { id } });
    if (!os) return res.status(404).json({ error: "OS não encontrada" });

    if (!canOsTransition(os.status, toStatus)) {
      return res.status(400).json({ error: `Transição inválida: ${os.status} → ${toStatus}` });
    }

    // Any OS with a pre-requisite must wait for it to be concluded
    if (toStatus === "EM_ANDAMENTO" && os.preVisitaId) {
      const preVisita = await prisma.workOrder.findUnique({ where: { id: os.preVisitaId }, select: { status: true } });
      if (preVisita && preVisita.status !== "CONCLUIDA") {
        return res.status(400).json({ error: "A OS pré-requisito precisa ser concluída antes de iniciar esta OS" });
      }
    }

    const now = new Date();
    const timeFields = {};
    if (toStatus === "EM_ANDAMENTO") timeFields.startedAt   = now;
    if (toStatus === "CONCLUIDA")    timeFields.concludedAt = now;
    if (toStatus === "CANCELADA")    timeFields.cancelledAt = now;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.workOrder.update({
        where: { id },
        data: {
          status: toStatus,
          ...timeFields,
          ...(relatorio !== undefined ? { relatorio }           : {}),
          ...(problema  !== undefined ? { problema: problema }  : {}),
          ...(solucao   !== undefined ? { solucao:  solucao  }  : {}),
          history: { create: { fromStatus: os.status, toStatus, actorId: req.user.id, note: note || null } },
        },
        include: osInclude,
      });

      if (os.assetId && (toStatus === "CONCLUIDA" || toStatus === "CANCELADA")) {
        const noteText = toStatus === "CONCLUIDA"
          ? `Concluído — ${os.osNumber}`
          : `Cancelado — ${os.osNumber}`;
        await tx.assetAllocation.updateMany({ where: { assetId: os.assetId, endedAt: null }, data: { endedAt: now } });
        await tx.assetAllocation.create({
          data: { assetId: os.assetId, workOrderId: id, notes: noteText, createdById: req.user.id },
        });
        await tx.asset.update({ where: { id: os.assetId }, data: { status: "ATIVO" } });
      }

      return result;
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
      where:  { ticketId_workOrderId: { ticketId, workOrderId: id } },
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

export async function uploadImages(req, res) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

    const os = await prisma.workOrder.findUnique({ where: { id } });
    if (!os) return res.status(404).json({ error: "OS não encontrada" });
    if (!req.files?.length) return res.status(400).json({ error: "Nenhuma imagem enviada" });

    const dir = path.join(UPLOADS_OS, String(id));
    await fs.mkdir(dir, { recursive: true });

    const created = await Promise.all(req.files.map(async (file) => {
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const outPath  = path.join(dir, filename);

      const info = await sharp(file.buffer)
        .rotate()
        .resize({ width: 1920, height: 1080, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toFile(outPath);

      return prisma.workOrderImage.create({
        data: { workOrderId: id, filename, originalName: file.originalname, size: info.size, createdById: req.user.id },
        include: { createdBy: { select: { id: true, name: true } } },
      });
    }));

    req.app.get("io")?.emit("workorder:updated", { id });
    res.status(201).json(created.map(fmtImage));
  } catch (e) {
    console.error("uploadImages:", e);
    res.status(500).json({ error: "Erro ao fazer upload das imagens" });
  }
}

export async function deleteImage(req, res) {
  try {
    const osId  = Number(req.params.id);
    const imgId = Number(req.params.imageId);
    if (isNaN(osId) || isNaN(imgId)) return res.status(400).json({ error: "ID inválido" });

    const img = await prisma.workOrderImage.findFirst({ where: { id: imgId, workOrderId: osId } });
    if (!img) return res.status(404).json({ error: "Imagem não encontrada" });

    const filePath = path.join(UPLOADS_OS, String(osId), img.filename);
    await fs.unlink(filePath).catch(() => {});
    await prisma.workOrderImage.delete({ where: { id: imgId } });

    req.app.get("io")?.emit("workorder:updated", { id: osId });
    res.status(204).end();
  } catch (e) {
    console.error("deleteImage:", e);
    res.status(500).json({ error: "Erro ao excluir imagem" });
  }
}
