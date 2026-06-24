import { z } from "zod";
import { prisma } from "../config/prisma.js";

const fieldSchema = z.object({
  key:      z.string().min(1).max(50).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  label:    z.string().min(1).max(100),
  type:     z.enum(["text", "textarea", "number", "date", "datetime", "select", "checkbox"]),
  required: z.boolean().default(false),
  options:  z.array(z.string().min(1).max(200)).optional(),
});

const typeSchema = z.object({
  name:      z.string().min(2).max(100),
  color:     z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
  active:    z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  nucleos:   z.array(z.enum(["NMT", "NIR", "NSS"])).nullable().optional(),
  fields:    z.array(fieldSchema).default([]),
});

export async function listWorkOrderTypes(req, res) {
  const { includeInactive } = req.query;
  const where = includeInactive === "true" ? {} : { active: true };
  const types = await prisma.workOrderType.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  res.json(types);
}

export async function createWorkOrderType(req, res) {
  const parsed = typeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });

  const data = parsed.data;
  const keys = data.fields.map((f) => f.key);
  if (new Set(keys).size !== keys.length) {
    return res.status(400).json({ error: "Chaves de campo duplicadas" });
  }

  const type = await prisma.workOrderType.create({
    data: {
      name:      data.name,
      color:     data.color,
      active:    data.active,
      sortOrder: data.sortOrder,
      nucleos:   data.nucleos ?? null,
      fields:    data.fields,
    },
  });
  res.status(201).json(type);
}

export async function updateWorkOrderType(req, res) {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const existing = await prisma.workOrderType.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Tipo não encontrado" });

  const parsed = typeSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });

  const data = parsed.data;
  if (data.fields) {
    const keys = data.fields.map((f) => f.key);
    if (new Set(keys).size !== keys.length) {
      return res.status(400).json({ error: "Chaves de campo duplicadas" });
    }
  }

  const updated = await prisma.workOrderType.update({ where: { id }, data });
  res.json(updated);
}

export async function deleteWorkOrderType(req, res) {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const existing = await prisma.workOrderType.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Tipo não encontrado" });

  const inUse = await prisma.workOrder.count({ where: { tipoId: id } });
  if (inUse > 0) return res.status(400).json({ error: `Este tipo está em uso por ${inUse} OS(s). Desative-o em vez de excluir.` });

  await prisma.workOrderType.delete({ where: { id } });
  res.status(204).end();
}

export async function reorderWorkOrderTypes(req, res) {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: "Formato inválido: esperado { order: [{id, sortOrder}] }" });

  await prisma.$transaction(
    order.map(({ id, sortOrder }) =>
      prisma.workOrderType.update({ where: { id: Number(id) }, data: { sortOrder: Number(sortOrder) } })
    )
  );
  res.status(204).end();
}
