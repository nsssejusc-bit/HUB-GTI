import { z } from "zod";
import { prisma } from "../config/prisma.js";

const assetSchema = z.object({
  tombo:           z.string().min(1).max(100).trim().nullish(),
  hostname:        z.string().min(1).max(200).trim(),
  cpu:             z.string().min(1).max(200).trim(),
  ram:             z.string().min(1).max(100).trim(),
  storage:         z.string().min(1).max(100).trim(),
  operatingSystem: z.string().min(1).max(200).trim(),
  status:          z.enum(["ATIVO", "INATIVO", "MANUTENCAO", "RECOLHIDO"]).default("ATIVO"),
  setor:           z.string().max(200).trim().nullable().optional(),
  responsavel:     z.string().max(200).trim().nullable().optional(),
  notes:           z.string().max(2000).trim().nullable().optional(),
});

const allocSchema = z.object({
  setor:       z.string().max(200).trim().nullable().optional(),
  responsavel: z.string().max(200).trim().nullable().optional(),
  notes:       z.string().max(1000).trim().nullable().optional(),
  status:      z.enum(["ATIVO", "INATIVO", "MANUTENCAO", "RECOLHIDO"]).optional(),
});

const include = {
  createdBy:   { select: { id: true, name: true } },
  allocations: {
    orderBy:  { startedAt: "desc" },
    include:  { createdBy: { select: { id: true, name: true } } },
  },
  workOrders: {
    orderBy: { createdAt: "desc" },
    take:    20,
    include: { tipo: { select: { id: true, name: true, color: true } } },
  },
  _count: { select: { allocations: true } },
};

function fmt(a) {
  return {
    id:              a.id,
    tombo:           a.tombo,
    hostname:        a.hostname,
    cpu:             a.cpu,
    ram:             a.ram,
    storage:         a.storage,
    operatingSystem: a.operatingSystem,
    status:          a.status,
    setor:           a.setor,
    responsavel:     a.responsavel,
    notes:           a.notes,
    createdAt:       a.createdAt,
    updatedAt:       a.updatedAt,
    createdBy:       a.createdBy ?? null,
    allocations:     a.allocations ?? [],
    allocationCount: a._count?.allocations ?? 0,
    workOrders:      (a.workOrders ?? []).map((os) => ({
      id:        os.id,
      osNumber:  os.osNumber,
      status:    os.status,
      tipo:      os.tipo ? { id: os.tipo.id, name: os.tipo.name, color: os.tipo.color } : null,
      createdAt: os.createdAt,
    })),
  };
}

export async function listAssets(req, res) {
  const { status, search, page = "1", limit = "50" } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const where = {};
  if (status) where.status = status;
  if (search) {
    const s = search.trim();
    where.OR = [
      { tombo:       { contains: s } },
      { hostname:    { contains: s } },
      { setor:       { contains: s } },
      { responsavel: { contains: s } },
      { cpu:         { contains: s } },
    ];
  }

  const [total, assets] = await Promise.all([
    prisma.asset.count({ where }),
    prisma.asset.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { tombo: "asc" },
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { allocations: true } },
      },
    }),
  ]);

  res.json({ total, assets: assets.map((a) => fmt({ ...a, allocations: [] })) });
}

export async function getAsset(req, res) {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const asset = await prisma.asset.findUnique({ where: { id }, include });
  if (!asset) return res.status(404).json({ error: "Ativo não encontrado" });
  res.json(fmt(asset));
}

export async function createAsset(req, res) {
  const parsed = assetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });

  const { tombo, setor, responsavel, ...rest } = parsed.data;

  if (tombo) {
    const dup = await prisma.asset.findUnique({ where: { tombo } });
    if (dup) return res.status(400).json({ error: `Tombo "${tombo}" já está cadastrado` });
  }

  const asset = await prisma.$transaction(async (tx) => {
    const a = await tx.asset.create({
      data: { tombo: tombo ?? null, setor: setor ?? null, responsavel: responsavel ?? null, ...rest, createdById: req.user.id },
      include,
    });
    if (setor || responsavel) {
      await tx.assetAllocation.create({
        data: { assetId: a.id, setor: setor ?? null, responsavel: responsavel ?? null, createdById: req.user.id },
      });
      const updated = await tx.asset.findUnique({ where: { id: a.id }, include });
      return updated;
    }
    return a;
  });

  res.status(201).json(fmt(asset));
}

export async function updateAsset(req, res) {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const existing = await prisma.asset.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Ativo não encontrado" });

  const parsed = assetSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });

  if (parsed.data.tombo && parsed.data.tombo !== existing.tombo) {
    const dup = await prisma.asset.findUnique({ where: { tombo: parsed.data.tombo } });
    if (dup) return res.status(400).json({ error: `Tombo "${parsed.data.tombo}" já está em uso` });
  }

  const asset = await prisma.asset.update({ where: { id }, data: parsed.data, include });
  res.json(fmt(asset));
}

export async function deleteAsset(req, res) {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const existing = await prisma.asset.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Ativo não encontrado" });

  await prisma.asset.delete({ where: { id } });
  res.status(204).end();
}

export async function allocateAsset(req, res) {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const parsed = allocSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos" });

  const existing = await prisma.asset.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Ativo não encontrado" });

  const asset = await prisma.$transaction(async (tx) => {
    await tx.assetAllocation.updateMany({
      where: { assetId: id, endedAt: null },
      data:  { endedAt: new Date() },
    });
    await tx.assetAllocation.create({
      data: {
        assetId:     id,
        setor:       parsed.data.setor ?? null,
        responsavel: parsed.data.responsavel ?? null,
        notes:       parsed.data.notes ?? null,
        createdById: req.user.id,
      },
    });
    return tx.asset.update({
      where: { id },
      data: {
        setor:       parsed.data.setor ?? null,
        responsavel: parsed.data.responsavel ?? null,
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
      },
      include,
    });
  });

  res.json(fmt(asset));
}
