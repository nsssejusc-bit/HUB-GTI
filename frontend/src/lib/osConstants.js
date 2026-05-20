export const TIPO_LABELS = {
  VISITA_TECNICA:           "Visita Técnica",
  TROCA_EQUIPAMENTO:        "Troca de Equipamento",
  ENTREGA:                  "Entrega",
  MANUTENCAO_REDE:          "Manutenção de Rede",
  MANUTENCAO_CAMERA:        "Manutenção de Câmera",
  RECOLHIMENTO_EQUIPAMENTO: "Recolhimento de Equipamento",
  ACAO:                     "Ação",
  OUTRO:                    "Outro",
};

export const TIPO_OPTIONS = [
  { value: "",                         label: "Todos os tipos"             },
  { value: "VISITA_TECNICA",           label: "Visita Técnica"             },
  { value: "TROCA_EQUIPAMENTO",        label: "Troca de Equipamento"       },
  { value: "ENTREGA",                  label: "Entrega"                    },
  { value: "MANUTENCAO_REDE",          label: "Manutenção de Rede"         },
  { value: "MANUTENCAO_CAMERA",        label: "Manutenção de Câmera"       },
  { value: "RECOLHIMENTO_EQUIPAMENTO", label: "Recolhimento de Equipamento"},
  { value: "ACAO",                     label: "Ação"                       },
  { value: "OUTRO",                    label: "Outro"                      },
];

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
