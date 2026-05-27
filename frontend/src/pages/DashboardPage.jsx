import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useSocket } from "../context/SocketContext";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { StatusBadge, KpiCard, Spinner, TicketSkeletonRow } from "../components/ui";
import AppHeader from "../components/AppHeader";
import { formatElapsed } from "../lib/statuses";
import { useServerTick, serverNow } from "../lib/serverTime";
import {
  Ticket, AlertCircle, Activity, CheckCircle2,
  ChevronRight, Clock, RefreshCw, Filter, History,
  ShieldCheck, ThumbsUp, ThumbsDown, X, Search, Download,
} from "lucide-react";

function exportCsv(tickets) {
  const header = ["Número","Solicitante","Setor","Categoria","Subcategoria","Status","Técnico","Aberto em","Concluído em"];
  const rows = tickets.map((t) => [
    t.ticketNumber,
    t.requesterName,
    t.department,
    t.category?.name ?? "",
    t.subcategory?.name ?? "",
    t.status,
    t.technician?.name ?? "",
    t.openedAt ? new Date(t.openedAt).toLocaleString("pt-BR") : "",
    t.completedAt ? new Date(t.completedAt).toLocaleString("pt-BR") : "",
  ]);
  const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `chamados_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

const ACTIVE_STATUSES = ["OPEN", "VIEWED", "EN_ROUTE", "IN_SERVICE"];

const FILTER_TABS = [
  { key: "active",    label: "Ativos" },
  { key: "completed", label: "Concluídos" },
  { key: "all",       label: "Todos" },
];

const HIST_RANGES = [
  { key: "7",  label: "7 dias"  },
  { key: "30", label: "30 dias" },
  { key: "90", label: "90 dias" },
  { key: "0",  label: "Tudo"   },
];

// ── Chips de categoria ────────────────────────────────────────────────────────
const CAT_CHIP = {
  HARDWARE:  { on: "bg-orange-500 text-white border-orange-500",  off: "border-orange-200 dark:border-orange-800/60 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20" },
  NETWORK:   { on: "bg-blue-500   text-white border-blue-500",    off: "border-blue-200   dark:border-blue-800/60   text-blue-600   dark:text-blue-400   hover:bg-blue-50   dark:hover:bg-blue-900/20"   },
  NETSERVER: { on: "bg-indigo-500 text-white border-indigo-500",  off: "border-indigo-200 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20" },
  SIGED:     { on: "bg-teal-500   text-white border-teal-500",    off: "border-teal-200   dark:border-teal-800/60   text-teal-600   dark:text-teal-400   hover:bg-teal-50   dark:hover:bg-teal-900/20"   },
  REMOTE:    { on: "bg-cyan-500   text-white border-cyan-500",    off: "border-cyan-200   dark:border-cyan-800/60   text-cyan-600   dark:text-cyan-400   hover:bg-cyan-50   dark:hover:bg-cyan-900/20"   },
  PRINTER:   { on: "bg-green-500  text-white border-green-500",   off: "border-green-200  dark:border-green-800/60  text-green-600  dark:text-green-400  hover:bg-green-50  dark:hover:bg-green-900/20"  },
  _default:  { on: "bg-slate-600  text-white border-slate-600",   off: "border-slate-200  dark:border-gray-700      text-slate-600  dark:text-gray-400   hover:bg-slate-50  dark:hover:bg-gray-800"      },
};

// ── View simplificada para Chefe de Setor ────────────────────────────────────
function ChefeDashboard() {
  const { user } = useAuth();
  useServerTick(60000);
  const [tickets,    setTickets]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [rejectId,   setRejectId]   = useState(null); // id do ticket em rejeição
  const [rejectNote, setRejectNote] = useState("");
  const [acting,     setActing]     = useState(false);
  const [err,        setErr]        = useState("");

  async function load() {
    setLoading(true);
    try {
      const deptId = user.department?.id;
      const { data } = await api.get("/tickets", deptId ? { params: { pendingForDept: deptId } } : undefined);
      setTickets(data.tickets ?? data);
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function decide(ticketId, status, note) {
    setActing(true);
    setErr("");
    try {
      await api.post(`/tickets/${ticketId}/approve`, { status, note: note || undefined });
      setRejectId(null);
      setRejectNote("");
      load();
    } catch (e) {
      setErr(e.response?.data?.error || "Erro ao processar aprovação");
    } finally {
      setActing(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <AppHeader />

      {/* Modal de rejeição */}
      {rejectId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setRejectId(null); }}
        >
          <div className="card w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
                <ThumbsDown size={18} />
              </span>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-gray-100">Reprovar solicitação</h3>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Informe o motivo (opcional)</p>
              </div>
            </div>
            <textarea
              rows={3}
              className="field-input resize-none w-full"
              placeholder="Motivo da reprovação..."
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              autoFocus
            />
            {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setRejectId(null); setErr(""); }} className="btn-secondary text-sm py-2 px-4">Cancelar</button>
              <button
                onClick={() => decide(rejectId, "REJECTED", rejectNote)}
                disabled={acting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
              >
                {acting ? <Spinner className="h-4 w-4" /> : <ThumbsDown size={14} />}
                Reprovar
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-gray-100">
              Olá, {user?.name?.split(" ")[0]}
            </h1>
            <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">
              Painel de aprovações — Chefe de Setor
            </p>
          </div>
          <button onClick={load} className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200 transition">
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
        ) : tickets.length === 0 ? (
          <div className="card p-10 text-center space-y-3">
            <div className="flex items-center justify-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/20">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </span>
            </div>
            <p className="font-medium text-slate-700 dark:text-gray-300">
              Nenhum chamado aguardando sua aprovação
            </p>
            <p className="text-sm text-slate-400 dark:text-gray-500">
              Quando um chamado do seu setor precisar de autorização, ele aparecerá aqui.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-500 dark:text-gray-400">
              {tickets.length} solicitaç{tickets.length === 1 ? "ão" : "ões"} aguardando sua aprovação
            </p>
            {tickets.map((t) => (
              <ApprovalCard
                key={t.id}
                ticket={t}
                onApprove={() => decide(t.id, "APPROVED")}
                onReject={() => { setRejectId(t.id); setRejectNote(""); setErr(""); }}
                acting={acting}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Card de aprovação ──────────────────────────────────────────────────────
function ApprovalCard({ ticket, onApprove, onReject, acting }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-4">
        {/* Ícone + info principal */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
            <ShieldCheck size={18} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-slate-400 dark:text-gray-500">{ticket.ticketNumber}</span>
              <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-xs font-medium">Aguardando aprovação</span>
            </div>
            <p className="font-semibold text-slate-900 dark:text-gray-100 text-sm mt-0.5">{ticket.requesterName}</p>
            <p className="text-xs text-slate-500 dark:text-gray-400">{ticket.department} · {ticket.category?.name} → {ticket.subcategory?.name}</p>
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
              <Clock size={10} className="inline mr-1" />
              {new Date(ticket.openedAt).toLocaleString("pt-BR")}
            </p>
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onApprove}
            disabled={acting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 text-xs font-semibold transition disabled:opacity-50"
          >
            <ThumbsUp size={13} /> Aprovar
          </button>
          <button
            onClick={onReject}
            disabled={acting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-700 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800 px-3 py-2 text-xs font-semibold transition disabled:opacity-50"
          >
            <ThumbsDown size={13} /> Reprovar
          </button>
        </div>
      </div>

      {/* Detalhes expandíveis */}
      {ticket.freeTextDescription && (
        <>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full px-5 py-2 text-xs text-brand-600 dark:text-brand-400 hover:underline text-left border-t border-slate-100 dark:border-gray-700"
          >
            {expanded ? "Ocultar detalhes ▲" : "Ver detalhes da solicitação ▼"}
          </button>
          {expanded && (
            <div className="px-5 pb-4">
              <div className="rounded-xl bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 px-4 py-3">
                <p className="text-xs font-medium text-slate-500 dark:text-gray-400 mb-1">Dados informados pelo solicitante</p>
                <p className="text-sm text-slate-700 dark:text-gray-200 whitespace-pre-wrap">{ticket.freeTextDescription}</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const socket  = useSocket();
  const addToast = useToast();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // CHEFE_SETOR vê view simplificada
  if (user?.role === "CHEFE_SETOR") return <ChefeDashboard />;

  const isAdmin = user?.role === "ADMIN";
  useServerTick(60000);

  // ── Aprovações pendentes apenas para ADMIN que também é chefe de setor ──
  const adminDeptId = isAdmin ? (user?.department?.id ?? null) : null;
  const [pendingApprovals, setPendingApprovals]   = useState([]);
  const [approvalRejectId, setApprovalRejectId]   = useState(null);
  const [approvalRejectNote, setApprovalRejectNote] = useState("");
  const [approvalActing, setApprovalActing]       = useState(false);
  const [approvalErr, setApprovalErr]             = useState("");

  const loadPendingApprovals = useCallback(async () => {
    if (!adminDeptId) return;
    try {
      const { data } = await api.get("/tickets", { params: { pendingForDept: adminDeptId, limit: 100 } });
      setPendingApprovals(data.tickets ?? []);
    } catch {}
  }, [adminDeptId]);

  useEffect(() => { loadPendingApprovals(); }, [loadPendingApprovals]);

  async function decideApproval(ticketId, status, note) {
    setApprovalActing(true);
    setApprovalErr("");
    try {
      await api.post(`/tickets/${ticketId}/approve`, { status, note: note || undefined });
      setApprovalRejectId(null);
      setApprovalRejectNote("");
      loadPendingApprovals();
    } catch (e) {
      setApprovalErr(e.response?.data?.error || "Erro ao processar aprovação");
    } finally {
      setApprovalActing(false);
    }
  }

  const [tickets, setTickets]         = useState([]);
  const [history, setHistory]         = useState([]);
  const [histCursor, setHistCursor]   = useState(null);
  const [histHasMore, setHistHasMore] = useState(false);
  const [loading, setLoading]         = useState(true);
  const [histLoading, setHistLoading] = useState(false);
  const VALID_TABS = ["active", "completed", "all", "history"];
  const [filter, setFilter]           = useState(() => {
    const tab = searchParams.get("tab");
    return VALID_TABS.includes(tab) ? tab : "active";
  });
  const [histRange, setHistRange]     = useState("30");
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");

  // Filtros avançados
  const [departments, setDepartments]     = useState([]);
  const [categories, setCategories]       = useState([]);
  const [deptFilter, setDeptFilter]         = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [dateFilter, setDateFilter]         = useState("");

  const load = useCallback(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const activeParams = {};
      const completedParams = { status: "COMPLETED", from: today.toISOString() };
      if (categoryFilter) {
        activeParams.categoryId = categoryFilter;
        completedParams.categoryId = categoryFilter;
      }

      // Ativos: sem filtro de data (mostra todos em aberto independente de quando foram criados)
      // Concluídos: apenas os de hoje
      const [activeRes, completedRes] = await Promise.all([
        api.get("/tickets", { params: { ...activeParams, limit: 500 } }),
        api.get("/tickets", { params: completedParams }),
      ]);

      const activeTickets    = activeRes.data.tickets.filter((t) => ACTIVE_STATUSES.includes(t.status));
      const completedTickets = completedRes.data.tickets;

      setTickets([...activeTickets, ...completedTickets]);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  const loadHistory = useCallback(async (append = false, cursor = null) => {
    setHistLoading(true);
    try {
      const params = { status: "COMPLETED", limit: 50 };
      if (histRange !== "0") {
        const from = new Date(Date.now() - Number(histRange) * 86400000);
        from.setHours(0, 0, 0, 0);
        params.from = from.toISOString();
      }
      if (cursor) params.cursor = cursor;
      const res = await api.get("/tickets", { params });
      const { tickets: rows, nextCursor } = res.data;
      setHistory((prev) => append ? [...prev, ...rows] : rows);
      setHistCursor(nextCursor);
      setHistHasMore(!!nextCursor);
    } finally {
      setHistLoading(false);
    }
  }, [histRange]);

  // Persiste a aba selecionada na URL (permite voltar com o botão do browser e usar nav(-1))
  function changeFilter(newFilter) {
    setFilter(newFilter);
    const params = {};
    if (newFilter !== "active") params.tab = newFilter;
    setSearchParams(params, { replace: true });
  }

  // Sincroniza a aba a partir de mudanças na URL (botão voltar/avançar do browser)
  useEffect(() => {
    const urlTab = searchParams.get("tab");
    const resolved = VALID_TABS.includes(urlTab) ? urlTab : "active";
    if (resolved !== filter) setFilter(resolved);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Carrega filtros disponíveis
  useEffect(() => {
    api.get("/departments").then((r) => setDepartments(r.data));
    api.get("/categories").then((r) => setCategories(r.data));
  }, []);

  // Carrega histórico ao trocar para essa aba ou mudar o período
  useEffect(() => {
    if (filter === "history") { setHistory([]); setHistCursor(null); loadHistory(false, null); }
  }, [filter, loadHistory, histRange]); // eslint-disable-line react-hooks/exhaustive-deps

  // Carrega tickets e escuta socket (sem polling)
  useEffect(() => {
    load();
  }, [load]);

  // Recarrega ao voltar para esta aba do browser (visibilidade)
  useEffect(() => {
    const handler = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [load]);

  const loadDebounceRef = useRef(null);

  useEffect(() => {
    const s = socket?.current;
    if (!s) return;

    const onCreated = ({ ticketNumber }) => {
      addToast({ message: `Novo chamado: ${ticketNumber}`, type: "info" });
      load();
    };

    const onUpdated = () => {
      clearTimeout(loadDebounceRef.current);
      loadDebounceRef.current = setTimeout(() => load(), 300);
    };
    const onDeleted  = ({ id }) => setTickets((prev) => prev.filter((t) => t.id !== id));

    s.on("ticket:created", onCreated);
    s.on("ticket:updated", onUpdated);
    s.on("ticket:deleted", onDeleted);
    return () => {
      s.off("ticket:created", onCreated);
      s.off("ticket:updated", onUpdated);
      s.off("ticket:deleted", onDeleted);
    };
  }, [socket, load, addToast]);

  // KPI counts — respeitam todos os filtros ativos
  const kpiBase = useMemo(() => {
    let base = tickets;
    if (categoryFilter) base = base.filter((t) => String(t.category?.id) === categoryFilter);
    if (deptFilter)      base = base.filter((t) => t.department === deptFilter);
    if (dateFilter) {
      const from = new Date(dateFilter + "T00:00:00");
      const to   = new Date(dateFilter + "T23:59:59");
      base = base.filter((t) => { const d = new Date(t.openedAt); return d >= from && d <= to; });
    }
    if (priorityFilter)  base = base.filter((t) => t.priority === priorityFilter);
    return base;
  }, [tickets, categoryFilter, deptFilter, dateFilter, priorityFilter]);
  const active    = useMemo(() => kpiBase.filter((t) => ACTIVE_STATUSES.includes(t.status)), [kpiBase]);
  const completed = useMemo(() => kpiBase.filter((t) => t.status === "COMPLETED"), [kpiBase]);
  const noUnit    = useMemo(() => kpiBase.filter((t) => ACTIVE_STATUSES.includes(t.status) && !t.unit), [kpiBase]);
  const todayTotal = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return kpiBase.filter((t) => new Date(t.openedAt) >= start);
  }, [kpiBase]);

  // Filtro de exibição + ordenação por prioridade
  const PRIORITY_WEIGHT = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  const visible = useMemo(() => {
    let result = filter === "active"    ? active
               : filter === "completed" ? completed
               : filter === "history"   ? history
               : tickets;
    if (categoryFilter && filter !== "history") result = result.filter((t) => String(t.category?.id) === categoryFilter);
    if (deptFilter && filter !== "history") result = result.filter((t) => t.department === deptFilter);
    if (dateFilter) {
      const from = new Date(dateFilter + "T00:00:00");
      const to   = new Date(dateFilter + "T23:59:59");
      result = result.filter((t) => { const d = new Date(t.openedAt); return d >= from && d <= to; });
    }
    if (priorityFilter) result = result.filter((t) => t.priority === priorityFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) =>
        t.ticketNumber?.toLowerCase().includes(q) ||
        t.requesterName?.toLowerCase().includes(q) ||
        t.department?.toLowerCase().includes(q) ||
        t.category?.name?.toLowerCase().includes(q)
      );
    }
    if (filter !== "history") {
      result = [...result].sort((a, b) => {
        const pw = (PRIORITY_WEIGHT[b.priority] ?? 2) - (PRIORITY_WEIGHT[a.priority] ?? 2);
        if (pw !== 0) return pw;
        return new Date(b.openedAt) - new Date(a.openedAt);
      });
    }
    return result;
  }, [filter, active, completed, history, tickets, categoryFilter, deptFilter, dateFilter, priorityFilter, searchQuery]);

  // Agrupar por unidade
  const byUnit = useMemo(() => visible.reduce((acc, t) => {
    const key = t.unit?.name || "__sem_unidade__";
    (acc[key] = acc[key] || []).push(t);
    return acc;
  }, {}), [visible]);

  const sortedUnits = useMemo(() =>
    Object.entries(byUnit).sort(([a]) => a === "__sem_unidade__" ? -1 : 1),
  [byUnit]);

  const now = new Date();
  const dateLabel = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const hasFilters = deptFilter || categoryFilter || priorityFilter || dateFilter;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <AppHeader />

      <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-5">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-gray-100 capitalize">{dateLabel}</h1>
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5 flex items-center gap-1.5">
              <Clock size={11} />
              Atualizado às {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition"
          >
            <RefreshCw size={13} />
            Atualizar
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Total hoje"    value={todayTotal.length} icon={Ticket}       sub={`${active.length} ativo${active.length !== 1 ? "s" : ""}`} />
          <KpiCard title="Em andamento" value={active.length}     icon={Activity} />
          <KpiCard title="Concluídos"   value={completed.length}  icon={CheckCircle2} sub={todayTotal.length ? `${Math.round((completed.length / todayTotal.length) * 100)}% de hoje` : "—"} />
          <KpiCard title="Sem unidade"  value={noUnit.length}     icon={AlertCircle}  highlight={noUnit.length > 0} />
        </div>

        {/* ── Aprovações pendentes (admin que é chefe de setor) ── */}
        {adminDeptId && pendingApprovals.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={15} className="text-amber-500" />
              <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-100">
                Aprovações pendentes do seu setor ({pendingApprovals.length})
              </h2>
            </div>

            {/* Modal rejeição */}
            {approvalRejectId !== null && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                onClick={(e) => { if (e.target === e.currentTarget) setApprovalRejectId(null); }}>
                <div className="card w-full max-w-sm p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
                      <ThumbsDown size={18} />
                    </span>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-gray-100">Reprovar solicitação</h3>
                      <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Informe o motivo (opcional)</p>
                    </div>
                  </div>
                  <textarea rows={3} className="field-input resize-none w-full"
                    placeholder="Motivo da reprovação..." value={approvalRejectNote}
                    onChange={(e) => setApprovalRejectNote(e.target.value)} autoFocus />
                  {approvalErr && <p className="text-sm text-red-600 dark:text-red-400">{approvalErr}</p>}
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setApprovalRejectId(null); setApprovalErr(""); }} className="btn-secondary text-sm py-2 px-4">Cancelar</button>
                    <button onClick={() => decideApproval(approvalRejectId, "REJECTED", approvalRejectNote)}
                      disabled={approvalActing}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm font-semibold transition disabled:opacity-50">
                      {approvalActing ? <Spinner className="h-4 w-4" /> : <ThumbsDown size={14} />} Reprovar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {pendingApprovals.map((t) => (
              <ApprovalCard key={t.id} ticket={t}
                onApprove={() => decideApproval(t.id, "APPROVED")}
                onReject={() => { setApprovalRejectId(t.id); setApprovalRejectNote(""); setApprovalErr(""); }}
                acting={approvalActing} />
            ))}
          </div>
        )}

        {/* Filtros */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-gray-700 pb-1">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => changeFilter(tab.key)}
                className={`relative pb-2 text-sm font-medium transition ${
                  filter === tab.key
                    ? "text-brand-600 dark:text-brand-400"
                    : "text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200"
                }`}
              >
                {tab.label}
                {filter === tab.key && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-brand-600 dark:bg-brand-400" />
                )}
              </button>
            ))}
            <span className="ml-auto text-xs text-slate-400 dark:text-gray-500">{visible.length} chamado{visible.length !== 1 ? "s" : ""}</span>
            {isAdmin && (
              <button
                onClick={() => changeFilter(filter === "history" ? "active" : "history")}
                className={`relative pb-2 text-sm font-medium transition flex items-center gap-1 ${
                  filter === "history"
                    ? "text-brand-600 dark:text-brand-400"
                    : "text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200"
                }`}
              >
                <History size={13} />
                Histórico
                {filter === "history" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-brand-600 dark:bg-brand-400" />
                )}
              </button>
            )}
          </div>

          {/* Seletor de período — só na aba Histórico */}
          {filter === "history" && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-slate-400 dark:text-gray-500">Período:</span>
              {HIST_RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setHistRange(r.key)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${
                    histRange === r.key
                      ? "bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-400"
                      : "text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}

          {/* Busca textual */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por número, solicitante, setor ou categoria..."
              className="field-input pl-8 py-2 text-xs w-full"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filtros avançados — painel estruturado */}
          <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 divide-y divide-slate-100 dark:divide-gray-700/50 overflow-hidden">

            {/* Linha: Categoria */}
            {categories.length > 0 && (
              <div className="flex items-start gap-3 px-3 py-2.5">
                <span className="text-[10px] font-semibold text-slate-400 dark:text-gray-500 uppercase tracking-wide pt-1 w-16 shrink-0">Categoria</span>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setCategoryFilter("")}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition ${
                      !categoryFilter
                        ? "bg-slate-600 dark:bg-gray-300 text-white dark:text-gray-900 border-slate-600 dark:border-gray-300"
                        : "border-slate-200 dark:border-gray-700 text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    Todas
                  </button>
                  {categories.map((c) => {
                    const isCatActive = categoryFilter === String(c.id);
                    const chip = CAT_CHIP[c.code] || CAT_CHIP._default;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCategoryFilter(isCatActive ? "" : String(c.id))}
                        className={`text-xs px-2.5 py-1 rounded-full border font-medium transition ${isCatActive ? chip.on : chip.off}`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Linha: Prioridade */}
            <div className="flex items-center gap-3 px-3 py-2.5">
              <span className="text-[10px] font-semibold text-slate-400 dark:text-gray-500 uppercase tracking-wide w-16 shrink-0">Prioridade</span>
              <div className="flex flex-wrap gap-1">
                {[
                  { value: "",       label: "Todas",   on: "bg-slate-600 dark:bg-gray-300 text-white dark:text-gray-900 border-slate-600",   off: "border-slate-200 dark:border-gray-700 text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800" },
                  { value: "URGENT", label: "Urgente", on: "bg-red-500    text-white border-red-500",    off: "border-red-200    dark:border-red-800/60    text-red-600    dark:text-red-400    hover:bg-red-50    dark:hover:bg-red-900/20"    },
                  { value: "HIGH",   label: "Alta",    on: "bg-orange-500 text-white border-orange-500", off: "border-orange-200 dark:border-orange-800/60 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20" },
                  { value: "MEDIUM", label: "Média",   on: "bg-blue-500   text-white border-blue-500",   off: "border-blue-200   dark:border-blue-800/60   text-blue-600   dark:text-blue-400   hover:bg-blue-50   dark:hover:bg-blue-900/20"   },
                  { value: "LOW",    label: "Baixa",   on: "bg-slate-400  text-white border-slate-400",  off: "border-slate-200  dark:border-gray-700      text-slate-500  dark:text-gray-400   hover:bg-slate-50  dark:hover:bg-gray-800"      },
                ].map(({ value, label, on, off }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPriorityFilter(value)}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition ${priorityFilter === value ? on : off}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Linha: Setor + Data + ações */}
            <div className="flex items-center gap-2 px-3 py-2.5 flex-wrap">
              <span className="text-[10px] font-semibold text-slate-400 dark:text-gray-500 uppercase tracking-wide w-16 shrink-0">Setor</span>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="field-input py-1.5 text-xs w-auto min-w-0 max-w-[200px]"
              >
                <option value="">Todos</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="field-input py-1.5 text-xs w-auto"
                title="Filtrar por data de abertura"
              />
              {(hasFilters || searchQuery) && (
                <button
                  onClick={() => { setDeptFilter(""); setCategoryFilter(""); setPriorityFilter(""); setDateFilter(""); setSearchQuery(""); }}
                  className="flex items-center gap-1 text-xs text-slate-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition"
                >
                  <X size={11} /> Limpar filtros
                </button>
              )}
              <button
                onClick={() => exportCsv(visible)}
                disabled={visible.length === 0}
                className="ml-auto flex items-center gap-1.5 text-xs text-slate-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition disabled:opacity-40"
                title="Exportar lista atual como CSV"
              >
                <Download size={13} /> CSV
              </button>
            </div>
          </div>
        </div>

        {/* Loading — skeleton rows */}
        {(loading || (filter === "history" && histLoading)) && (
          <div className="card divide-y divide-slate-100 dark:divide-gray-700/60">
            {[...Array(6)].map((_, i) => <TicketSkeletonRow key={i} />)}
          </div>
        )}

        {/* Empty state */}
        {!(loading || (filter === "history" && histLoading)) && visible.length === 0 && (() => {
          const hasActiveFilters = deptFilter || categoryFilter || searchQuery;
          const EmptyIcon = hasActiveFilters ? Search
            : filter === "completed" ? CheckCircle2
            : filter === "history"   ? History
            : Ticket;
          return (
            <div className="card p-14 text-center">
              <div className="flex justify-center mb-4">
                <EmptyIcon size={44} className="text-slate-300 dark:text-gray-700" />
              </div>
              <div className="font-semibold text-slate-700 dark:text-gray-300">
                {hasActiveFilters
                  ? "Nenhum chamado encontrado com os filtros ativos"
                  : filter === "completed" ? "Nenhum chamado concluído ainda"
                  : filter === "active"    ? "Nenhum chamado ativo no momento"
                  : filter === "history"   ? "Nenhum chamado no histórico"
                  : "Nenhum chamado hoje"}
              </div>
              <div className="text-sm text-slate-400 dark:text-gray-500 mt-2">
                {hasActiveFilters ? (
                  <div className="space-y-1">
                    {deptFilter && <p>Setor: <strong className="text-slate-600 dark:text-gray-300">{deptFilter}</strong></p>}
                    {categoryFilter && <p>Categoria: <strong className="text-slate-600 dark:text-gray-300">{categories.find((c) => String(c.id) === categoryFilter)?.name}</strong></p>}
                    {searchQuery && <p>Busca: <strong className="text-slate-600 dark:text-gray-300">"{searchQuery}"</strong></p>}
                    <button
                      onClick={() => { setDeptFilter(""); setCategoryFilter(""); setPriorityFilter(""); setSearchQuery(""); }}
                      className="mt-2 text-brand-600 dark:text-brand-400 hover:underline font-medium"
                    >
                      Limpar filtros
                    </button>
                  </div>
                ) : (
                  filter === "active" ? "Todos os chamados estão concluídos" : "Os chamados aparecerão aqui quando chegarem"
                )}
              </div>
            </div>
          );
        })()}

        {/* Carregar mais — apenas no histórico */}
        {filter === "history" && !histLoading && histHasMore && (
          <div className="flex flex-col items-center gap-1 pt-2">
            <p className="text-xs text-slate-400 dark:text-gray-500">{history.length} carregados · mais disponíveis</p>
            <button
              onClick={() => loadHistory(true, histCursor)}
              className="flex items-center gap-1.5 text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium transition"
            >
              <RefreshCw size={13} /> Carregar mais 50
            </button>
          </div>
        )}

        {/* Tickets por unidade */}
        {!(loading || (filter === "history" && histLoading)) && sortedUnits.map(([unit, list]) => {
          const noUnitSection   = unit === "__sem_unidade__";
          const activeInSection = list.filter((t) => ACTIVE_STATUSES.includes(t.status)).length;
          const doneInSection   = list.filter((t) => t.status === "COMPLETED").length;

          return (
            <section key={unit}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <h2 className={`text-sm font-semibold flex items-center gap-1.5 ${
                  noUnitSection ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-gray-300"
                }`}>
                  {noUnitSection && <AlertCircle size={14} className="text-red-500" />}
                  {noUnitSection ? "Sem unidade atribuída" : unit}
                </h2>
                <div className="flex items-center gap-1.5 ml-1">
                  {activeInSection > 0 && (
                    <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[11px] font-medium">
                      {activeInSection} ativo{activeInSection !== 1 ? "s" : ""}
                    </span>
                  )}
                  {doneInSection > 0 && (
                    <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[11px] font-medium">
                      {doneInSection} concluído{doneInSection !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>

              <div className="card divide-y divide-slate-100 dark:divide-gray-700/60">
                {list.map((t) => (
                  <TicketRow key={t.id} ticket={t} />
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}

const PRIORITY_MAP = {
  LOW:    { label: "Baixa",   cls: "bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-400" },
  MEDIUM: { label: "Média",   cls: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" },
  HIGH:   { label: "Alta",    cls: "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400" },
  URGENT: { label: "Urgente", cls: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-semibold" },
};

function PriorityBadge({ priority }) {
  if (!priority || priority === "MEDIUM") return null;
  const p = PRIORITY_MAP[priority];
  if (!p) return null;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${p.cls}`}>
      {p.label}
    </span>
  );
}

function TicketRow({ ticket: t }) {
  return (
    <Link
      to={`/painel/chamado/${t.id}`}
      className="group flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-gray-800/60 transition-colors duration-150"
    >
      <div className="flex gap-0.5 self-stretch shrink-0">
        <div className={`w-1 rounded-full ${statusColor(t.status)}`} />
        {(t.priority === "URGENT" || t.priority === "HIGH") && (
          <div className={`w-1 rounded-full ${t.priority === "URGENT" ? "bg-red-500" : "bg-orange-400"}`} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-slate-400 dark:text-gray-500">{t.ticketNumber}</span>
          <StatusBadge status={t.status} />
          <PriorityBadge priority={t.priority} />
        </div>
        <div className="text-sm font-medium text-slate-800 dark:text-gray-100 mt-0.5 truncate">
          {t.requesterName}
          <span className="text-slate-400 dark:text-gray-500 font-normal"> · {t.department}</span>
        </div>
        <div className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
          {t.category?.name}
          {t.subcategory ? ` · ${t.subcategory.name}` : ""}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs text-slate-500 dark:text-gray-400">{formatElapsed(t.openedAt, t.completedAt, t.completedAt ? null : serverNow())}</div>
        <div className="text-xs text-slate-400 dark:text-gray-500 mt-0.5 max-w-[120px] truncate text-right">
          {t.technician?.name || "—"}
        </div>
      </div>
      <ChevronRight
        size={16}
        className="text-slate-300 dark:text-gray-600 group-hover:text-brand-500 dark:group-hover:text-brand-400 shrink-0 transition"
      />
    </Link>
  );
}

function statusColor(s) {
  return {
    OPEN:       "bg-slate-300 dark:bg-gray-600",
    VIEWED:     "bg-blue-400 dark:bg-blue-500",
    EN_ROUTE:   "bg-amber-400 dark:bg-amber-500",
    IN_SERVICE: "bg-violet-500",
    COMPLETED:  "bg-emerald-500",
  }[s] || "bg-slate-300";
}
