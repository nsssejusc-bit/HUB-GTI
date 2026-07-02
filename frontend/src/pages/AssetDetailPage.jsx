import { useEffect, useState, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Spinner } from "../components/ui";
import AppHeader from "../components/AppHeader";
import { OS_STATUS_LABEL, OS_STATUS_STYLE } from "../lib/osConstants";
import {
  ArrowLeft, ChevronRight, Monitor, Edit2, Check, X, Trash2,
  AlertTriangle, MapPin, User, Clock, Plus, History,
  ClipboardList, ExternalLink, Image as ImageIcon,
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
const STATUS_OPTIONS = ["ATIVO", "INATIVO", "MANUTENCAO", "RECOLHIDO"];

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function InfoRow({ label, value }) {
  return (
    <div>
      <div className="text-xs text-slate-400 dark:text-gray-500 mb-0.5">{label}</div>
      <div className="text-sm text-slate-800 dark:text-gray-100">{value || "—"}</div>
    </div>
  );
}

// ── Modal de movimentação (nova alocação) ─────────────────────────────────────
function AllocateModal({ asset, onClose, onSaved }) {
  const [form, setForm] = useState({
    setor:       asset.setor       || "",
    responsavel: asset.responsavel || "",
    status:      asset.status,
    notes:       "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  function set(k, v) { setForm((p) => ({ ...p, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setErr("");
    try {
      const res = await api.post(`/assets/${asset.id}/allocate`, {
        setor:       form.setor       || null,
        responsavel: form.responsavel || null,
        status:      form.status,
        notes:       form.notes       || null,
      });
      onSaved(res.data);
    } catch (ex) {
      setErr(ex.response?.data?.error || "Erro ao registrar movimentação");
    } finally { setSaving(false); }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-900/40 text-brand-600">
            <History size={20} />
          </span>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-gray-100">Registrar Movimentação</h3>
            <p className="text-xs text-slate-500 dark:text-gray-400 font-mono">{[asset.tombo, asset.hostname].filter(Boolean).join(" · ")}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="field-label">Status</label>
            <select value={form.status} onChange={(e) => set("status", e.target.value)} className="field-input text-sm">
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Setor de destino</label>
            <input type="text" value={form.setor} onChange={(e) => set("setor", e.target.value)}
              placeholder="Ex: Recursos Humanos" className="field-input text-sm" />
          </div>
          <div>
            <label className="field-label">Responsável</label>
            <input type="text" value={form.responsavel} onChange={(e) => set("responsavel", e.target.value)}
              placeholder="Ex: Maria Souza" className="field-input text-sm" />
          </div>
          <div>
            <label className="field-label">Observação</label>
            <textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)}
              placeholder="Motivo da movimentação, condições do equipamento..."
              className="field-input text-sm resize-none" />
          </div>

          {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="btn-secondary text-sm py-2 px-4">Cancelar</button>
            <button
              type="submit" disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-semibold transition disabled:opacity-60"
            >
              {saving ? <Spinner className="h-4 w-4" /> : <Check size={14} />}
              Registrar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal de exclusão ─────────────────────────────────────────────────────────
function DeleteModal({ asset, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  async function confirm() {
    setDeleting(true);
    try { await api.delete(`/assets/${asset.id}`); onDeleted(); }
    catch { setDeleting(false); }
  }
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600"><Trash2 size={20} /></span>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-gray-100">Excluir Ativo</h3>
            <p className="text-xs text-slate-500 dark:text-gray-400">Esta ação não pode ser desfeita.</p>
          </div>
        </div>
        <p className="text-sm text-slate-700 dark:text-gray-300">
          Excluir <span className="font-mono font-medium">{asset.tombo ?? asset.hostname}</span>? Todo o histórico será removido.
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary text-sm py-2 px-4">Cancelar</button>
          <button
            onClick={confirm} disabled={deleting}
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

// ── Campo de imagem para formulários dinâmicos de tipo de OS ──────────────────
function OsImageField({ label, required, value, onChange }) {
  const [imgErr, setImgErr] = useState("");

  function handleImageFile(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setImgErr("Imagem muito grande. Máximo 2 MB.");
      return;
    }
    setImgErr("");
    const reader = new FileReader();
    reader.onload = (ev) => onChange(ev.target.result);
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <label className="field-label">{label}{required && " *"}</label>
      {value ? (
        <div className="relative inline-block">
          <img src={value} alt={label} className="max-h-40 rounded-lg border border-slate-200 dark:border-gray-700 object-contain" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 hover:bg-red-700 text-white transition"
            title="Remover imagem"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 dark:border-gray-700 py-4 cursor-pointer hover:border-brand-400 dark:hover:border-brand-600 transition text-slate-400 dark:text-gray-500">
          <ImageIcon size={18} />
          <span className="text-xs">Selecionar imagem</span>
          <input type="file" accept="image/*" className="sr-only" onChange={handleImageFile} />
        </label>
      )}
      {imgErr && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{imgErr}</p>}
    </div>
  );
}

// ── Modal criar OS para este ativo ────────────────────────────────────────────
function CreateOsModal({ asset, types, onClose, onCreate }) {
  const [tipoId,   setTipoId]   = useState(types[0]?.id ?? "");
  const [formData, setFormData] = useState({});
  const [unitId,   setUnitId]   = useState("");
  const [units,    setUnits]    = useState([]);
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState("");

  useEffect(() => {
    api.get("/units").then((r) => setUnits(r.data)).catch(() => {});
  }, []);

  const selectedType = types.find((t) => t.id === Number(tipoId));
  const fields = selectedType?.fields ?? [];

  function setField(k, v) { setFormData((p) => ({ ...p, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setErr("");
    try {
      const res = await api.post("/work-orders", {
        tipoId:  Number(tipoId),
        formData,
        unitId:  unitId ? Number(unitId) : null,
        assetId: asset.id,
      });
      onCreate(res.data);
    } catch (ex) {
      setErr(ex.response?.data?.error || "Erro ao criar OS");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-900/40 text-brand-600">
            <ClipboardList size={20} />
          </span>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-gray-100">Nova OS para este ativo</h3>
            <p className="text-xs text-slate-500 dark:text-gray-400 font-mono">{[asset.tombo, asset.hostname].filter(Boolean).join(" · ")}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="field-label">Tipo *</label>
              <select value={tipoId} onChange={(e) => { setTipoId(e.target.value); setFormData({}); }}
                className="field-input" required>
                {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
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

          {fields.map((field) => {
            const cls = "field-input text-sm";
            const val = formData[field.key] ?? "";
            if (field.type === "textarea") return (
              <div key={field.key}>
                <label className="field-label">{field.label}{field.required && " *"}</label>
                <textarea rows={3} value={val} onChange={(e) => setField(field.key, e.target.value)}
                  required={field.required} className={`${cls} resize-none`} />
              </div>
            );
            if (field.type === "select") return (
              <div key={field.key}>
                <label className="field-label">{field.label}{field.required && " *"}</label>
                <select value={val} onChange={(e) => setField(field.key, e.target.value)} required={field.required} className={cls}>
                  <option value="">Selecione...</option>
                  {(field.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            );
            if (field.type === "multiselect") {
              if (!field.options || field.options.length === 0) return (
                <div key={field.key}>
                  <label className="field-label">{field.label}{field.required && " *"}</label>
                  <p className="text-xs text-slate-400 dark:text-gray-500 italic">Nenhuma opção configurada para este campo.</p>
                </div>
              );
              const arr = Array.isArray(val) ? val : [];
              return (
                <div key={field.key}>
                  <label className="field-label">{field.label}{field.required && " *"}</label>
                  <div className="flex flex-col gap-1.5">
                    {field.options.map((opt) => {
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
                            onChange={() => setField(field.key, checked ? arr.filter((o) => o !== opt) : [...arr, opt])}
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
            if (field.type === "image") return (
              <OsImageField
                key={field.key}
                label={field.label}
                required={field.required}
                value={val}
                onChange={(v) => setField(field.key, v)}
              />
            );
            if (field.type === "checkbox") return (
              <div key={field.key} className="flex items-center gap-2 pt-1">
                <input type="checkbox" checked={!!val} onChange={(e) => setField(field.key, e.target.checked)} className="h-4 w-4 rounded" />
                <label className="text-sm text-slate-700 dark:text-gray-300">{field.label}</label>
              </div>
            );
            const inputType = field.type === "datetime" ? "datetime-local" : field.type === "date" ? "date" : field.type === "number" ? "number" : "text";
            return (
              <div key={field.key}>
                <label className="field-label">{field.label}{field.required && " *"}</label>
                <input type={inputType} value={val} onChange={(e) => setField(field.key, e.target.value)}
                  required={field.required} className={cls} />
              </div>
            );
          })}

          {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="btn-secondary text-sm py-2 px-4">Cancelar</button>
            <button type="submit" disabled={saving || !tipoId}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-semibold transition disabled:opacity-60">
              {saving ? <Spinner className="h-4 w-4" /> : <Plus size={14} />}
              Criar OS
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, required, placeholder }) {
  return (
    <div>
      <label className="field-label">{label}{required && " *"}</label>
      <input
        type="text" value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        required={required} placeholder={placeholder}
        className="field-input text-sm"
      />
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function AssetDetailPage() {
  const { id }    = useParams();
  const nav       = useNavigate();
  const { user }  = useAuth();

  const [asset, setAsset]       = useState(null);
  const [loadErr, setLoadErr]   = useState(false);
  const [editing, setEditing]   = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState("");
  const [showAlloc,    setAlloc]    = useState(false);
  const [showDelete,   setDelete]   = useState(false);
  const [showCreateOs, setCreateOs] = useState(false);
  const [types,        setTypes]    = useState([]);

  const isAdmin = user?.role === "ADMIN";

  const load = useCallback(async () => {
    setLoadErr(false);
    try {
      const [assetRes, typesRes] = await Promise.all([
        api.get(`/assets/${id}`),
        api.get("/work-order-types"),
      ]);
      setAsset(assetRes.data);
      setTypes(typesRes.data);
    } catch { setLoadErr(true); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function startEdit() {
    setEditForm({
      tombo:           asset.tombo,
      hostname:        asset.hostname,
      cpu:             asset.cpu,
      ram:             asset.ram,
      storage:         asset.storage,
      operatingSystem: asset.operatingSystem,
      status:          asset.status,
      setor:           asset.setor           || "",
      responsavel:     asset.responsavel     || "",
      notes:           asset.notes           || "",
    });
    setEditing(true);
    setErr("");
  }

  function setEF(k, v) { setEditForm((p) => ({ ...p, [k]: v })); }

  async function saveEdit() {
    setSaving(true); setErr("");
    try {
      const res = await api.patch(`/assets/${id}`, {
        ...editForm,
        tombo:       editForm.tombo       || null,
        setor:       editForm.setor       || null,
        responsavel: editForm.responsavel || null,
        notes:       editForm.notes       || null,
      });
      setAsset(res.data);
      setEditing(false);
    } catch (ex) {
      setErr(ex.response?.data?.error || "Erro ao salvar");
    } finally { setSaving(false); }
  }

  if (loadErr) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-gray-950">
      <AlertTriangle size={32} className="text-red-400" />
      <p className="text-slate-600 dark:text-gray-400">Não foi possível carregar o ativo.</p>
      <button onClick={load} className="btn-secondary text-sm px-4 py-2">Tentar novamente</button>
    </div>
  );

  if (!asset) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-950">
      <Spinner className="h-8 w-8" />
    </div>
  );

  const currentAlloc = asset.allocations.find((a) => !a.endedAt);
  const historyAllocs = asset.allocations.filter((a) => a.endedAt);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <AppHeader />

      {/* Sub-header */}
      <div className="bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-4 h-12 flex items-center gap-3 text-sm">
          <Link to="/painel/ativos" className="flex items-center gap-1.5 text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200 transition">
            <ArrowLeft size={14} /> Ativos
          </Link>
          <ChevronRight size={14} className="text-slate-300 dark:text-gray-600" />
          <span className="font-mono text-slate-600 dark:text-gray-300">{asset.tombo ?? "—"}</span>
          <ChevronRight size={14} className="text-slate-300 dark:text-gray-600" />
          <span className="text-slate-700 dark:text-gray-200 truncate">{asset.hostname}</span>
          <div className="ml-auto">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[asset.status]}`}>
              {STATUS_LABEL[asset.status]}
            </span>
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

        {/* Barra de ações */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setAlloc(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-semibold transition"
          >
            <Plus size={14} /> Registrar Movimentação
          </button>
          {types.length > 0 && (
            <button
              onClick={() => setCreateOs(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand-300 dark:border-brand-700 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/50 px-4 py-2 text-sm font-semibold transition"
            >
              <ClipboardList size={14} /> Nova OS
            </button>
          )}
          {!editing && (
            <button
              onClick={startEdit}
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand-300 dark:border-brand-700 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/50 px-4 py-2 text-sm font-semibold transition"
            >
              <Edit2 size={14} /> Editar
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setDelete(true)}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 px-4 py-2 text-sm font-semibold transition"
            >
              <Trash2 size={14} /> Excluir
            </button>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-5">

          {/* Coluna principal */}
          <div className="md:col-span-2 space-y-4">

            {/* Especificações */}
            <div className="card p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-2">
                <Monitor size={14} className="text-brand-600" /> Especificações
              </h2>

              {editing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InputField label="Tombo" value={editForm.tombo} onChange={(v) => setEF("tombo", v)} />
                    <InputField label="Hostname" value={editForm.hostname}  onChange={(v) => setEF("hostname", v)}  required />
                  </div>
                  <InputField label="Processador (CPU)" value={editForm.cpu} onChange={(v) => setEF("cpu", v)} required />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InputField label="Memória RAM" value={editForm.ram}     onChange={(v) => setEF("ram", v)}     required />
                    <InputField label="HD / SSD"    value={editForm.storage} onChange={(v) => setEF("storage", v)} required />
                  </div>
                  <InputField label="Sistema Operacional" value={editForm.operatingSystem} onChange={(v) => setEF("operatingSystem", v)} required />

                  <div className="border-t border-slate-100 dark:border-gray-700 pt-3">
                    <p className="text-xs font-medium text-slate-500 dark:text-gray-400 mb-2">Status e localização</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="field-label">Status</label>
                        <select value={editForm.status} onChange={(e) => setEF("status", e.target.value)} className="field-input text-sm">
                          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                        </select>
                      </div>
                      <InputField label="Setor"       value={editForm.setor}       onChange={(v) => setEF("setor", v)} />
                      <InputField label="Responsável" value={editForm.responsavel} onChange={(v) => setEF("responsavel", v)} />
                    </div>
                  </div>

                  <div>
                    <label className="field-label">Observações</label>
                    <textarea rows={2} value={editForm.notes} onChange={(e) => setEF("notes", e.target.value)}
                      className="field-input text-sm resize-none" />
                  </div>

                  {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}

                  <div className="flex gap-2 justify-end pt-1">
                    <button onClick={() => { setEditing(false); setErr(""); }} className="btn-secondary text-sm py-2 px-4">Cancelar</button>
                    <button
                      onClick={saveEdit} disabled={saving}
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
                    <InfoRow label="Tombo"    value={asset.tombo} />
                    <InfoRow label="Hostname" value={asset.hostname} />
                  </div>
                  <InfoRow label="Processador (CPU)"    value={asset.cpu} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoRow label="Memória RAM" value={asset.ram} />
                    <InfoRow label="HD / SSD"    value={asset.storage} />
                  </div>
                  <InfoRow label="Sistema Operacional" value={asset.operatingSystem} />
                  {asset.notes && <InfoRow label="Observações" value={asset.notes} />}
                </div>
              )}
            </div>

            {/* Localização atual */}
            <div className="card p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-2">
                <MapPin size={14} className="text-brand-600" /> Localização atual
              </h2>
              {asset.setor || asset.responsavel ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <MapPin size={13} className="text-slate-400 shrink-0" />
                    <div>
                      <div className="text-xs text-slate-400 dark:text-gray-500">Setor</div>
                      <div className="text-sm text-slate-800 dark:text-gray-100">{asset.setor || "—"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <User size={13} className="text-slate-400 shrink-0" />
                    <div>
                      <div className="text-xs text-slate-400 dark:text-gray-500">Responsável</div>
                      <div className="text-sm text-slate-800 dark:text-gray-100">{asset.responsavel || "—"}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400 dark:text-gray-500">Localização não definida.</p>
              )}
              {currentAlloc?.notes && (
                <div className="text-xs text-slate-500 dark:text-gray-400 bg-slate-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                  {currentAlloc.notes}
                </div>
              )}
            </div>

            {/* Ordens de Serviço vinculadas */}
            {asset.workOrders?.length > 0 && (
              <div className="card p-5 space-y-3">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-2">
                  <ClipboardList size={14} className="text-brand-600" />
                  Ordens de Serviço
                  <span className="text-xs font-normal text-slate-400">({asset.workOrders.length})</span>
                </h2>
                <div className="divide-y divide-slate-100 dark:divide-gray-700/60 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
                  {asset.workOrders.map((os) => (
                    <Link
                      key={os.id}
                      to={`/painel/os/${os.id}`}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-gray-800/60 transition"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-slate-400">{os.osNumber}</span>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${OS_STATUS_STYLE[os.status] ?? ""}`}>
                            {OS_STATUS_LABEL[os.status] ?? os.status}
                          </span>
                          {os.tipo && (
                            <span className="text-[11px] rounded px-1.5 py-0.5 font-medium"
                              style={{ backgroundColor: os.tipo.color + "22", color: os.tipo.color }}>
                              {os.tipo.name}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
                          {new Date(os.createdAt).toLocaleDateString("pt-BR")}
                        </div>
                      </div>
                      <ExternalLink size={13} className="text-slate-300 dark:text-gray-600 shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Histórico de movimentações */}
            <div className="card p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-2">
                <History size={14} className="text-brand-600" />
                Histórico de movimentações
                {historyAllocs.length > 0 && (
                  <span className="text-xs font-normal text-slate-400">({historyAllocs.length})</span>
                )}
              </h2>

              {historyAllocs.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-gray-500">Nenhuma movimentação anterior registrada.</p>
              ) : (
                <div className="space-y-1">
                  {historyAllocs.map((alloc) => (
                    <div key={alloc.id} className="flex items-start gap-3 py-2.5 border-b border-slate-50 dark:border-gray-800 last:border-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-gray-600 mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {alloc.setor && (
                            <span className="text-xs text-slate-700 dark:text-gray-300 flex items-center gap-1">
                              <MapPin size={10} className="text-slate-400" /> {alloc.setor}
                            </span>
                          )}
                          {alloc.responsavel && (
                            <span className="text-xs text-slate-500 dark:text-gray-400 flex items-center gap-1">
                              <User size={10} /> {alloc.responsavel}
                            </span>
                          )}
                        </div>
                        {alloc.notes && (
                          <div className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">{alloc.notes}</div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[11px] text-slate-400 dark:text-gray-500">
                          {fmtDate(alloc.startedAt).slice(0, 10).split("/").join("/")}
                        </div>
                        {alloc.endedAt && (
                          <div className="text-[11px] text-slate-300 dark:text-gray-600">
                            até {new Date(alloc.endedAt).toLocaleDateString("pt-BR")}
                          </div>
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

            {/* Info rápida */}
            <div className="card p-4 space-y-2">
              <h2 className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">Informações</h2>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 dark:text-gray-500">Cadastrado</span>
                <span className="text-slate-700 dark:text-gray-300 font-medium">
                  {new Date(asset.createdAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 dark:text-gray-500">Atualizado</span>
                <span className="text-slate-700 dark:text-gray-300 font-medium">
                  {new Date(asset.updatedAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
              {asset.createdBy && (
                <div className="flex justify-between text-xs pt-1 border-t border-slate-100 dark:border-gray-700/60 mt-1">
                  <span className="text-slate-400 dark:text-gray-500">Cadastrado por</span>
                  <span className="text-slate-700 dark:text-gray-300">{asset.createdBy.name.split(" ")[0]}</span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 dark:text-gray-500">Movimentações</span>
                <span className="text-slate-700 dark:text-gray-300 font-medium">{asset.allocationCount}</span>
              </div>
            </div>

            {/* Alocação atual */}
            {currentAlloc && (
              <div className="card p-4 space-y-2">
                <h2 className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Clock size={11} /> Alocação desde
                </h2>
                <div className="text-sm text-slate-700 dark:text-gray-300 font-medium">
                  {new Date(currentAlloc.startedAt).toLocaleDateString("pt-BR")}
                </div>
                {currentAlloc.createdBy && (
                  <div className="text-xs text-slate-400 dark:text-gray-500">
                    por {currentAlloc.createdBy.name.split(" ")[0]}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {showAlloc && (
        <AllocateModal
          asset={asset}
          onClose={() => setAlloc(false)}
          onSaved={(updated) => { setAsset(updated); setAlloc(false); }}
        />
      )}

      {showDelete && (
        <DeleteModal
          asset={asset}
          onClose={() => setDelete(false)}
          onDeleted={() => nav("/painel/ativos")}
        />
      )}

      {showCreateOs && types.length > 0 && (
        <CreateOsModal
          asset={asset}
          types={types}
          onClose={() => setCreateOs(false)}
          onCreate={(os) => nav(`/painel/os/${os.id}`)}
        />
      )}
    </div>
  );
}
