import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Spinner } from "../components/ui";
import AppHeader from "../components/AppHeader";
import {
  Monitor, Plus, Search, RefreshCw, ChevronRight,
  MapPin, User, AlertTriangle, X, Check,
} from "lucide-react";

const STATUS_LABEL = {
  ATIVO:      "Ativo",
  INATIVO:    "Inativo",
  MANUTENCAO: "Em Manutenção",
  RECOLHIDO:  "Recolhido",
};

const STATUS_STYLE = {
  ATIVO:      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  INATIVO:    "bg-slate-100 text-slate-500 dark:bg-gray-800 dark:text-gray-400",
  MANUTENCAO: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  RECOLHIDO:  "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
};

const STATUS_TABS = [
  { key: "",          label: "Todos"         },
  { key: "ATIVO",     label: "Ativos"        },
  { key: "MANUTENCAO",label: "Manutenção"    },
  { key: "RECOLHIDO", label: "Recolhidos"    },
  { key: "INATIVO",   label: "Inativos"      },
];

// ── Modal de criação ──────────────────────────────────────────────────────────
function CreateAssetModal({ onClose, onCreate }) {
  const [form, setForm] = useState({
    tombo: "", hostname: "", cpu: "", ram: "", storage: "",
    operatingSystem: "", setor: "", responsavel: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  function set(k, v) { setForm((p) => ({ ...p, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setErr("");
    try {
      const res = await api.post("/assets", {
        ...form,
        setor:       form.setor       || null,
        responsavel: form.responsavel || null,
        notes:       form.notes       || null,
      });
      onCreate(res.data);
    } catch (ex) {
      setErr(ex.response?.data?.error || "Erro ao cadastrar ativo");
    } finally { setSaving(false); }
  }

  const Field = ({ label, k, required, placeholder }) => (
    <div>
      <label className="field-label">{label}{required && " *"}</label>
      <input
        type="text" value={form[k]} onChange={(e) => set(k, e.target.value)}
        required={required} placeholder={placeholder}
        className="field-input text-sm"
      />
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400">
            <Monitor size={20} />
          </span>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-gray-100">Cadastrar Ativo</h3>
            <p className="text-xs text-slate-500 dark:text-gray-400">Campos com * são obrigatórios</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Tombo"    k="tombo"    required placeholder="Ex: 00123456" />
            <Field label="Hostname" k="hostname" required placeholder="Ex: PC-RH-01" />
          </div>
          <Field label="Processador (CPU)" k="cpu" required placeholder="Ex: Intel Core i5-10400" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Memória RAM" k="ram"     required placeholder="Ex: 8 GB DDR4" />
            <Field label="HD / SSD"    k="storage" required placeholder="Ex: SSD 240 GB" />
          </div>
          <Field label="Sistema Operacional" k="operatingSystem" required placeholder="Ex: Windows 10 Pro" />

          <div className="border-t border-slate-100 dark:border-gray-700 pt-3">
            <p className="text-xs font-medium text-slate-500 dark:text-gray-400 mb-2">Localização atual (opcional)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Setor"       k="setor"       placeholder="Ex: Recursos Humanos" />
              <Field label="Responsável" k="responsavel" placeholder="Ex: João Silva" />
            </div>
          </div>

          <div>
            <label className="field-label">Observações</label>
            <textarea
              rows={2} value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              className="field-input text-sm resize-none"
              placeholder="Informações adicionais..."
            />
          </div>

          {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="btn-secondary text-sm py-2 px-4">Cancelar</button>
            <button
              type="submit" disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-semibold transition disabled:opacity-60"
            >
              {saving ? <Spinner className="h-4 w-4" /> : <Check size={14} />}
              Cadastrar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function AssetsPage() {
  const nav = useNavigate();

  const [assets, setAssets]     = useState([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [statusFilter, setStatus] = useState("");
  const [showCreate, setCreate] = useState(false);
  const [err, setErr]           = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      const res = await api.get("/assets", { params });
      setAssets(res.data.assets);
      setTotal(res.data.total);
    } catch { setErr("Erro ao carregar ativos"); }
    finally { setLoading(false); }
  }, [statusFilter, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  function handleCreated(asset) {
    setCreate(false);
    nav(`/painel/ativos/${asset.id}`);
  }

  const tabCounts = STATUS_TABS.reduce((acc, tab) => {
    acc[tab.key] = tab.key ? assets.filter((a) => a.status === tab.key).length : assets.length;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <AppHeader />

      <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-5">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor size={20} className="text-brand-600" />
            <h1 className="text-lg font-semibold text-slate-900 dark:text-gray-100">Ativos</h1>
            {!loading && <span className="text-sm text-slate-400 dark:text-gray-500">({total})</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition"
            >
              <RefreshCw size={13} /> Atualizar
            </button>
            <button
              onClick={() => setCreate(true)}
              className="flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-3.5 py-2 text-sm font-semibold transition"
            >
              <Plus size={15} /> Novo Ativo
            </button>
          </div>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por tombo, hostname, setor ou responsável..."
            className="field-input pl-9 py-2 text-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Tabs de status */}
        <div className="flex items-center gap-1 border-b border-slate-200 dark:border-gray-700 pb-0">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatus(tab.key)}
              className={`relative pb-2 px-2 text-sm font-medium transition ${
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
        </div>

        {err && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            <AlertTriangle size={15} /> {err}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Spinner className="h-8 w-8" />
          </div>
        )}

        {!loading && assets.length === 0 && (
          <div className="card p-14 text-center">
            <Monitor size={44} className="mx-auto text-slate-300 dark:text-gray-700 mb-4" />
            <div className="font-semibold text-slate-700 dark:text-gray-300">
              {search || statusFilter ? "Nenhum ativo encontrado com os filtros ativos" : "Nenhum ativo cadastrado"}
            </div>
            {!search && !statusFilter && (
              <button
                onClick={() => setCreate(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-semibold transition"
              >
                <Plus size={14} /> Cadastrar primeiro ativo
              </button>
            )}
          </div>
        )}

        {!loading && assets.length > 0 && (
          <div className="card divide-y divide-slate-100 dark:divide-gray-700/60">
            {assets.map((asset) => (
              <Link
                key={asset.id}
                to={`/painel/ativos/${asset.id}`}
                className="group flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-gray-800/60 transition"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-gray-800 text-slate-400 dark:text-gray-500 group-hover:bg-brand-50 dark:group-hover:bg-brand-900/30 group-hover:text-brand-500 transition">
                  <Monitor size={17} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-semibold text-slate-500 dark:text-gray-400">{asset.tombo}</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[asset.status]}`}>
                      {STATUS_LABEL[asset.status]}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-slate-800 dark:text-gray-100 truncate">{asset.hostname}</div>
                  <div className="text-xs text-slate-400 dark:text-gray-500 truncate">
                    {asset.cpu} · {asset.ram} · {asset.storage}
                  </div>
                </div>

                <div className="text-right shrink-0 space-y-0.5">
                  {asset.setor && (
                    <div className="text-xs text-slate-500 dark:text-gray-400 flex items-center gap-1 justify-end">
                      <MapPin size={10} /> {asset.setor}
                    </div>
                  )}
                  {asset.responsavel && (
                    <div className="text-xs text-slate-400 dark:text-gray-500 flex items-center gap-1 justify-end">
                      <User size={10} /> {asset.responsavel}
                    </div>
                  )}
                </div>

                <ChevronRight size={16} className="text-slate-300 dark:text-gray-600 group-hover:text-brand-500 transition shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </main>

      {showCreate && (
        <CreateAssetModal onClose={() => setCreate(false)} onCreate={handleCreated} />
      )}
    </div>
  );
}
