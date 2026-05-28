export const STATUS_ORDER = ["OPEN", "VIEWED", "EN_ROUTE", "IN_SERVICE", "COMPLETED"];

export const STATUS_LABEL = {
  OPEN: "Aberto",
  VIEWED: "Visualizado",
  EN_ROUTE: "Técnico a caminho",
  IN_SERVICE: "Em atendimento",
  COMPLETED: "Concluído",
};

export function statusIndex(s) {
  return STATUS_ORDER.indexOf(s);
}

// Timestamp relativo: "agora", "há 5 min", "há 2h", ou data curta
export function formatRelative(isoDate) {
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (diff < 60)    return "agora";
  if (diff < 3600)  return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  return new Date(isoDate).toLocaleDateString("pt-BR");
}

export function formatElapsed(fromIso, toIso = null, nowMs = null) {
  const start = new Date(fromIso).getTime();
  // nowMs pode ser passado pelo chamador (usando serverNow()); fallback para Date.now()
  const end = toIso ? new Date(toIso).getTime() : (nowMs ?? Date.now());
  const mins = Math.max(0, Math.floor((end - start) / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return `${h}h ${m}min`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}
