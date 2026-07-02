import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { api } from "../lib/api";
import { useSocket } from "../context/SocketContext";
import { Spinner } from "../components/ui";
import AppHeader from "../components/AppHeader";
import { OS_STATUS_LABEL, OS_STATUS_STYLE } from "../lib/osConstants";
import {
  ClipboardList, Plus, ChevronRight, MapPin,
  Users, Filter, RefreshCw, Clock, Monitor, X, Check,
} from "lucide-react";

const STATUS_TABS = [
  { key: "",             label: "Todas"        },
  { key: "ABERTA",       label: "Abertas"      },
  { key: "EM_ANDAMENTO", label: "Em Andamento" },
  { key: "CONCLUIDA",    label: "Concluídas"   },
];

function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function OsStatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${OS_STATUS_STYLE[status] || "bg-slate-100 text-slate-600"}`}>
      {OS_STATUS_LABEL[status] || status}
    </span>
  );
}

function TipoBadge({ tipo }) {
  if (!tipo) return null;
  return (
    <span
      className="text-xs rounded px-1.5 py-0.5 font-medium"
      style={{ backgroundColor: tipo.color + "22", color: tipo.color }}
    >
      {tipo.name}
    </span>
  );
}

// ── Campo dinâmico ────────────────────────────────────────────────────────────
function DynamicField({ field, value, onChange }) {
  const cls = "field-input text-sm";
  const val = value ?? "";

  if (field.type === "textarea") {
    return (
      <div>
        <label className="field-label">{field.label}{field.required && " *"}</label>
        <textarea rows={3} value={val} onChange={(e) => onChange(e.target.value)}
          required={field.required} className={`${cls} resize-none`} />
      </div>
    );
  }
  if (field.type === "select") {
    return (
      <div>
        <label className="field-label">{field.label}{field.required && " *"}</label>
        <select value={val} onChange={(e) => onChange(e.target.value)} required={field.required} className={cls}>
          <option value="">Selecione...</option>
          {(field.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
    );
  }
  if (field.type === "multiselect") {
    const arr = Array.isArray(value) ? value : [];
    return (
      <div>
        <label className="field-label">{field.label}{field.required && " *"}</label>
        <div className="flex flex-wrap gap-2">
          {(field.options || []).map((opt) => {
            const checked = arr.includes(opt);
            return (
              <label key={opt} className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm cursor-pointer transition ${
                checked
                  ? "border-brand-400 dark:border-brand-600 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300"
                  : "border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300"
              }`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onChange(checked ? arr.filter((o) => o !== opt) : [...arr, opt])}
                  className="h-3.5 w-3.5 rounded"
                />
                {opt}
              </label>
            );
          })}
        </div>
      </div>
    );
  }
  if (field.type === "date") {
    return (
      <div>
        <label className="field-label">{field.label}{field.required && " *"}</label>
        <input type="date" value={val} onChange={(e) => onChange(e.target.value)} required={field.required} className={cls} />
      </div>
    );
  }
  if (field.type === "datetime") {
    return (
      <div>
        <label className="field-label">{field.label}{field.required && " *"}</label>
        <input type="datetime-local" value={val} onChange={(e) => onChange(e.target.value)} required={field.required} className={cls} />
      </div>
    );
  }
  if (field.type === "number") {
    return (
      <div>
        <label className="field-label">{field.label}{field.required && " *"}</label>
        <input type="number" value={val} onChange={(e) => onChange(e.target.value)} required={field.required} className={cls} />
      </div>
    );
  }
  if (field.type === "checkbox") {
    return (
      <div className="flex items-center gap-2 pt-1">
        <input type="checkbox" id={`field-${field.key}`} checked={!!val} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded" />
        <label htmlFor={`field-${field.key}`} className="text-sm text-slate-700 dark:text-gray-300">{field.label}</label>
      </div>
    );
  }
  return (
    <div>
      <label className="field-label">{field.label}{field.required && " *"}</label>
      <input type="text" value={val} onChange={(e) => onChange(e.target.value)} required={field.required} className={cls} />
    </div>
  );
}

// ── Modal de criação ──────────────────────────────────────────────────────────
const EMPTY_NEW_ASSET = { tombo: "", hostname: "", cpu: "", ram: "", storage: "", operatingSystem: "", setor: "", responsavel: "" };

function CreateOsModal({ onClose, onCreate, units, types, preTicketId = null }) {
  const [tipoId, setTipoId]       = useState(types[0]?.id ?? "");
  const [formData, setFormData]   = useState({});
  const [unitId, setUnitId]       = useState("");
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState("");
  const [assetSearch, setAssetSearch]   = useState("");
  const [assetResults, setAssetResults] = useState([]);
  const [assetLoading, setAssetLoading] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showNewAsset, setShowNewAsset]   = useState(false);
  const [newAssetForm, setNewAssetForm]   = useState(EMPTY_NEW_ASSET);
  const [creatingAsset, setCreatingAsset] = useState(false);
  const [assetErr, setAssetErr]           = useState("");

  const selectedType = types.find((t) => t.id === Number(tipoId));
  const fields = selectedType?.fields ?? [];

  useEffect(() => {
    if (!assetSearch.trim()) { setAssetResults([]); setAssetLoading(false); return; }
    setAssetLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.get("/assets", { params: { search: assetSearch, limit: 10 } });
        setAssetResults(res.data.assets ?? res.data);
      } catch {} finally { setAssetLoading(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [assetSearch]);

  function setField(key, val) {
    setFormData((prev) => ({ ...prev, [key]: val }));
  }

  async function handleCreateAsset() {
    const f = newAssetForm;
    if (!f.hostname.trim())        { setAssetErr("Hostname é obrigatório"); return; }
    if (!f.cpu.trim())             { setAssetErr("CPU é obrigatória"); return; }
    if (!f.ram.trim())             { setAssetErr("RAM é obrigatória"); return; }
    if (!f.storage.trim())         { setAssetErr("Armazenamento é obrigatório"); return; }
    if (!f.operatingSystem.trim()) { setAssetErr("Sistema Operacional é obrigatório"); return; }

    setCreatingAsset(true);
    setAssetErr("");
    try {
      const payload = {
        hostname:        f.hostname.trim(),
        cpu:             f.cpu.trim(),
        ram:             f.ram.trim(),
        storage:         f.storage.trim(),
        operatingSystem: f.operatingSystem.trim(),
      };
      if (f.tombo.trim())       payload.tombo       = f.tombo.trim();
      if (f.setor.trim())       payload.setor       = f.setor.trim();
      if (f.responsavel.trim()) payload.responsavel = f.responsavel.trim();

      const res = await api.post("/assets", payload);
      setSelectedAsset(res.data);
      setShowNewAsset(false);
      setAssetSearch("");
      setAssetResults([]);
      setNewAssetForm(EMPTY_NEW_ASSET);
    } catch (e) {
      setAssetErr(e.response?.data?.error || "Erro ao cadastrar ativo");
    } finally {
      setCreatingAsset(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      const res = await api.post("/work-orders", {
        tipoId:   Number(tipoId),
        formData,
        unitId:   unitId ? Number(unitId) : null,
        assetId:  selectedAsset?.id ?? null,
        ticketId: preTicketId ? Number(preTicketId) : null,
      });
      onCreate(res.data);
    } catch (e) {
      setErr(e.response?.data?.error || "Erro ao criar OS");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400">
            <ClipboardList size={20} />
          </span>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-gray-100">Nova Ordem de Serviço</h3>
            <p className="text-xs text-slate-500 dark:text-gray-400">Campos com * são obrigatórios</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="field-label">Tipo *</label>
              <select
                value={tipoId}
                onChange={(e) => { setTipoId(e.target.value); setFormData({}); }}
                className="field-input"
                required
              >
                {types.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Núcleo responsável</label>
              <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className="field-input">
                <option value="">A definir</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          {/* Ativo */}
          <div>
            <label className="field-label flex items-center gap-1.5"><Monitor size={12} /> Ativo <span className="text-slate-400 font-normal">(opcional)</span></label>
            {selectedAsset ? (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Monitor size={13} className="text-brand-500 shrink-0" />
                  {selectedAsset.tombo && <span className="text-xs font-mono text-slate-500 dark:text-gray-400">{selectedAsset.tombo}</span>}
                  <span className="text-sm font-medium text-slate-800 dark:text-gray-100">{selectedAsset.hostname}</span>
                </div>
                <button type="button" onClick={() => setSelectedAsset(null)} className="text-slate-400 hover:text-red-500 transition">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <input
                    type="text"
                    value={assetSearch}
                    onChange={(e) => { setAssetSearch(e.target.value); setShowNewAsset(false); }}
                    placeholder="Buscar por tombo ou hostname..."
                    className="field-input pr-8"
                  />
                  {assetLoading && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      <Spinner className="h-4 w-4" />
                    </div>
                  )}
                  {assetResults.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 top-full mt-1 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg max-h-48 overflow-y-auto">
                      {assetResults.map((a) => (
                        <button
                          type="button"
                          key={a.id}
                          onClick={() => { setSelectedAsset(a); setAssetSearch(""); setAssetResults([]); }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-gray-800 transition flex items-center gap-2"
                        >
                          {a.tombo && <span className="text-xs font-mono text-slate-400 dark:text-gray-500">{a.tombo}</span>}
                          <span className="text-sm text-slate-700 dark:text-gray-300">{a.hostname}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* "Nenhum encontrado" + botão cadastrar */}
                {!assetLoading && assetSearch.trim() && assetResults.length === 0 && !showNewAsset && (
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-xs text-slate-400 dark:text-gray-500">Nenhum ativo encontrado.</span>
                    <button
                      type="button"
                      onClick={() => setShowNewAsset(true)}
                      className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-0.5"
                    >
                      <Plus size={11} /> Cadastrar novo
                    </button>
                  </div>
                )}

                {/* Formulário inline de novo ativo */}
                {showNewAsset && (
                  <div className="mt-2 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/20 p-3 space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-brand-700 dark:text-brand-300 flex items-center gap-1">
                        <Monitor size={11} /> Novo ativo
                      </span>
                      <button type="button" onClick={() => { setShowNewAsset(false); setAssetErr(""); }} className="text-slate-400 hover:text-red-500 transition">
                        <X size={13} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { k: "tombo",           label: "Tombo",              optional: true  },
                        { k: "hostname",        label: "Hostname",           optional: false },
                        { k: "cpu",             label: "Processador (CPU)",  optional: false },
                        { k: "ram",             label: "Memória RAM",        optional: false },
                        { k: "storage",         label: "HD / SSD",           optional: false },
                        { k: "operatingSystem", label: "Sistema Operacional",optional: false },
                        { k: "setor",           label: "Setor",              optional: true  },
                        { k: "responsavel",     label: "Responsável",        optional: true  },
                      ].map(({ k, label, optional }) => (
                        <div key={k}>
                          <label className="field-label text-xs">
                            {label}{optional ? <span className="text-slate-400 font-normal ml-0.5">(opc.)</span> : " *"}
                          </label>
                          <input
                            type="text"
                            value={newAssetForm[k]}
                            onChange={(e) => setNewAssetForm((p) => ({ ...p, [k]: e.target.value }))}
                            className="field-input text-xs py-1.5"
                          />
                        </div>
                      ))}
                    </div>
                    {assetErr && <p className="text-xs text-red-600 dark:text-red-400">{assetErr}</p>}
                    <button
                      type="button" onClick={handleCreateAsset} disabled={creatingAsset}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 dark:text-brand-300 hover:text-brand-900 dark:hover:text-brand-100 disabled:opacity-50 transition"
                    >
                      {creatingAsset ? <Spinner className="h-3.5 w-3.5" /> : <Check size={12} />}
                      Cadastrar e selecionar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Chamado vinculado (quando vindo de uma OS anterior) */}
          {preTicketId && (
            <div className="flex items-center gap-2 rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 px-3 py-2 text-xs text-brand-700 dark:text-brand-300">
              <Check size={13} className="shrink-0" />
              OS será vinculada ao chamado selecionado
            </div>
          )}

          {fields.map((field) => (
            <DynamicField
              key={field.key}
              field={field}
              value={formData[field.key]}
              onChange={(val) => setField(field.key, val)}
            />
          ))}

          {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="btn-secondary text-sm py-2 px-4">Cancelar</button>
            <button
              type="submit" disabled={saving || !tipoId}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-semibold transition disabled:opacity-60"
            >
              {saving ? <Spinner className="h-4 w-4" /> : <Plus size={14} />}
              Criar OS
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Página ─────────────────────────────────────────────────────────────────────
export default function WorkOrdersPage() {
  const socket   = useSocket();
  const nav      = useNavigate();
  const location = useLocation();

  const [orders, setOrders]         = useState([]);
  const [units, setUnits]           = useState([]);
  const [types, setTypes]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setStatus]   = useState("");
  const [tipoFilter, setTipo]       = useState("");
  const [unitFilter, setUnit]       = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // Auto-abre o modal quando vindo de outra OS (?newOs=1)
  useEffect(() => {
    if (new URLSearchParams(location.search).get("newOs")) setShowCreate(true);
  }, [location.search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (tipoFilter)  params.tipoId = tipoFilter;
      if (unitFilter)  params.unitId = unitFilter;
      if (dateFilter) {
        params.from = new Date(dateFilter + "T00:00:00").toISOString();
        params.to   = new Date(dateFilter + "T23:59:59").toISOString();
      }
      const res = await api.get("/work-orders", { params });
      setOrders(res.data);
    } finally {
      setLoading(false);
    }
  }, [tipoFilter, unitFilter, dateFilter]);

  useEffect(() => {
    Promise.all([api.get("/units"), api.get("/work-order-types")]).then(([u, t]) => {
      setUnits(u.data);
      setTypes(t.data);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const s = socket?.current;
    if (!s) return;
    const refresh = () => load();
    s.on("workorder:created", refresh);
    s.on("workorder:updated", refresh);
    s.on("workorder:deleted", refresh);
    return () => {
      s.off("workorder:created", refresh);
      s.off("workorder:updated", refresh);
      s.off("workorder:deleted", refresh);
    };
  }, [socket, load]);

  function handleCreated(os) {
    setShowCreate(false);
    nav(`/painel/os/${os.id}`);
  }

  const hasFilters = tipoFilter || unitFilter || dateFilter;
  const visible    = statusFilter ? orders.filter((o) => o.status === statusFilter) : orders;
  const tabCounts  = STATUS_TABS.reduce((acc, tab) => {
    acc[tab.key] = tab.key ? orders.filter((o) => o.status === tab.key).length : orders.length;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <AppHeader />

      <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-5">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList size={20} className="text-brand-600" />
            <h1 className="text-lg font-semibold text-slate-900 dark:text-gray-100">Ordens de Serviço</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition"
            >
              <RefreshCw size={13} /> Atualizar
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-3.5 py-2 text-sm font-semibold transition"
            >
              <Plus size={15} /> Nova OS
            </button>
          </div>
        </div>

        {/* Tabs de status */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-gray-700 pb-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatus(tab.key)}
                className={`relative pb-2 text-sm font-medium transition ${
                  statusFilter === tab.key
                    ? "text-brand-600 dark:text-brand-400"
                    : "text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {tab.label}
                  {tabCounts[tab.key] > 0 && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium leading-none ${
                      statusFilter === tab.key
                        ? "bg-brand-200 dark:bg-brand-800/60 text-brand-800 dark:text-brand-300"
                        : "bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-400"
                    }`}>
                      {tabCounts[tab.key]}
                    </span>
                  )}
                </span>
                {statusFilter === tab.key && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-brand-600 dark:bg-brand-400" />
                )}
              </button>
            ))}
            <span className="ml-auto text-xs text-slate-400 dark:text-gray-500">{visible.length} OS</span>
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={13} className="text-slate-400 dark:text-gray-500 shrink-0" />
            <select value={tipoFilter} onChange={(e) => setTipo(e.target.value)} className="field-input py-1.5 text-xs w-auto min-w-0 max-w-[220px]">
              <option value="">Todos os tipos</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select value={unitFilter} onChange={(e) => setUnit(e.target.value)} className="field-input py-1.5 text-xs w-auto min-w-0 max-w-[180px]">
              <option value="">Todos os núcleos</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="field-input py-1.5 text-xs w-auto"
              title="Filtrar por data de criação"
            />
            {hasFilters && (
              <button
                onClick={() => { setTipo(""); setUnit(""); setDateFilter(""); }}
                className="text-xs text-slate-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Spinner className="h-8 w-8" />
          </div>
        )}

        {/* Empty */}
        {!loading && visible.length === 0 && (
          <div className="card p-14 text-center">
            <ClipboardList size={44} className="mx-auto text-slate-300 dark:text-gray-700 mb-4" />
            <div className="font-semibold text-slate-700 dark:text-gray-300">
              {(hasFilters || statusFilter) ? "Nenhuma OS encontrada com os filtros ativos" : "Nenhuma OS encontrada"}
            </div>
            {(hasFilters || statusFilter) && (
              <button
                onClick={() => { setTipo(""); setUnit(""); setStatus(""); setDateFilter(""); }}
                className="mt-3 text-brand-600 dark:text-brand-400 hover:underline text-sm font-medium"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}

        {/* Lista */}
        {!loading && visible.length > 0 && (
          <div className="card divide-y divide-slate-100 dark:divide-gray-700/60">
            {visible.map((os) => {
              const prazo = os.formData?.prazo;
              const local = os.formData?.local || os.formData?.nomeEvento || "";
              const overdue = prazo && new Date(prazo) < new Date() && !["CONCLUIDA","CANCELADA"].includes(os.status);
              return (
                <Link
                  key={os.id}
                  to={`/painel/os/${os.id}`}
                  className={`group flex items-center gap-3 px-4 py-3.5 transition ${
                    overdue
                      ? "bg-red-50/60 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20"
                      : "hover:bg-slate-50 dark:hover:bg-gray-800/60"
                  }`}
                >
                  {/* Cor do tipo */}
                  {os.tipo && (
                    <div
                      className="w-1 self-stretch rounded-full shrink-0"
                      style={{ backgroundColor: os.tipo.color }}
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-slate-400 dark:text-gray-500">{os.osNumber}</span>
                      <OsStatusBadge status={os.status} />
                      <TipoBadge tipo={os.tipo} />
                    </div>
                    {local && (
                      <div className="text-sm font-medium text-slate-800 dark:text-gray-100 mt-0.5 truncate flex items-center gap-1.5">
                        <MapPin size={11} className="text-slate-400 shrink-0" />
                        {local}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-0.5">
                      {os.unit && (
                        <span className="text-xs text-slate-400 dark:text-gray-500">{os.unit.name}</span>
                      )}
                      {os.tecnicos.length > 0 && (
                        <span className="text-xs text-slate-400 dark:text-gray-500 flex items-center gap-1">
                          <Users size={10} />
                          {os.tecnicos.length} técnico{os.tecnicos.length !== 1 ? "s" : ""}
                        </span>
                      )}
                      {os.tickets.length > 0 && (
                        <span className="text-xs text-slate-400 dark:text-gray-500">
                          {os.tickets.length} chamado{os.tickets.length !== 1 ? "s" : ""}
                        </span>
                      )}
                      {os.asset && (
                        <span className="text-xs font-mono text-slate-400 dark:text-gray-500 flex items-center gap-1">
                          <Monitor size={10} className="shrink-0" />
                          {os.asset.tombo}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 space-y-1">
                    {prazo && (
                      <div className={`text-xs flex items-center gap-1 justify-end ${overdue ? "text-red-500 dark:text-red-400 font-medium" : "text-slate-500 dark:text-gray-400"}`}>
                        <Clock size={10} />
                        {fmtDate(prazo)}
                        {overdue && <span className="text-[10px] uppercase tracking-wide">vencido</span>}
                      </div>
                    )}
                    <div className="text-xs text-slate-400 dark:text-gray-500">
                      {fmtDate(os.createdAt)}
                    </div>
                  </div>

                  <ChevronRight size={16} className="text-slate-300 dark:text-gray-600 group-hover:text-brand-500 transition shrink-0" />
                </Link>
              );
            })}
          </div>
        )}
      </main>

      {showCreate && types.length > 0 && (
        <CreateOsModal
          units={units}
          types={types}
          onClose={() => setShowCreate(false)}
          onCreate={handleCreated}
          preTicketId={new URLSearchParams(location.search).get("ticketId")}
        />
      )}
    </div>
  );
}
