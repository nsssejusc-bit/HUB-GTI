import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";

const TEAM = [
  {
    name:     "Gabriel Nery",
    role:     "Gerente de Tecnlogia da Informação",
    linkedin: "https://www.linkedin.com/in/gabriel-nery-b87a0b258/",
    avatar:   "https://unavatar.io/linkedin/gabriel-nery-b87a0b258",
    initials: "GN",
    color:    "from-brand-500 to-brand-700",
  },
  {
    name:     "Guilherme Oliveira",
    role:     "Idealizador & Desenvolvedor",
    linkedin: "https://www.linkedin.com/in/oliveiraguilherme03",
    avatar:   "https://unavatar.io/linkedin/oliveiraguilherme03",
    initials: "GO",
    color:    "from-violet-500 to-violet-700",
    highlight: true,
  },
  {
    name:     "Risonaldo Maciel",
    role:     "Coordenador do Projeto",
    linkedin: "https://www.linkedin.com/in/risonaldo-maciel-66126871/",
    avatar:   "https://unavatar.io/linkedin/risonaldo-maciel-66126871",
    initials: "RM",
    color:    "from-emerald-500 to-emerald-700",
  },
];

function Avatar({ member }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={`h-24 w-24 rounded-full bg-gradient-to-br ${member.color} p-0.5 shadow-lg`}>
      {failed ? (
        <div className="h-full w-full rounded-full bg-gray-900 flex items-center justify-center">
          <span className="text-2xl font-bold text-white">{member.initials}</span>
        </div>
      ) : (
        <img
          src={member.avatar}
          alt={member.name}
          onError={() => setFailed(true)}
          className="h-full w-full rounded-full object-cover bg-gray-800"
        />
      )}
    </div>
  );
}

function LinkedinIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
      <rect x="2" y="9" width="4" height="12"/>
      <circle cx="4" cy="4" r="2"/>
    </svg>
  );
}

export default function TeamPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-gray-950 flex flex-col">

      {/* ── Hero ── */}
      <div className="bg-gradient-to-b from-brand-700 to-brand-500 px-6 py-14 text-center">
        <button
          onClick={() => navigate(-1)}
          className="absolute top-5 left-5 flex items-center gap-1.5 text-white/70 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft size={15} />
          Voltar
        </button>

        <p className="text-brand-200 text-xs font-semibold uppercase tracking-widest mb-3">
          Gerência de Tecnologia da Informação
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">
          HUB GTI - SEJUSC
        </h1>
        <p className="text-brand-100 text-sm max-w-xs mx-auto leading-relaxed">
          Desenvolvido pelo time de Desenvolvimento da<br />
          Secretaria de Estado de Justiça, <br />
          Direitos Humanos e Cidadania -  SEJUSC
        </p>
      </div>

      {/* ── Cards ── */}
      <div className="flex-1 px-4 py-10">
        <p className="text-center text-xs font-semibold text-slate-400 dark:text-gray-500 uppercase tracking-widest mb-8">
          Equipe
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl mx-auto">
          {TEAM.map((member) => (
            <div
              key={member.name}
              className={`
                bg-white dark:bg-gray-900 rounded-2xl shadow-md
                flex flex-col items-center text-center px-6 py-7
                border transition-all duration-200 hover:shadow-xl hover:-translate-y-1
                border-slate-200 dark:border-gray-800
              `}
            >
              <Avatar member={member} />

              <h2 className="mt-4 text-sm font-bold text-slate-800 dark:text-gray-100">
                {member.name}
              </h2>
              <p className="mt-1 text-xs text-slate-400 dark:text-gray-500">
                {member.role}
              </p>

              <a
                href={member.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0A66C2] hover:bg-[#004182] text-white text-xs font-semibold transition-colors shadow-sm"
              >
                <LinkedinIcon size={13} />
                Ver LinkedIn
                <ExternalLink size={10} className="opacity-70" />
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* ── Rodapé ── */}
      <p className="text-center text-xs text-slate-300 dark:text-gray-700 pb-8">
        © {new Date().getFullYear()} GTI · SEJUSC — Todos os direitos reservados
      </p>
    </div>
  );
}
