import { prisma } from "../config/prisma.js";

const ALLOWED_FLAGS = ["HOME_ALERT_MESSAGE", "FEEDBACK_ENABLED", "EMERGENCY_CONTACT", "MANUAL_TIPS"];

export async function getAdminFlags(req, res) {
  const flags = await prisma.configFlag.findMany({ orderBy: { key: "asc" } });
  const db = Object.fromEntries(flags.map((f) => [f.key, f.value]));

  // Retorna valores efetivos: DB sobrepõe env var / padrão
  res.json({
    HOME_ALERT_MESSAGE: db.HOME_ALERT_MESSAGE ?? "",
    FEEDBACK_ENABLED:   db.FEEDBACK_ENABLED   ?? (process.env.FEEDBACK_ENABLED === "true" ? "true" : "false"),
    EMERGENCY_CONTACT:  db.EMERGENCY_CONTACT  ?? "",
    MANUAL_TIPS:        db.MANUAL_TIPS        ?? "",
  });
}

export async function setAdminFlags(req, res) {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body))
    return res.status(400).json({ error: "Body deve ser um objeto { chave: valor }" });

  const ops = Object.entries(body)
    .filter(([k]) => ALLOWED_FLAGS.includes(k))
    .map(([key, value]) =>
      prisma.configFlag.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    );

  if (ops.length === 0)
    return res.status(400).json({ error: "Nenhuma flag válida fornecida" });

  await prisma.$transaction(ops);
  res.json({ ok: true });
}
