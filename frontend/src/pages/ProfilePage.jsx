import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { StatusBadge, Spinner } from "../components/ui";
import AppHeader from "../components/AppHeader";
import { User, Building2, Shield, Clock, Ticket, KeyRound, ChevronRight, Search, X, Star, Volume2, Play, Upload, Trash2 } from "lucide-react";
import { maskCpf } from "../lib/cpf";
import { SOUND_THEMES, CUSTOM_THEME_ID, getSelectedThemeId, setSelectedThemeId } from "../lib/sounds";

const ROLE_LABEL = {
  ADMIN:      "Administrador",
  TECHNICIAN: "Técnico",
  USER:       "Usuário",
};

const ROLE_COLOR = {
  ADMIN:      "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-amber-200 dark:ring-amber-700",
  TECHNICIAN: "bg-slate-50 dark:bg-gray-800 text-slate-700 dark:text-gray-300 ring-slate-200 dark:ring-gray-600",
  USER:       "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-emerald-200 dark:ring-emerald-700",
};

const STATUS_GROUPS = [
  { key: "",         label: "Todos"        },
  { key: "active",   label: "Em aberto"    },
  { key: "COMPLETED", label: "Concluídos"  },
];

function isActive(status) {
  return ["OPEN", "VIEWED", "EN_ROUTE", "IN_SERVICE"].includes(status);
}

function StarRating({ ticketId, onDone }) {
  const [hover,    setHover]    = useState(0);
  const [selected, setSelected] = useState(0);
  const [comment,  setComment]  = useState("");
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState("");

  async function submit() {
    if (!selected) return;
    setSaving(true); setErr("");
    try {
      await api.post(`/tickets/${ticketId}/feedback`, { rating: selected, comment: comment || undefined });
      onDone();
    } catch (e) {
      setErr(e.response?.data?.error || "Erro ao enviar avaliação");
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 px-4 pb-3 space-y-2" onClick={(e) => e.preventDefault()}>
      <div className="flex items-center gap-1">
        {[1,2,3,4,5].map((n) => (
          <button
            key={n}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={(e) => { e.preventDefault(); setSelected(n); }}
            className="transition"
            title={n === 1 ? "Ruim" : n === 2 ? "Regular" : n === 3 ? "Bom" : n === 4 ? "Ótimo" : "Excelente"}
          >
            <Star
              size={20}
              className={`transition ${(hover || selected) >= n ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-gray-600"}`}
            />
          </button>
        ))}
        {selected > 0 && (
          <span className="ml-2 text-xs text-slate-400 dark:text-gray-500">
            {["", "Ruim", "Regular", "Bom", "Ótimo", "Excelente"][selected]}
          </span>
        )}
      </div>
      {selected > 0 && (
        <div className="flex gap-2">
          <input
            className="field-input flex-1 text-xs py-1.5"
            placeholder="Comentário opcional..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={300}
          />
          <button
            onClick={(e) => { e.preventDefault(); submit(); }}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition disabled:opacity-60"
          >
            {saving ? "..." : "Enviar"}
          </button>
        </div>
      )}
      {err && <p className="text-xs text-red-500 dark:text-red-400">{err}</p>}
    </div>
  );
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusGroup, setStatusGroup] = useState("");
  const [openFeedback, setOpenFeedback] = useState(null);
  const [soundTheme, setSoundTheme] = useState(() => getSelectedThemeId());
  const [uploadingSound, setUploadingSound] = useState(false);
  const [soundError, setSoundError] = useState("");

  const canCustomSound = user?.role === "TECHNICIAN" || user?.role === "ADMIN";

  function handleSelectSound(id) {
    setSoundTheme(id);
    setSelectedThemeId(id);
  }

  function handleUploadSound(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setSoundError("Selecione um arquivo de áudio (MP3, WAV, OGG ou M4A).");
      return;
    }
    if (file.size > 2.2 * 1024 * 1024) {
      setSoundError("Áudio muito grande. Máximo ~2 MB.");
      return;
    }
    setSoundError("");
    setUploadingSound(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await api.post("/users/me/notification-sound", { audio: reader.result });
        await refreshUser();
        handleSelectSound(CUSTOM_THEME_ID);
      } catch (err) {
        setSoundError(err.response?.data?.error || "Erro ao enviar áudio");
      } finally {
        setUploadingSound(false);
      }
    };
    reader.onerror = () => { setSoundError("Erro ao ler o arquivo"); setUploadingSound(false); };
    reader.readAsDataURL(file);
  }

  async function handleDeleteSound() {
    try {
      await api.delete("/users/me/notification-sound");
      await refreshUser();
      if (soundTheme === CUSTOM_THEME_ID) handleSelectSound("sinos");
    } catch {
      setSoundError("Erro ao remover áudio");
    }
  }

  useEffect(() => {
    api.get("/users/me/tickets")
      .then((r) => setTickets(r.data))
      .finally(() => setLoading(false));
  }, []);

  const activeCount    = tickets.filter((t) => isActive(t.status)).length;
  const completedCount = tickets.filter((t) => t.status === "COMPLETED").length;

  let visible = tickets;
  if (statusGroup === "active")    visible = visible.filter((t) => isActive(t.status));
  if (statusGroup === "COMPLETED") visible = visible.filter((t) => t.status === "COMPLETED");
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    visible = visible.filter((t) =>
      t.ticketNumber?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q)
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <AppHeader />

      <main className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">

        {/* Cabeçalho */}
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-gray-100">Meu perfil</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">Suas informações e chamados abertos</p>
        </div>

        {/* Card do usuário */}
        <div className="card p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-400 text-xl font-bold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-900 dark:text-gray-100 text-base">{user?.name}</div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${ROLE_COLOR[user?.role] || ROLE_COLOR.USER}`}>
                  <Shield size={10} />
                  {ROLE_LABEL[user?.role] || user?.role}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-gray-800/60 px-4 py-3">
              <User size={15} className="text-slate-400 dark:text-gray-500 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs text-slate-400 dark:text-gray-500 mb-0.5">CPF</div>
                <div className="text-sm font-mono font-medium text-slate-800 dark:text-gray-100">
                  {maskCpf(user?.cpf || "")}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-gray-800/60 px-4 py-3">
              <Building2 size={15} className="text-slate-400 dark:text-gray-500 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs text-slate-400 dark:text-gray-500 mb-0.5">Setor</div>
                <div className="text-sm font-medium text-slate-800 dark:text-gray-100 truncate">
                  {user?.department?.name || "—"}
                </div>
              </div>
            </div>

            {user?.unit && (
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-gray-800/60 px-4 py-3">
                <Shield size={15} className="text-slate-400 dark:text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs text-slate-400 dark:text-gray-500 mb-0.5">Núcleo</div>
                  <div className="text-sm font-medium text-slate-800 dark:text-gray-100 truncate">
                    {user.unit.name}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-gray-700/60">
            <Link
              to="/trocar-senha"
              className="inline-flex items-center gap-2 text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium transition"
            >
              <KeyRound size={14} />
              Alterar senha
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>

        {/* Sons de Notificação */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-2 mb-4">
            <Volume2 size={15} />
            Sons de Notificação
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SOUND_THEMES.map((theme) => {
              const active = soundTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => handleSelectSound(theme.id)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left w-full transition ring-1 ${
                    active
                      ? "ring-brand-600 bg-brand-100/60 dark:bg-brand-900/20"
                      : "ring-slate-200 dark:ring-gray-700 bg-slate-50 dark:bg-gray-800/60 hover:bg-slate-100 dark:hover:bg-gray-800"
                  }`}
                >
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    active ? "border-brand-600" : "border-slate-300 dark:border-gray-600"
                  }`}>
                    {active && <div className="h-2 w-2 rounded-full bg-brand-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 dark:text-gray-100">{theme.label}</div>
                    <div className="text-xs text-slate-400 dark:text-gray-500 mt-0.5 leading-snug">{theme.desc}</div>
                  </div>
                  {theme.id !== "silencioso" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); try { theme.play(); } catch {} }}
                      className="p-1.5 rounded-lg text-slate-400 dark:text-gray-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-white dark:hover:bg-gray-700 transition shrink-0"
                      title="Testar som"
                    >
                      <Play size={13} />
                    </button>
                  )}
                </button>
              );
            })}

            {canCustomSound && user.hasCustomNotificationSound && (
              <button
                onClick={() => handleSelectSound(CUSTOM_THEME_ID)}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left w-full transition ring-1 ${
                  soundTheme === CUSTOM_THEME_ID
                    ? "ring-brand-600 bg-brand-100/60 dark:bg-brand-900/20"
                    : "ring-slate-200 dark:ring-gray-700 bg-slate-50 dark:bg-gray-800/60 hover:bg-slate-100 dark:hover:bg-gray-800"
                }`}
              >
                <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  soundTheme === CUSTOM_THEME_ID ? "border-brand-600" : "border-slate-300 dark:border-gray-600"
                }`}>
                  {soundTheme === CUSTOM_THEME_ID && <div className="h-2 w-2 rounded-full bg-brand-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 dark:text-gray-100">Meu áudio</div>
                  <div className="text-xs text-slate-400 dark:text-gray-500 mt-0.5 leading-snug">Arquivo customizado enviado por você</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); new Audio("/api/users/me/notification-sound").play().catch(() => {}); }}
                  className="p-1.5 rounded-lg text-slate-400 dark:text-gray-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-white dark:hover:bg-gray-700 transition shrink-0"
                  title="Testar som"
                >
                  <Play size={13} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteSound(); }}
                  className="p-1.5 rounded-lg text-slate-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-white dark:hover:bg-gray-700 transition shrink-0"
                  title="Remover áudio"
                >
                  <Trash2 size={13} />
                </button>
              </button>
            )}
          </div>

          {canCustomSound && (
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-gray-700/60">
              <label className={`inline-flex items-center gap-2 text-sm font-medium cursor-pointer transition ${
                uploadingSound ? "opacity-60 pointer-events-none" : "text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
              }`}>
                <Upload size={14} />
                {uploadingSound ? "Enviando..." : user.hasCustomNotificationSound ? "Substituir meu áudio" : "Enviar meu áudio"}
                <input type="file" accept="audio/*" className="hidden" onChange={handleUploadSound} disabled={uploadingSound} />
              </label>
              <p className="mt-1 text-xs text-slate-400 dark:text-gray-500">MP3, WAV, OGG ou M4A — máximo ~2 MB. Apenas 1 áudio por conta.</p>
              {soundError && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{soundError}</p>}
            </div>
          )}

          <p className="mt-3 text-xs text-slate-400 dark:text-gray-500">
            Preferência salva neste dispositivo. Cada técnico pode escolher o som que prefere.
          </p>
        </div>

        {/* Chamados abertos */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-2">
              <Ticket size={15} />
              Meus chamados
            </h2>
            <Link to="/novo-chamado" className="btn-primary text-sm py-1.5 px-3">
              + Abrir chamado
            </Link>
          </div>

          {/* Stats rápidos */}
          {!loading && tickets.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: "Total",       value: tickets.length,    color: "text-slate-700 dark:text-gray-200" },
                { label: "Em aberto",   value: activeCount,       color: activeCount > 0 ? "text-brand-600 dark:text-brand-400" : "text-slate-500 dark:text-gray-400" },
                { label: "Concluídos",  value: completedCount,    color: completedCount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-gray-400" },
              ].map((s) => (
                <div key={s.label} className="card px-3 py-2.5 text-center">
                  <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Filtros */}
          {!loading && tickets.length > 0 && (
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {/* Tabs de status */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-gray-800 rounded-lg p-0.5">
                {STATUS_GROUPS.map((g) => (
                  <button
                    key={g.key}
                    onClick={() => setStatusGroup(g.key)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                      statusGroup === g.key
                        ? "bg-white dark:bg-gray-700 text-slate-800 dark:text-gray-100 shadow-sm"
                        : "text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>

              {/* Busca */}
              <div className="relative flex-1 min-w-[180px]">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Número ou categoria..."
                  className="field-input pl-7 py-1.5 text-xs w-full"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    aria-label="Limpar busca"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="h-6 w-6" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="card p-10 text-center">
              <Ticket size={32} className="mx-auto text-slate-300 dark:text-gray-600 mb-3" />
              <div className="font-medium text-slate-600 dark:text-gray-400">Nenhum chamado aberto ainda</div>
              <p className="text-sm text-slate-400 dark:text-gray-500 mt-1">
                Seus chamados aparecerão aqui quando você abrir um
              </p>
            </div>
          ) : visible.length === 0 ? (
            <div className="card p-10 text-center">
              <Search size={28} className="mx-auto text-slate-300 dark:text-gray-600 mb-2" />
              <div className="font-medium text-slate-600 dark:text-gray-400">Nenhum chamado encontrado</div>
              <button
                onClick={() => { setSearchQuery(""); setStatusGroup(""); }}
                className="text-sm text-brand-600 dark:text-brand-400 hover:underline mt-2"
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            <div className="card divide-y divide-slate-100 dark:divide-gray-700/60">
              {visible.map((t) => {
                const needsFeedback = t.status === "COMPLETED" && !t.hasFeedback;
                const isFeedbackOpen = openFeedback === t.id;
                return (
                  <div key={t.id} className="divide-y divide-slate-50 dark:divide-gray-800">
                    <Link
                      to={`/acompanhar/${t.ticketNumber}`}
                      className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-gray-800/60 transition"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-semibold text-slate-600 dark:text-gray-300">
                            {t.ticketNumber}
                          </span>
                          <StatusBadge status={t.status} />
                          {needsFeedback && (
                            <button
                              onClick={(e) => { e.preventDefault(); setOpenFeedback(isFeedbackOpen ? null : t.id); }}
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition"
                            >
                              <Star size={9} className="fill-amber-400 text-amber-400" />
                              Avaliar
                            </button>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-gray-400 mt-0.5 flex items-center gap-2">
                          <span>{t.category}</span>
                          {t.unit && <><span>·</span><span>{t.unit}</span></>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <div className="text-xs text-slate-400 dark:text-gray-500 flex items-center gap-1 justify-end">
                            <Clock size={10} />
                            {new Date(t.openedAt).toLocaleDateString("pt-BR")}
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-slate-300 dark:text-gray-600" />
                      </div>
                    </Link>
                    {needsFeedback && isFeedbackOpen && (
                      <StarRating
                        ticketId={t.id}
                        onDone={() => {
                          setOpenFeedback(null);
                          setTickets((prev) => prev.map((x) => x.id === t.id ? { ...x, hasFeedback: true } : x));
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
