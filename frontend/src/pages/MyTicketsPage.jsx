import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { StatusBadge, Spinner } from "../components/ui";
import AppHeader from "../components/AppHeader";
import { Ticket, Search, X, ChevronRight, RefreshCw, AlertCircle } from "lucide-react";
import { STATUS_LABEL, formatRelative } from "../lib/statuses";

const TABS = [
  { key: "",          label: "Todos"     },
  { key: "active",    label: "Em aberto" },
  { key: "COMPLETED", label: "Concluídos"},
];

function isActive(status) {
  return ["OPEN", "VIEWED", "EN_ROUTE", "IN_SERVICE"].includes(status);
}

export default function MyTicketsPage() {
  const { user } = useAuth();
  const [tickets,     setTickets]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [tab,         setTab]         = useState("");
  const [search,      setSearch]      = useState("");
  const [refreshing,  setRefreshing]  = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError("");
    try {
      const r = await api.get("/users/me/tickets");
      setTickets(r.data);
    } catch {
      setError("Não foi possível carregar seus chamados.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeCount    = tickets.filter((t) => isActive(t.status)).length;
  const completedCount = tickets.filter((t) => t.status === "COMPLETED").length;

  let visible = tickets;
  if (tab === "active")    visible = visible.filter((t) => isActive(t.status));
  if (tab === "COMPLETED") visible = visible.filter((t) => t.status === "COMPLETED");
  if (search) {
    const q = search.toLowerCase();
    visible = visible.filter(
      (t) =>
        t.ticketNumber?.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q) ||
        t.department?.toLowerCase().includes(q),
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <AppHeader />

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Título */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-gray-100">Meus chamados</h1>
            <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">
              Olá, {user?.name?.split(" ")[0]}. Acompanhe o status dos seus chamados abertos.
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400 transition disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total",      value: tickets.length,  color: "text-slate-700 dark:text-gray-200" },
            { label: "Em aberto",  value: activeCount,     color: "text-brand-600 dark:text-brand-400" },
            { label: "Concluídos", value: completedCount,  color: "text-emerald-600 dark:text-emerald-400" },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700 p-4 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Tabs */}
          <div className="flex bg-white dark:bg-gray-900 rounded-lg border border-slate-200 dark:border-gray-700 p-1 gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 text-sm rounded-md font-medium transition whitespace-nowrap ${
                  tab === t.key
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por número, categoria..."
              className="w-full pl-9 pr-9 py-2 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-slate-700 dark:text-gray-200 placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-gray-300">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-16 text-slate-500 dark:text-gray-400">
            <AlertCircle size={32} className="text-red-400" />
            <p className="text-sm">{error}</p>
            <button onClick={() => load()} className="text-sm text-brand-600 hover:underline dark:text-brand-400">Tentar novamente</button>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-slate-500 dark:text-gray-400">
            <Ticket size={36} className="opacity-30" />
            <p className="text-sm">{search ? "Nenhum chamado encontrado para esta busca." : "Nenhum chamado nesta categoria."}</p>
            <Link to="/novo-chamado" className="text-sm text-brand-600 hover:underline dark:text-brand-400">
              Abrir novo chamado
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((t) => (
              <Link
                key={t.id}
                to={`/acompanhar/${t.ticketNumber}`}
                className="flex items-center gap-4 bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700 px-4 py-3.5 hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-sm transition group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-slate-500 dark:text-gray-400">
                      #{t.ticketNumber}
                    </span>
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-700 dark:text-gray-200 truncate">
                    {t.category || "—"}
                    {t.department && (
                      <span className="ml-2 text-xs font-normal text-slate-400 dark:text-gray-500">
                        · {t.department}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-slate-400 dark:text-gray-500">{formatRelative(t.openedAt)}</div>
                  {t.completedAt && (
                    <div className="text-xs text-emerald-500 dark:text-emerald-400 mt-0.5">
                      Concluído {formatRelative(t.completedAt)}
                    </div>
                  )}
                </div>
                <ChevronRight size={16} className="text-slate-300 dark:text-gray-600 group-hover:text-brand-500 transition shrink-0" />
              </Link>
            ))}
          </div>
        )}

        {/* Botão abrir chamado */}
        <div className="pt-2 text-center">
          <Link
            to="/novo-chamado"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold shadow-sm transition"
          >
            <Ticket size={15} />
            Abrir novo chamado
          </Link>
        </div>
      </main>
    </div>
  );
}
