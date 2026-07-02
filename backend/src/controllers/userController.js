import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { stripCpf, isValidCpf, maskCpf } from "../utils/cpf.js";
import { toTitleCase } from "../utils/name.js";
import { createAuditLog } from "./auditController.js";
import { setAuthCookie } from "../utils/authCookie.js";
import {
  saveNotificationSound, resolveNotificationSoundPath,
  deleteNotificationSoundFile, mimeForSoundFilename, MAX_AUDIO_B64,
} from "../utils/notificationSound.js";

const VALID_PREFIXOS = ["GOVERNO", "TERCEIRIZADO", "ESTAGIARIO"];

const registerSchema = z.object({
  name:         z.string().min(3, "Nome muito curto"),
  cpf:          z.string(),
  password:     z.string().min(6, "Senha mínima de 6 caracteres"),
  departmentId: z.number().int().positive("Selecione um setor"),
  matricula:    z.string().optional().nullable(),
  prefixo:      z.enum(["GOVERNO", "TERCEIRIZADO", "ESTAGIARIO"]).optional().nullable(),
  email:        z.string().email("E-mail inválido"),
  telefone:     z.string().min(10, "Telefone inválido"),
  isChefe:      z.boolean().optional().default(false),
});

// POST /api/auth/register — público, cria conta ativa imediatamente
export async function register(req, res) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });
  }
  const { name, password, departmentId, matricula, prefixo, email, telefone, isChefe } = parsed.data;
  const cleanCpf = stripCpf(parsed.data.cpf);
  if (!isValidCpf(cleanCpf)) {
    return res.status(400).json({ error: "CPF inválido" });
  }
  const exists = await prisma.user.findUnique({ where: { cpf: cleanCpf } });
  if (exists) {
    return res.status(409).json({ error: "CPF já cadastrado" });
  }

  const dept = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!dept || !dept.active) {
    return res.status(400).json({ error: "Setor inválido ou inativo" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      name: toTitleCase(name),
      cpf: cleanCpf,
      passwordHash,
      role: "USER",
      active: true,
      departmentId,
      matricula: matricula || null,
      prefixo: prefixo || null,
      email: email || null,
      telefone: telefone || null,
      isChefe: isChefe ?? false,
    },
  });
  res.status(201).json({ ok: true });
}

// GET /api/users — lista todos os usuários (ADMIN only)
export async function listUsers(req, res) {
  const { role, active } = req.query;
  const where = {};
  if (role) where.role = role;
  if (active !== undefined) where.active = active === "true";

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      cpf: true,
      role: true,
      active: true,
      isChefe: true,
      isGtiChief: true,
      matricula: true,
      prefixo: true,
      email: true,
      telefone: true,
      nucleoResponsavel: true,
      createdAt: true,
      unit: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      chiefDepartments: {
        select: { department: { select: { id: true, name: true } } },
        orderBy: { department: { name: "asc" } },
      },
      _count: {
        select: {
          assignedTickets: { where: { status: "COMPLETED" } },
          openedTickets: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { createdAt: "desc" }],
  });
  res.json(users.map((u) => ({
    ...u,
    cpf: maskCpf(u.cpf),
    chiefDepartments: u.chiefDepartments.map((cd) => cd.department),
  })));
}

// PATCH /api/users/:id — atualiza usuário (ADMIN only)
export async function updateUser(req, res) {
  const id = Number(req.params.id);
  const {
    active, unitId, departmentId, role, name, isChefe, isGtiChief,
    email, telefone, matricula, prefixo, nucleoResponsavel, chiefDepartmentIds,
  } = req.body || {};

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

  if (id === req.user.id && active === false) {
    return res.status(400).json({ error: "Você não pode desativar sua própria conta" });
  }

  const data = {};
  if (active !== undefined) data.active = active;
  if (unitId !== undefined) data.unitId = unitId ? Number(unitId) : null;
  if (departmentId !== undefined) {
    if (departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: Number(departmentId) } });
      if (!dept || !dept.active) return res.status(400).json({ error: "Setor inválido ou inativo" });
    }
    data.departmentId = departmentId ? Number(departmentId) : null;
  }
  if (isChefe !== undefined)    data.isChefe    = Boolean(isChefe);
  if (isGtiChief !== undefined) data.isGtiChief = Boolean(isGtiChief);
  if (email !== undefined) data.email = email || null;
  if (telefone !== undefined) data.telefone = telefone || null;
  if (matricula !== undefined) data.matricula = matricula || null;
  if (nucleoResponsavel !== undefined) {
    const validNucleos = ["NMT", "NIR", "NSS"];
    if (nucleoResponsavel && !validNucleos.includes(nucleoResponsavel)) {
      return res.status(400).json({ error: "Núcleo inválido" });
    }
    data.nucleoResponsavel = nucleoResponsavel || null;
  }
  if (prefixo !== undefined) {
    if (prefixo && !VALID_PREFIXOS.includes(prefixo)) {
      return res.status(400).json({ error: "Prefixo inválido" });
    }
    data.prefixo = prefixo || null;
  }

  if (name !== undefined) {
    const trimmed = name.trim();
    if (trimmed.length < 3) return res.status(400).json({ error: "Nome muito curto (mínimo 3 caracteres)" });
    data.name = toTitleCase(trimmed);
  }

  if (role !== undefined) {
    const validRoles = ["USER", "TECHNICIAN", "CHEFE_SETOR", "ADMIN"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: "Papel inválido" });
    }
    if ((role === "ADMIN" || user.role === "ADMIN") && req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Apenas administradores podem alterar permissões de administrador" });
    }
    if (id === req.user.id && role !== "ADMIN") {
      return res.status(400).json({ error: "Você não pode remover sua própria permissão de administrador" });
    }
    data.role = role;
  }

  // Setores sob chefia (um chefe de setor pode responder por mais de um)
  const nextRole = data.role ?? user.role;
  let chiefDeptIds = null;
  if (chiefDepartmentIds !== undefined) {
    if (nextRole !== "CHEFE_SETOR") {
      return res.status(400).json({ error: "Apenas chefes de setor podem ter setores sob chefia" });
    }
    if (!Array.isArray(chiefDepartmentIds)) {
      return res.status(400).json({ error: "Lista de setores inválida" });
    }
    chiefDeptIds = [...new Set(chiefDepartmentIds.map(Number))].filter((n) => Number.isInteger(n) && n > 0);
    if (chiefDeptIds.length > 0) {
      const validCount = await prisma.department.count({ where: { id: { in: chiefDeptIds }, active: true } });
      if (validCount !== chiefDeptIds.length) {
        return res.status(400).json({ error: "Um ou mais setores selecionados são inválidos" });
      }
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id },
      data,
      include: {
        unit: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });

    if (chiefDeptIds !== null) {
      // Lista explícita enviada pelo admin — substitui os setores sob chefia
      await tx.departmentChief.deleteMany({ where: { userId: id } });
      if (chiefDeptIds.length > 0) {
        await tx.departmentChief.createMany({
          data: chiefDeptIds.map((deptId) => ({ userId: id, departmentId: deptId })),
        });
      }
    } else if (data.role === "CHEFE_SETOR" && user.role !== "CHEFE_SETOR") {
      // Promoção sem lista explícita — vira chefe do seu próprio setor por padrão
      const existing = await tx.departmentChief.count({ where: { userId: id } });
      if (existing === 0 && u.departmentId) {
        await tx.departmentChief.create({ data: { userId: id, departmentId: u.departmentId } });
      }
    } else if (data.role !== undefined && data.role !== "CHEFE_SETOR" && user.role === "CHEFE_SETOR") {
      // Rebaixamento — revoga toda a alçada de aprovação
      await tx.departmentChief.deleteMany({ where: { userId: id } });
    }

    const chiefDepartments = await tx.departmentChief.findMany({
      where: { userId: id },
      select: { department: { select: { id: true, name: true } } },
      orderBy: { department: { name: "asc" } },
    });

    return { ...u, chiefDepartments: chiefDepartments.map((cd) => cd.department) };
  });

  // Notifica via Socket.io para que a sessão do usuário afetado atualize imediatamente
  if (data.role !== undefined || data.active !== undefined || data.nucleoResponsavel !== undefined || data.isGtiChief !== undefined) {
    const io = req.app.get("io");
    if (io) {
      io.emit("user:updated", {
        id: updated.id,
        role: updated.role,
        active: updated.active,
        nucleoResponsavel: updated.nucleoResponsavel,
      });
    }
  }

  const changedFields = Object.keys(data).join(", ");
  await createAuditLog(prisma, {
    actorId: req.user.id, actorName: req.user.name,
    action: "UPDATE_USER", targetType: "User", targetId: id,
    details: `Campos alterados: ${changedFields} | Usuário: ${user.name}`,
  });

  res.json({
    id: updated.id,
    name: updated.name,
    role: updated.role,
    active: updated.active,
    isChefe: updated.isChefe,
    isGtiChief: updated.isGtiChief,
    matricula: updated.matricula,
    prefixo: updated.prefixo,
    email: updated.email,
    telefone: updated.telefone,
    nucleoResponsavel: updated.nucleoResponsavel,
    unit: updated.unit,
    department: updated.department,
    chiefDepartments: updated.chiefDepartments,
  });
}

// DELETE /api/users/:id — exclui usuário (ADMIN only)
export async function deleteUser(req, res) {
  const id = Number(req.params.id);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
  if (id === req.user.id) {
    return res.status(400).json({ error: "Você não pode excluir sua própria conta" });
  }
  if (user.role === "ADMIN") {
    return res.status(403).json({ error: "Não é possível excluir um administrador" });
  }
  await prisma.user.delete({ where: { id } });
  await createAuditLog(prisma, {
    actorId: req.user.id, actorName: req.user.name,
    action: "DELETE_USER", targetType: "User", targetId: id,
    details: `Usuário excluído: ${user.name} (CPF: ${user.cpf})`,
  });
  res.json({ ok: true });
}

// POST /api/users/:id/reset-password — redefine senha para abc@123
export async function resetPassword(req, res) {
  const id = Number(req.params.id);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
  if (user.role === "ADMIN" && id !== req.user.id) {
    return res.status(403).json({ error: "Não é possível resetar senha de outro administrador" });
  }

  const DEFAULT_PASSWORD = "abc@123";
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  await prisma.user.update({
    where: { id },
    data: { passwordHash, mustChangePassword: true },
  });

  res.setHeader("Cache-Control", "no-store");
  res.json({ ok: true });
}

// POST /api/auth/change-password — usuário troca a própria senha
export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: "Nova senha deve ter ao menos 6 caracteres" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

  // Se não é troca forçada (mustChangePassword), valida senha atual
  if (!user.mustChangePassword) {
    if (!currentPassword) {
      return res.status(400).json({ error: "Senha atual é obrigatória" });
    }
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) return res.status(400).json({ error: "Senha atual incorreta" });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  // Re-emite o token com mustChangePassword: false para evitar re-login obrigatório
  const expiresIn = process.env.JWT_EXPIRES_IN || "8h";
  const newToken = jwt.sign(
    { id: updated.id, role: updated.role, name: updated.name, unitId: updated.unitId, mustChangePassword: false, nucleoResponsavel: updated.nucleoResponsavel ?? req.user.nucleoResponsavel },
    process.env.JWT_SECRET,
    { expiresIn }
  );
  setAuthCookie(res, newToken);

  res.json({ ok: true });
}

// GET /api/users/me/tickets — chamados abertos pelo usuário logado
export async function myTickets(req, res) {
  const tickets = await prisma.ticket.findMany({
    where: { openedById: req.user.id },
    include: { category: true, unit: true, feedback: { select: { id: true } } },
    orderBy: { openedAt: "desc" },
    take: 50,
  });
  res.json(tickets.map((t) => ({
    id: t.id,
    ticketNumber: t.ticketNumber,
    status: t.status,
    priority: t.priority,
    category: t.category?.name,
    categoryId: t.category?.id,
    department: t.department,
    unit: t.unit?.name || null,
    slaDeadline: t.slaDeadline,
    openedAt: t.openedAt,
    completedAt: t.completedAt,
    hasFeedback: !!t.feedback,
  })));
}

// POST /api/users/me/notification-sound — técnico/admin envia áudio customizado (substitui o anterior)
export async function uploadNotificationSound(req, res) {
  const { audio } = req.body || {};
  if (!audio || typeof audio !== "string") {
    return res.status(400).json({ error: "Áudio ausente" });
  }
  if (audio.length > MAX_AUDIO_B64) {
    return res.status(400).json({ error: "Áudio muito grande. Máximo ~2 MB." });
  }

  const filename = await saveNotificationSound(audio, req.user.id);
  if (!filename) {
    return res.status(400).json({ error: "Áudio inválido. Use MP3, WAV, OGG ou M4A." });
  }

  await prisma.user.update({
    where: { id: req.user.id },
    data: { notificationSoundFile: filename },
  });

  res.json({ ok: true });
}

// DELETE /api/users/me/notification-sound — remove o áudio customizado
export async function removeNotificationSound(req, res) {
  await deleteNotificationSoundFile(req.user.id);
  await prisma.user.update({
    where: { id: req.user.id },
    data: { notificationSoundFile: null },
  });
  res.json({ ok: true });
}

// GET /api/users/me/notification-sound — serve o áudio customizado do usuário logado
export async function getNotificationSound(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { notificationSoundFile: true },
  });
  if (!user?.notificationSoundFile) {
    return res.status(404).json({ error: "Nenhum áudio customizado" });
  }
  const filePath = resolveNotificationSoundPath(req.user.id, user.notificationSoundFile);
  if (!filePath) return res.status(404).json({ error: "Nenhum áudio customizado" });

  res.setHeader("Content-Type", mimeForSoundFilename(user.notificationSoundFile));
  res.setHeader("Cache-Control", "private, max-age=86400");
  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: "Nenhum áudio customizado" });
  });
}

