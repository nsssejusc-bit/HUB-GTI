import { z } from "zod";
import { prisma } from "../config/prisma.js";

const itemSchema = z.object({
  name:        z.string().min(2, "Nome deve ter ao menos 2 caracteres").max(191),
  description: z.string().max(2000).nullable().optional(),
  unitMeasure: z.string().max(50).default("un"),
  category:    z.string().max(191).nullable().optional(),
  nucleo:      z.enum(["NMT", "NIR"]).nullable().optional(),
});

const unitSchema = z.object({
  tombo:  z.string().max(191).nullable().optional(),
  status: z.enum(["DISPONIVEL", "EM_USO", "INATIVO"]).optional(),
  note:   z.string().max(1000).nullable().optional(),
});

// GET /api/inventory
export async function listInventory(req, res) {
  const { search, category, status, nucleo, limit = "100", offset = "0", withUnits } = req.query;

  const where = {};
  if (status) where.status = status;
  if (category) where.category = category;
  if (nucleo) where.nucleo = nucleo;
  if (search) {
    where.OR = [
      { name:     { contains: search } },
      { category: { contains: search } },
      { units:    { some: { tombo: { contains: search } } } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      orderBy: { name: "asc" },
      take:    parseInt(limit),
      skip:    parseInt(offset),
      include: {
        createdBy: { select: { id: true, name: true } },
        units: withUnits === "true"
          ? { select: { id: true, tombo: true, status: true }, orderBy: { tombo: "asc" } }
          : { where: { status: { in: ["DISPONIVEL", "EM_USO"] } }, select: { status: true } },
      },
    }),
    prisma.inventoryItem.count({ where }),
  ]);

  const mapped = items.map((item) => {
    const disponivel = item.units.filter((u) => u.status === "DISPONIVEL").length;
    const emUso      = item.units.filter((u) => u.status === "EM_USO").length;
    const total      = disponivel + emUso + item.units.filter((u) => u.status === "INATIVO").length;
    return {
      ...item,
      units:      withUnits === "true" ? item.units : undefined,
      disponivel,
      emUso,
      totalUnits: total,
    };
  });

  res.json({ items: mapped, total });
}

// GET /api/inventory/categories
export async function listInventoryCategories(req, res) {
  const cats = await prisma.inventoryItem.findMany({
    where:   { category: { not: null } },
    select:  { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  res.json(cats.map((c) => c.category));
}

// GET /api/inventory/:id
export async function getInventoryItem(req, res) {
  const id = Number(req.params.id);
  const item = await prisma.inventoryItem.findUnique({
    where:   { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      units: {
        orderBy: [{ status: "asc" }, { tombo: "asc" }],
        include: { createdBy: { select: { id: true, name: true } } },
      },
    },
  });
  if (!item) return res.status(404).json({ error: "Item não encontrado" });
  res.json(item);
}

// POST /api/inventory
export async function createInventoryItem(req, res) {
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { name, description, unitMeasure, category, nucleo } = parsed.data;

  const item = await prisma.inventoryItem.create({
    data: {
      name,
      description: description || null,
      unitMeasure,
      category:    category || null,
      nucleo:      nucleo || null,
      createdById: req.user.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId:    req.user.id,
      actorName:  req.user.name,
      action:     "INVENTORY_CREATE",
      targetType: "InventoryItem",
      targetId:   String(item.id),
      details:    JSON.stringify({ name }),
    },
  });

  res.status(201).json(item);
}

// PATCH /api/inventory/:id
export async function updateInventoryItem(req, res) {
  const id = Number(req.params.id);
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ error: "Item não encontrado" });

  const partial = itemSchema.partial().extend({
    status: z.enum(["ATIVO", "INATIVO"]).optional(),
    nucleo: z.enum(["NMT", "NIR"]).nullable().optional(),
  });
  const parsed = partial.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const updated = await prisma.inventoryItem.update({
    where: { id },
    data:  parsed.data,
  });

  await prisma.auditLog.create({
    data: {
      actorId:    req.user.id,
      actorName:  req.user.name,
      action:     "INVENTORY_UPDATE",
      targetType: "InventoryItem",
      targetId:   String(id),
      details:    JSON.stringify(parsed.data),
    },
  });

  res.json(updated);
}

// DELETE /api/inventory/:id
export async function deleteInventoryItem(req, res) {
  const id = Number(req.params.id);
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ error: "Item não encontrado" });

  await prisma.inventoryItem.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      actorId:    req.user.id,
      actorName:  req.user.name,
      action:     "INVENTORY_DELETE",
      targetType: "InventoryItem",
      targetId:   String(id),
      details:    JSON.stringify({ name: item.name }),
    },
  });

  res.json({ ok: true });
}

// GET /api/inventory/:id/units
export async function listUnits(req, res) {
  const itemId = Number(req.params.id);
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item) return res.status(404).json({ error: "Item não encontrado" });

  const units = await prisma.inventoryUnit.findMany({
    where:   { itemId },
    orderBy: [{ status: "asc" }, { tombo: "asc" }],
    include: { createdBy: { select: { id: true, name: true } } },
  });
  res.json(units);
}

// POST /api/inventory/:id/units
export async function createUnit(req, res) {
  const itemId = Number(req.params.id);
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item) return res.status(404).json({ error: "Item não encontrado" });

  const parsed = unitSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { tombo, note } = parsed.data;

  if (tombo) {
    const exists = await prisma.inventoryUnit.findFirst({
      where: { itemId, tombo },
    });
    if (exists) return res.status(409).json({ error: "Já existe uma unidade com esse tombo/SN neste item" });
  }

  const unit = await prisma.inventoryUnit.create({
    data: {
      itemId,
      tombo:       tombo || null,
      note:        note || null,
      status:      "DISPONIVEL",
      createdById: req.user.id,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });

  await prisma.auditLog.create({
    data: {
      actorId:    req.user.id,
      actorName:  req.user.name,
      action:     "INVENTORY_UNIT_CREATE",
      targetType: "InventoryUnit",
      targetId:   String(unit.id),
      details:    JSON.stringify({ itemId, itemName: item.name, tombo }),
    },
  });

  res.status(201).json(unit);
}

// PATCH /api/inventory/units/:unitId
export async function updateUnit(req, res) {
  const unitId = Number(req.params.unitId);
  const unit = await prisma.inventoryUnit.findUnique({
    where:   { id: unitId },
    include: { item: true },
  });
  if (!unit) return res.status(404).json({ error: "Unidade não encontrada" });

  const parsed = unitSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { tombo, status, note } = parsed.data;

  if (tombo !== undefined && tombo !== null && tombo !== unit.tombo) {
    const exists = await prisma.inventoryUnit.findFirst({
      where: { itemId: unit.itemId, tombo, NOT: { id: unitId } },
    });
    if (exists) return res.status(409).json({ error: "Já existe uma unidade com esse tombo/SN neste item" });
  }

  const data = {};
  if (tombo  !== undefined) data.tombo  = tombo || null;
  if (status !== undefined) data.status = status;
  if (note   !== undefined) data.note   = note || null;

  const updated = await prisma.inventoryUnit.update({
    where:   { id: unitId },
    data,
    include: { createdBy: { select: { id: true, name: true } } },
  });

  res.json(updated);
}

// DELETE /api/inventory/units/:unitId
export async function deleteUnit(req, res) {
  const unitId = Number(req.params.unitId);
  const unit = await prisma.inventoryUnit.findUnique({
    where:   { id: unitId },
    include: { item: true, checklistItems: true },
  });
  if (!unit) return res.status(404).json({ error: "Unidade não encontrada" });
  if (unit.checklistItems.length > 0) {
    return res.status(400).json({ error: "Não é possível excluir uma unidade vinculada a um checklist" });
  }

  await prisma.inventoryUnit.delete({ where: { id: unitId } });

  await prisma.auditLog.create({
    data: {
      actorId:    req.user.id,
      actorName:  req.user.name,
      action:     "INVENTORY_UNIT_DELETE",
      targetType: "InventoryUnit",
      targetId:   String(unitId),
      details:    JSON.stringify({ itemId: unit.itemId, itemName: unit.item.name, tombo: unit.tombo }),
    },
  });

  res.json({ ok: true });
}
