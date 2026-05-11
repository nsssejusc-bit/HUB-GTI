export const OS_STATUS = {
  ABERTA:       "ABERTA",
  EM_ANDAMENTO: "EM_ANDAMENTO",
  CONCLUIDA:    "CONCLUIDA",
  CANCELADA:    "CANCELADA",
};

const TRANSITIONS = {
  ABERTA:       ["EM_ANDAMENTO", "CANCELADA"],
  EM_ANDAMENTO: ["CONCLUIDA",    "CANCELADA"],
  CONCLUIDA:    [],
  CANCELADA:    [],
};

export function canOsTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

export function allowedOsNext(from) {
  return TRANSITIONS[from] || [];
}
