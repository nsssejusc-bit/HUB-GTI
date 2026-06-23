import webpush from "web-push";
import { prisma } from "../config/prisma.js";

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:ti@sejusc.am.gov.br",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

export async function subscribePush(req, res) {
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: "Subscription inválida" });
  }

  await prisma.pushSubscription.upsert({
    where:  { userId: req.user.id },
    update: { endpoint, p256dh: keys.p256dh, auth: keys.auth },
    create: { userId: req.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
  });

  res.json({ ok: true });
}

export async function unsubscribePush(req, res) {
  await prisma.pushSubscription.deleteMany({ where: { userId: req.user.id } });
  res.json({ ok: true });
}

const STATUS_PT = {
  OPEN:       "Em aberto",
  VIEWED:     "Em análise",
  EN_ROUTE:   "Técnico a caminho",
  IN_SERVICE: "Em atendimento",
  COMPLETED:  "Concluído",
  CANCELADO:  "Cancelado",
};

export async function sendPushToUser(userId, payload) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

  const sub = await prisma.pushSubscription.findUnique({ where: { userId } });
  if (!sub) return;

  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    );
  } catch (err) {
    // Subscription expirada — remove do banco
    if (err.statusCode === 410 || err.statusCode === 404) {
      await prisma.pushSubscription.deleteMany({ where: { userId } }).catch(() => {});
    }
  }
}

export function buildStatusPush(ticket, toStatus) {
  return {
    title: `Chamado ${ticket.ticketNumber}`,
    body:  STATUS_PT[toStatus] || toStatus,
    tag:   `ticket-${ticket.id}`,
    url:   `/acompanhar/${ticket.ticketNumber}`,
  };
}
