import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { StatusBadge, Spinner } from "../components/ui";
import DateInput from "../components/DateInput";
import AppHeader from "../components/AppHeader";
import { TIPO_LABELS, TIPO_OPTIONS as TIPO_OPTIONS_LIST, OS_STATUS_LABEL, OS_STATUS_STYLE } from "../lib/osConstants";
import DateTimeInput from "../components/DateTimeInput";
import {
  ArrowLeft, ChevronRight, MapPin, Users, Clock,
  Wrench, Edit2, Check, X, Plus, Trash2, Link2, Unlink,
  AlertTriangle, CheckCircle2, Play, XCircle,
  Zap, Package, ClipboardCheck, CalendarRange, ExternalLink,
} from "lucide-react";

const TIPO_OPTIONS = TIPO_OPTIONS_LIST.filter(o => o.value).map(o => o.value);
const STATUS_STYLE = OS_STATUS_STYLE;
const STATUS_LABEL = OS_STATUS_LABEL;

const CHECKLIST_STATUS_STYLE = {
  PENDENTE:  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  APROVADO:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  REJEITADO: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};
const CHECKLIST_STATUS_LABEL = { PENDENTE: "Pendente", APROVADO: "Aprovado", REJEITADO: "Rejeitado" };

const TRANSITION_CONFIG = {
  EM_ANDAMENTO: { label: "Iniciar",   icon: Play,        cls: "bg-blue-600 hover:bg-blue-700 text-white" },
  CONCLUIDA:    { label: "Concluir",  icon: CheckCircle2, cls: "bg-emerald-600 hover:bg-emerald-700 text-white" },
  CANCELADA:    { label: "Cancelar",  icon: XCircle,     cls: "bg-red-600 hover:bg-red-700 text-white" },
};

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtDateInput(d) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

function OsStatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status] || ""}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <div className="text-xs text-slate-400 dark:text-gray-500 mb-0.5">{label}</div>
      <div className="text-sm text-slate-800 dark:text-gray-100 whitespace-pre-wrap">{value || "—"}</div>
    </div>
  );
}

// ── Transition modal ──────────────────────────────────────────────────────────
function TransitionModal({ toStatus, onConfirm, onClose }) {
  const [note, setNote]           = useState("");
  const [relatorio, setRelatorio] = useState("");
  const [saving, setSaving]       = useState(false);
  const needsRelatorio = toStatus === "CONCLUIDA";

  async function confirm() {
    setSaving(true);
    try { await onConfirm({ toStatus, note: note || null, relatorio: relatorio || null }); }
    finally { setSaving(false); }
  }

  const cfg = TRANSITION_CONFIG[toStatus];
  const Icon = cfg?.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            toStatus === "CANCELADA" ? "bg-red-100 dark:bg-red-900/40 text-red-600" : "bg-brand-100 dark:bg-brand-900/40 text-brand-600"
          }`}>
            {Icon && <Icon size={20} />}
          </span>
          <h3 className="font-semibold text-slate-900 dark:text-gray-100">{cfg?.label} OS</h3>
        </div>

        {needsRelatorio && (
          <div>
            <label className="field-label">Relatório de conclusão</label>
            <textarea
              rows={3} value={relatorio}
              onChange={(e) => setRelatorio(e.target.value)}
              placeholder="Descreva o que foi realizado (opcional)..."
              className="field-input resize-none text-sm"
            />
          </div>
        )}

        <div>
          <label className="field-label">Observação {needsRelatorio ? "(opcional)" : ""}</label>
          <textarea
            rows={2} value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Observação para o histórico..."
            className="field-input resize-none text-sm"
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary text-sm py-2 px-4">Cancelar</button>
          <button
            onClick={confirm} disabled={saving}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${cfg?.cls}`}
          >
            {saving ? <Spinner className="h-4 w-4" /> : Icon && <Icon size={14} />}
            {cfg?.label}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Link ticket modal ─────────────────────────────────────────────────────────
function LinkTicketModal({ onLink, onClose }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  async function search() {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const res = await api.get("/tickets", { params: { limit: 20 } });
      const filtered = res.data.tickets.filter((t) =>
        t.ticketNumber.toLowerCase().includes(q.toLowerCase()) ||
        t.requesterName.toLowerCase().includes(q.toLowerCase())
      );
      setResults(filtered);
    } finally { setSearching(false); }
  }

  useEffect(() => {
    const t = setTimeout(search, 400);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card w-full max-w-md p-6 space-y-3">
        <h3 className="font-semibold text-slate-900 dark:text-gray-100 flex items-center gap-2">
          <Link2 size={16} className="text-brand-600" /> Vincular chamado
        </h3>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por protocolo ou nome..."
          className="field-input"
          autoFocus
        />
        {searching && <div className="flex justify-center py-4"><Spinner className="h-5 w-5" /></div>}
        {results.length > 0 && (
          <div className="divide-y divide-slate-100 dark:divide-gray-700/60 max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-gray-700">
            {results.map((t) => (
              <button
                key={t.id}
                onClick={() => onLink(t.id)}
                className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-gray-800 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400">{t.ticketNumber}</span>
                  <StatusBadge status={t.status} />
                </div>
                <div className="text-sm text-slate-700 dark:text-gray-300">{t.requesterName}</div>
                <div className="text-xs text-slate-400">{t.department}</div>
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-end">
          <button onClick={onClose} className="btn-secondary text-sm py-2 px-4">Fechar</button>
        </div>
      </div>
    </div>
  );
}

// ── Delete confirmation modal ─────────────────────────────────────────────────
function DeleteOsModal({ osNumber, onConfirm, onClose }) {
  const [deleting, setDeleting] = useState(false);
  async function confirm() {
    setDeleting(true);
    try { await onConfirm(); }
    finally { setDeleting(false); }
  }
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600">
            <Trash2 size={20} />
          </span>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-gray-100">Excluir OS</h3>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Esta ação não pode ser desfeita.</p>
          </div>
        </div>
        <p className="text-sm text-slate-700 dark:text-gray-300">
          Confirmar exclusão de <span className="font-mono font-medium">{osNumber}</span>? Todo o histórico e vínculos serão removidos.
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary text-sm py-2 px-4">Cancelar</button>
          <button
            onClick={confirm}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm font-semibold transition disabled:opacity-60"
          >
            {deleting ? <Spinner className="h-4 w-4" /> : <Trash2 size={14} />}
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function WorkOrderDetailPage() {
  const { id }  = useParams();
  const nav     = useNavigate();
  const { user } = useAuth();

  const [os, setOs]               = useState(null);
  const [loadErr, setLoadErr]     = useState(false);
  const [units, setUnits]         = useState([]);
  const [techs, setTechs]         = useState([]);
  const [transition, setTrans]    = useState(null);
  const [showLinkTicket, setShowLink] = useState(false);
  const [showDelete, setShowDelete]   = useState(false);
  const [err, setErr]             = useState("");
  const [editing, setEditing]     = useState(false);
  const [editForm, setEditForm]   = useState({});
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    setLoadErr(false);
    try {
      const [osRes, unitsRes, techsRes] = await Promise.all([
        api.get(`/work-orders/${id}`),
        api.get("/units"),
        api.get("/technicians"),
      ]);
      setOs(osRes.data);
      setUnits(unitsRes.data);
      setTechs(techsRes.data);
    } catch {
      setLoadErr(true);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const canEdit = os && os.status !== "CONCLUIDA" && os.status !== "CANCELADA";
  const isAdmin = user?.role === "ADMIN";

  function startEdit() {
    setEditForm({
      tipo:          os.tipo,
      local:         os.local,
      problema:      os.problema || "",
      materiais:     os.materiais || "",
      prazo:         os.prazo ? new Date(os.prazo).toISOString().slice(0, 10) : "",
      unitId:        os.unit ? String(os.unit.id) : "",
      nomeEvento:    os.nomeEvento    || "",
      startDateTime: os.startDateTime ? new Date(os.startDateTime).toISOString().slice(0, 16) : "",
      endDateTime:   os.endDateTime   ? new Date(os.endDateTime).toISOString().slice(0, 16)   : "",
    });
    setEditing(true);
    setErr("");
  }

  async function saveEdit() {
    setSaving(true);
    setErr("");
    try {
      const payload = {
        tipo:      editForm.tipo,
        local:     editForm.local,
        problema:  editForm.problema  || null,
        materiais: editForm.materiais || null,
        prazo:     editForm.prazo ? new Date(editForm.prazo).toISOString() : null,
        unitId:    editForm.unitId ? Number(editForm.unitId) : null,
      };
      if (editForm.tipo === "ACAO") {
        payload.nomeEvento    = editForm.nomeEvento    || null;
        payload.startDateTime = editForm.startDateTime ? new Date(editForm.startDateTime).toISOString() : null;
        payload.endDateTime   = editForm.endDateTime   ? new Date(editForm.endDateTime).toISOString()   : null;
      }
      const res = await api.patch(`/work-orders/${id}`, payload);
      setOs(res.data);
      setEditing(false);
    } catch (e) {
      setErr(e.response?.data?.error || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function doTransition({ toStatus, note, relatorio }) {
    setErr("");
    try {
      const res = await api.post(`/work-orders/${id}/transition`, { toStatus, note, relatorio });
      setOs(res.data);
      setTrans(null);
    } catch (e) { setErr(e.response?.data?.error || "Erro na transição"); }
  }

  async function addTecnico(userId) {
    try {
      const res = await api.post(`/work-orders/${id}/tecnicos`, { userId });
      setOs(res.data);
    } catch (e) { setErr(e.response?.data?.error || "Erro ao adicionar técnico"); }
  }

  async function removeTecnico(userId) {
    try {
      const res = await api.delete(`/work-orders/${id}/tecnicos/${userId}`);
      setOs(res.data);
    } catch (e) { setErr(e.response?.data?.error || "Erro ao remover técnico"); }
  }

  async function linkTicket(ticketId) {
    try {
      const res = await api.post(`/work-orders/${id}/tickets`, { ticketId });
      setOs(res.data);
      setShowLink(false);
    } catch (e) { setErr(e.response?.data?.error || "Erro ao vincular chamado"); }
  }

  async function unlinkTicket(ticketId) {
    try {
      const res = await api.delete(`/work-orders/${id}/tickets/${ticketId}`);
      setOs(res.data);
    } catch (e) { setErr(e.response?.data?.error || "Erro ao desvincular chamado"); }
  }

  async function deleteOs() {
    try {
      await api.delete(`/work-orders/${id}`);
      nav("/painel/os");
    } catch (e) {
      setErr(e.response?.data?.error || "Erro ao excluir OS");
    }
  }

  if (loadErr) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-gray-950">
      <AlertTriangle size={32} className="text-red-400" />
      <p className="text-slate-600 dark:text-gray-400">Não foi possível carregar a OS.</p>
      <button onClick={load} className="btn-secondary text-sm px-4 py-2">Tentar novamente</button>
    </div>
  );

  if (!os) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-950">
      <Spinner className="h-8 w-8" />
    </div>
  );

  const unitOptions = [
    { value: "", label: "A definir" },
    ...units.map((u) => ({ value: String(u.id), label: u.name })),
  ];

  const assignedTechIds = new Set(os.tecnicos.map((t) => t.id));
  const availableTechs  = techs.filter((t) => !assignedTechIds.has(t.id));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <AppHeader />

      {/* Sub-header */}
      <div className="bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-4 h-12 flex items-center gap-3 text-sm">
          <Link to="/painel/os" className="flex items-center gap-1.5 text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200 transition">
            <ArrowLeft size={14} /> OS
          </Link>
          <ChevronRight size={14} className="text-slate-300 dark:text-gray-600" />
          <span className="font-mono text-slate-600 dark:text-gray-300">{os.osNumber}</span>
          <div className="ml-auto flex items-center gap-2">
            <OsStatusBadge status={os.status} />
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">
        {err && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            <AlertTriangle size={15} /> {err}
            <button onClick={() => setErr("")} className="ml-auto"><X size={14} /></button>
          </div>
        )}

        {/* Progresso da Ação (stepper) */}
        {os.tipo === "ACAO" && os.preVisita && (() => {
          const pv = os.preVisita;
          const pvDone = pv.status === "CONCLUIDA";
          const stages = [
            { key: "visita",  label: "Visita Técnica", status: pv.status,  osNumber: pv.osNumber, href: `/painel/os/${pv.id}` },
            { key: "acao",    label: "Ação",           status: os.status,  osNumber: os.osNumber, href: null },
          ];
          const activeStage = pvDone ? 1 : 0;

          return (
            <div className="card p-4">
              <div className="flex items-center gap-0">
                {stages.map((stage, i) => {
                  const isActive  = i === activeStage;
                  const isDone    = stage.status === "CONCLUIDA";
                  const isLocked  = i > activeStage;
                  const statusStyle = {
                    ABERTA:       "text-amber-600 dark:text-amber-400",
                    EM_ANDAMENTO: "text-blue-600 dark:text-blue-400",
                    CONCLUIDA:    "text-emerald-600 dark:text-emerald-400",
                    CANCELADA:    "text-slate-400 dark:text-gray-500",
                  }[stage.status] ?? "";

                  const dot = isDone
                    ? "bg-emerald-500"
                    : isActive
                    ? "bg-brand-500 ring-4 ring-brand-200 dark:ring-brand-900/60"
                    : "bg-slate-200 dark:bg-gray-700";

                  return (
                    <div key={stage.key} className="flex items-center flex-1">
                      <div className={`flex flex-col items-center gap-1 ${isLocked ? "opacity-40" : ""}`}>
                        <div className={`w-3 h-3 rounded-full shrink-0 transition-all ${dot}`} />
                        <div className="text-center">
                          <div className={`text-xs font-semibold ${isActive ? "text-slate-800 dark:text-gray-100" : "text-slate-500 dark:text-gray-400"}`}>
                            {stage.href ? (
                              <Link to={stage.href} className="hover:underline">{stage.label}</Link>
                            ) : stage.label}
                          </div>
                          <div className={`text-[11px] font-medium mt-0.5 ${statusStyle}`}>
                            {STATUS_LABEL[stage.status] ?? stage.status}
                          </div>
                          {stage.href && (
                            <div className="text-[10px] text-slate-400 dark:text-gray-600 font-mono">{stage.osNumber}</div>
                          )}
                        </div>
                      </div>
                      {i < stages.length - 1 && (
                        <div className={`flex-1 h-0.5 mx-3 rounded transition-colors ${pvDone ? "bg-emerald-400" : "bg-slate-200 dark:bg-gray-700"}`} />
                      )}
                    </div>
                  );
                })}
              </div>

              {!pvDone && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  <AlertTriangle size={13} className="shrink-0" />
                  A Ação só pode ser iniciada após a conclusão da{" "}
                  <Link to={`/painel/os/${pv.id}`} className="font-semibold underline underline-offset-2">
                    Visita Técnica ({pv.osNumber})
                  </Link>
                </div>
              )}
            </div>
          );
        })()}

        {/* Barra de ações */}
        <div className="flex items-center gap-2 flex-wrap">
          {os.allowedNext.map((next) => {
            const cfg = TRANSITION_CONFIG[next];
            if (!cfg) return null;
            const Icon = cfg.icon;
            // Block "Iniciar" for Ação until pre-visit is done
            const blocked = next === "EM_ANDAMENTO" && os.tipo === "ACAO" && os.preVisita && os.preVisita.status !== "CONCLUIDA";
            return (
              <button
                key={next}
                onClick={() => !blocked && setTrans(next)}
                disabled={blocked}
                title={blocked ? "Conclua a visita técnica primeiro" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  blocked ? "opacity-40 cursor-not-allowed bg-slate-200 dark:bg-gray-700 text-slate-500 dark:text-gray-400" : cfg.cls
                }`}
              >
                <Icon size={14} /> {cfg.label}
              </button>
            );
          })}
          {canEdit && !editing && (
            <button
              onClick={startEdit}
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand-300 dark:border-brand-700 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/50 px-4 py-2 text-sm font-semibold transition"
            >
              <Edit2 size={14} /> Editar OS
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowDelete(true)}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 px-4 py-2 text-sm font-semibold transition"
            >
              <Trash2 size={14} /> Excluir OS
            </button>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-5">

          {/* Coluna principal */}
          <div className="md:col-span-2 space-y-4">

            {/* Informações gerais */}
            <div className="card p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-2">
                <Wrench size={14} className="text-brand-600" /> Informações da OS
              </h2>

              {editing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="field-label">Tipo</label>
                      <select value={editForm.tipo} onChange={(e) => setEditForm({ ...editForm, tipo: e.target.value })} className="field-input text-sm">
                        {TIPO_OPTIONS.map((t) => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="field-label">Núcleo responsável</label>
                      <select value={editForm.unitId} onChange={(e) => setEditForm({ ...editForm, unitId: e.target.value })} className="field-input text-sm">
                        <option value="">A definir</option>
                        {units.map((u) => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="field-label">Local / Destino *</label>
                    <input
                      type="text" required
                      value={editForm.local}
                      onChange={(e) => setEditForm({ ...editForm, local: e.target.value })}
                      className="field-input text-sm"
                    />
                  </div>

                  {editForm.tipo === "ACAO" && (
                    <>
                      <div>
                        <label className="field-label">Nome do evento</label>
                        <input
                          type="text"
                          value={editForm.nomeEvento}
                          onChange={(e) => setEditForm({ ...editForm, nomeEvento: e.target.value })}
                          className="field-input text-sm"
                          placeholder="Nome do evento"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="field-label">Início do evento</label>
                          <DateTimeInput
                            value={editForm.startDateTime}
                            onChange={(v) => setEditForm({ ...editForm, startDateTime: v })}
                          />
                        </div>
                        <div>
                          <label className="field-label">Término do evento</label>
                          <DateTimeInput
                            value={editForm.endDateTime}
                            onChange={(v) => setEditForm({ ...editForm, endDateTime: v })}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="field-label">Descrição / Problema</label>
                    <textarea
                      rows={3} value={editForm.problema}
                      onChange={(e) => setEditForm({ ...editForm, problema: e.target.value })}
                      className="field-input text-sm resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="field-label">Materiais / Equipamentos</label>
                      <input
                        type="text" value={editForm.materiais}
                        onChange={(e) => setEditForm({ ...editForm, materiais: e.target.value })}
                        className="field-input text-sm"
                      />
                    </div>
                    <div>
                      <label className="field-label">Prazo</label>
                      <DateInput
                        value={editForm.prazo}
                        onChange={(v) => setEditForm({ ...editForm, prazo: v })}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      onClick={() => { setEditing(false); setErr(""); }}
                      className="btn-secondary text-sm py-2 px-4"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={saveEdit}
                      disabled={saving || !editForm.local?.trim()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-semibold transition disabled:opacity-60"
                    >
                      {saving ? <Spinner className="h-4 w-4" /> : <Check size={14} />}
                      Salvar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoRow label="Tipo" value={TIPO_LABELS[os.tipo]} />
                    <InfoRow label="Núcleo responsável" value={os.unit?.name} />
                  </div>
                  <InfoRow label="Local / Destino" value={os.local} />
                  <InfoRow label="Descrição / Problema" value={os.problema} />
                  <InfoRow label="Materiais / Equipamentos" value={os.materiais} />
                  {os.prazo && <InfoRow label="Prazo" value={fmtDate(os.prazo)} />}
                </div>
              )}

              {os.relatorio && (
                <div>
                  <div className="text-xs text-slate-400 dark:text-gray-500 mb-0.5">Relatório de conclusão</div>
                  <div className="text-sm text-slate-800 dark:text-gray-100 whitespace-pre-wrap bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
                    {os.relatorio}
                  </div>
                </div>
              )}
            </div>

            {/* ── Seção Ação ─────────────────────────────────────────── */}
            {os.tipo === "ACAO" && (
              <>
                {/* Informações do Evento */}
                <div className="card p-5 space-y-4">
                  <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-2">
                    <Zap size={14} className="text-purple-500" /> Informações do Evento
                  </h2>
                  <div className="space-y-3">
                    <InfoRow label="Nome do evento" value={os.nomeEvento} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-slate-400 dark:text-gray-500 mb-0.5 flex items-center gap-1"><CalendarRange size={11} /> Início</div>
                        <div className="text-sm text-slate-800 dark:text-gray-100">{os.startDateTime ? fmtDate(os.startDateTime) : "—"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 dark:text-gray-500 mb-0.5 flex items-center gap-1"><CalendarRange size={11} /> Término</div>
                        <div className="text-sm text-slate-800 dark:text-gray-100">{os.endDateTime ? fmtDate(os.endDateTime) : "—"}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lista de Materiais */}
                {os.checklist && (
                  <div className="card p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-2">
                        <Package size={14} className="text-brand-600" />
                        Lista de Materiais
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CHECKLIST_STATUS_STYLE[os.checklist.status]}`}>
                          {CHECKLIST_STATUS_LABEL[os.checklist.status]}
                        </span>
                      </h2>
                      <Link
                        to={`/painel/inventario/checklists/${os.checklist.id}`}
                        className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline"
                      >
                        Ver detalhes <ExternalLink size={11} />
                      </Link>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-gray-400 font-medium">{os.checklist.title}</div>
                    {os.checklist.items?.length > 0 ? (
                      <div className="rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
                        <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-100 dark:border-gray-700/60 bg-slate-50 dark:bg-gray-800/60">
                              <th className="px-3 py-2 text-left text-slate-400 dark:text-gray-500 font-medium">Item</th>
                              <th className="px-3 py-2 text-left text-slate-400 dark:text-gray-500 font-medium">Tombo</th>
                              <th className="px-3 py-2 text-left text-slate-400 dark:text-gray-500 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 dark:divide-gray-800/60">
                            {os.checklist.items.map((ci) => (
                              <tr key={ci.id}>
                                <td className="px-3 py-2 text-slate-700 dark:text-gray-300">{ci.item?.name ?? "—"}</td>
                                <td className="px-3 py-2 text-slate-500 dark:text-gray-400 font-mono">{ci.tombo ?? `#${ci.unitId}`}</td>
                                <td className="px-3 py-2">
                                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                    ci.status === "EM_USO"    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" :
                                    ci.status === "DISPONIVEL" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" :
                                    "bg-slate-100 text-slate-500 dark:bg-gray-800 dark:text-gray-400"
                                  }`}>
                                    {ci.status === "EM_USO" ? "Em uso" : ci.status === "DISPONIVEL" ? "Disponível" : ci.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 dark:text-gray-500">Nenhum material na lista.</p>
                    )}
                  </div>
                )}

                {/* Visita Técnica Prévia */}
                {os.preVisita && (
                  <div className="card p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-2">
                        <ClipboardCheck size={14} className="text-brand-600" /> Visita Técnica Prévia
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          STATUS_STYLE[os.preVisita.status] ?? "bg-slate-100 text-slate-500"
                        }`}>
                          {STATUS_LABEL[os.preVisita.status] ?? os.preVisita.status}
                        </span>
                      </h2>
                      <Link
                        to={`/painel/os/${os.preVisita.id}`}
                        className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline"
                      >
                        <span className="font-mono">{os.preVisita.osNumber}</span>
                        <ExternalLink size={11} />
                      </Link>
                    </div>
                    <div className="space-y-2 text-sm">
                      <InfoRow label="Local da visita" value={os.preVisita.local} />
                      {os.preVisita.startDateTime && (
                        <InfoRow label="Data/hora" value={fmtDate(os.preVisita.startDateTime)} />
                      )}
                      {os.preVisita.tecnicos?.length > 0 && (
                        <div>
                          <div className="text-xs text-slate-400 dark:text-gray-500 mb-1">Técnicos da visita</div>
                          <div className="flex flex-wrap gap-1.5">
                            {os.preVisita.tecnicos.map((t) => (
                              <span key={t.id} className="text-xs bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-400 rounded-full px-2 py-0.5">
                                {t.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Chamados vinculados */}
            <div className="card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-2">
                  <Link2 size={14} className="text-brand-600" />
                  Chamados vinculados
                  {os.tickets.length > 0 && (
                    <span className="text-xs font-normal text-slate-400">({os.tickets.length})</span>
                  )}
                </h2>
                {canEdit && (
                  <button
                    onClick={() => setShowLink(true)}
                    className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    <Plus size={12} /> Vincular
                  </button>
                )}
              </div>

              {os.tickets.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-gray-500">Nenhum chamado vinculado.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-gray-700/60 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
                  {os.tickets.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-slate-400">{t.ticketNumber}</span>
                          <StatusBadge status={t.status} />
                        </div>
                        <div className="text-sm text-slate-700 dark:text-gray-300 truncate">{t.requesterName}</div>
                        <div className="text-xs text-slate-400">{t.department}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Link to={`/painel/chamado/${t.id}`} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">
                          Ver
                        </Link>
                        {canEdit && (
                          <button onClick={() => unlinkTicket(t.id)} className="ml-1 text-slate-400 hover:text-red-500 transition">
                            <Unlink size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Coluna lateral */}
          <div className="space-y-4">

            {/* Datas */}
            <div className="card p-4 space-y-2">
              <h2 className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">Datas</h2>
              {[
                { label: "Criada",         val: os.createdAt    },
                { label: "Iniciada",       val: os.startedAt    },
                { label: "Concluída",      val: os.concludedAt  },
                { label: "Cancelada",      val: os.cancelledAt  },
                { label: "Prazo limite",   val: os.prazo        },
                ...(os.tipo === "ACAO" ? [
                  { label: "Início do evento", val: os.startDateTime },
                  { label: "Fim do evento",    val: os.endDateTime   },
                ] : []),
              ].map(({ label, val }) => val ? (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-slate-400 dark:text-gray-500">{label}</span>
                  <span className="text-slate-700 dark:text-gray-300 font-medium">{fmtDate(val)}</span>
                </div>
              ) : null)}
              {os.createdBy && (
                <div className="flex justify-between text-xs pt-1 border-t border-slate-100 dark:border-gray-700/60 mt-1">
                  <span className="text-slate-400 dark:text-gray-500">Aberta por</span>
                  <span className="text-slate-700 dark:text-gray-300">{os.createdBy.name.split(" ")[0]}</span>
                </div>
              )}
            </div>

            {/* Técnicos */}
            <div className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Users size={12} /> Equipe
                </h2>
              </div>

              {os.tecnicos.length === 0 && (
                <p className="text-sm text-slate-400 dark:text-gray-500">Nenhum técnico atribuído.</p>
              )}

              <div className="space-y-1.5">
                {os.tecnicos.map((t) => (
                  <div key={t.id} className="flex items-center justify-between">
                    <span className="text-sm text-slate-700 dark:text-gray-300">{t.name}</span>
                    {canEdit && (
                      <button onClick={() => removeTecnico(t.id)} className="text-slate-400 hover:text-red-500 transition">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {canEdit && availableTechs.length > 0 && (
                <div>
                  <select
                    defaultValue=""
                    onChange={(e) => { if (e.target.value) { addTecnico(Number(e.target.value)); e.target.value = ""; } }}
                    className="field-input py-1.5 text-xs w-full"
                  >
                    <option value="">+ Adicionar técnico</option>
                    {availableTechs.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Histórico */}
            {os.history?.length > 0 && (
              <div className="card p-4 space-y-2">
                <h2 className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">Histórico</h2>
                <div className="space-y-2">
                  {os.history.map((h) => (
                    <div key={h.id} className="text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">{new Date(h.createdAt).toLocaleDateString("pt-BR")}</span>
                        {h.fromStatus && <span className="text-slate-400">{STATUS_LABEL[h.fromStatus]} →</span>}
                        <span className="font-medium text-slate-700 dark:text-gray-300">{STATUS_LABEL[h.toStatus]}</span>
                        {h.actor && <span className="text-slate-400">por {h.actor.name.split(" ")[0]}</span>}
                      </div>
                      {h.note && <div className="text-slate-500 dark:text-gray-400 mt-0.5 pl-2 border-l border-slate-200 dark:border-gray-700">{h.note}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {transition && (
        <TransitionModal
          toStatus={transition}
          onConfirm={doTransition}
          onClose={() => setTrans(null)}
        />
      )}

      {showLinkTicket && (
        <LinkTicketModal
          onLink={linkTicket}
          onClose={() => setShowLink(false)}
        />
      )}

      {showDelete && (
        <DeleteOsModal
          osNumber={os.osNumber}
          onConfirm={deleteOs}
          onClose={() => setShowDelete(false)}
        />
      )}
    </div>
  );
}
