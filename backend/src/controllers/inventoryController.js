import { z } from "zod";
import { prisma } from "../config/prisma.js";

const itemSchema = z.object({
  name:        z.string().min(2, "Nome deve ter ao menos 2 caracteres").max(191),
  code:        z.string().max(191).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  quantity:    z.number().int().min(0, "Quantidade não pode ser negativa").default(0),
  unitMeasure: z.string().max(50).default("un"),
  category:    z.string().max(191).nullable().optional(),
  nucleo:      z.enum(["NMT", "NIR"]).nullable().optional(),
});

const movementSchema = z.object({
  type:     z.enum(["ENTRADA", "SAIDA", "AJUSTE"]),
  quantity: z.number().int().min(1, "Quantidade deve ser ao menos 1"),
  note:     z.string().max(1000).nullable().optional(),
});

// GET /api/inventory
export async function listInventory(req, res) {
  const { search, category, status, nucleo, limit = "100", offset = "0" } = req.query;

  const where = {};
  if (status) where.status = status;
  if (category) where.category = category;
  if (nucleo) where.nucleo = nucleo;
  if (search) {
    where.OR = [
      { name:     { contains: search } },
      { code:     { contains: search } },
      { category: { contains: search } },
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
        _count:    { select: { movements: true } },
      },
    }),
    prisma.inventoryItem.count({ where }),
  ]);

  res.json({ items, total });
}

// GET /api/inventory/:id
export async function getInventoryItem(req, res) {
  const id = Number(req.params.id);
  const item = await prisma.inventoryItem.findUnique({
    where:   { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      movements: {
        orderBy: { createdAt: "desc" },
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

  const { name, code, description, quantity, unitMeasure, category, nucleo } = parsed.data;

  if (code) {
    const exists = await prisma.inventoryItem.findFirst({ where: { code } });
    if (exists) return res.status(409).json({ error: "Já existe um item com esse código" });
  }

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.inventoryItem.create({
      data: {
        name,
        code:        code || null,
        description: description || null,
        quantity,
        unitMeasure,
        category:    category || null,
        nucleo:      nucleo || null,
        createdById: req.user.id,
      },
    });

    if (quantity > 0) {
      await tx.inventoryMovement.create({
        data: {
          itemId:      created.id,
          type:        "ENTRADA",
          quantity,
          note:        "Estoque inicial",
          createdById: req.user.id,
        },
      });
    }

    return created;
  });

  await prisma.auditLog.create({
    data: {
      actorId:    req.user.id,
      actorName:  req.user.name,
      action:     "INVENTORY_CREATE",
      targetType: "InventoryItem",
      targetId:   String(item.id),
      details:    JSON.stringify({ name, code, quantity }),
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

  const { code, ...rest } = parsed.data;

  if (code !== undefined && code !== null && code !== item.code) {
    const exists = await prisma.inventoryItem.findFirst({
      where: { code, NOT: { id } },
    });
    if (exists) return res.status(409).json({ error: "Já existe um item com esse código" });
  }

  const data = { ...rest };
  if (code !== undefined) data.code = code || null;

  const updated = await prisma.inventoryItem.update({ where: { id }, data });

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

// DELETE /api/inventory/:id — admin only
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
      details:    JSON.stringify({ name: item.name, code: item.code }),
    },
  });

  res.json({ ok: true });
}

// POST /api/inventory/:id/movements
export async function addMovement(req, res) {
  const itemId = Number(req.params.id);
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item) return res.status(404).json({ error: "Item não encontrado" });

  const parsed = movementSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { type, quantity, note } = parsed.data;

  let newQuantity = item.quantity;
  if (type === "ENTRADA") {
    newQuantity += quantity;
  } else if (type === "SAIDA") {
    newQuantity -= quantity;
    if (newQuantity < 0) {
      return res.status(400).json({ error: "Quantidade insuficiente no estoque" });
    }
  } else {
    // AJUSTE — quantity é o novo valor absoluto
    newQuantity = quantity;
  }

  const [movement] = await prisma.$transaction([
    prisma.inventoryMovement.create({
      data: {
        itemId,
        type,
        quantity,
        note:        note || null,
        createdById: req.user.id,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    }),
    prisma.inventoryItem.update({
      where: { id: itemId },
      data:  { quantity: newQuantity },
    }),
  ]);

  res.status(201).json({ movement, newQuantity });
}

// GET /api/inventory/categories — lista categorias únicas cadastradas
export async function listInventoryCategories(req, res) {
  const rows = await prisma.inventoryItem.findMany({
    where:    { category: { not: null } },
    select:   { category: true },
    distinct: ["category"],
    orderBy:  { category: "asc" },
  });
  res.json(rows.map((r) => r.category));
}
