// Tipos de OS agora vêm da API — /work-order-types
// Este arquivo mantém apenas as constantes de status (imutáveis)

export const OS_STATUS_LABEL = {
  ABERTA:       "Aberta",
  EM_ANDAMENTO: "Em Andamento",
  CONCLUIDA:    "Concluída",
  CANCELADA:    "Cancelada",
};

export const OS_STATUS_STYLE = {
  ABERTA:       "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  EM_ANDAMENTO: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  CONCLUIDA:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  CANCELADA:    "bg-slate-100 text-slate-500 dark:bg-gray-800 dark:text-gray-400",
};
