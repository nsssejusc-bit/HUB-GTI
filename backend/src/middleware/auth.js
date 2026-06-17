import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";

function extractToken(req) {
  if (req.cookies?.hd_token) return req.cookies.hd_token;
  const [, token] = (req.headers.authorization || "").split(" ");
  return token || null;
}

// Rotas acessíveis mesmo quando mustChangePassword === true
const ALLOWED_WHILE_FORCED = ["/auth/change-password", "/auth/me", "/auth/logout"];

export async function authRequired(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "Token ausente" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);

    // Garante que role/active reflitam o estado atual do banco,
    // independente do que estava no JWT quando foi emitido
    const dbUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: true, active: true, nucleoResponsavel: true },
    });
    if (!dbUser || !dbUser.active) {
      return res.status(401).json({ error: "Token inválido ou expirado" });
    }
    req.user = { ...req.user, role: dbUser.role, nucleoResponsavel: dbUser.nucleoResponsavel };

    if (req.user.mustChangePassword && !ALLOWED_WHILE_FORCED.some((p) => req.path.endsWith(p))) {
      return res.status(403).json({ error: "Troque sua senha antes de continuar", code: "MUST_CHANGE_PASSWORD" });
    }

    next();
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
}

export function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      // token inválido — ignora
    }
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Acesso negado" });
    }
    next();
  };
}
