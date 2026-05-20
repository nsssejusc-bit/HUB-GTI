import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Spinner } from "../components/ui";
import AppHeader from "../components/AppHeader";
import {
  Package, ArrowLeft, Edit2, Save, X, Plus, Tag,
  AlertTriangle, User, Trash2, CheckCircle, XCircle,
  Hash, Clock, Wifi,
} from "lucide-react";

const UNIT_OPTIONS = ["un", "cx", "par", "rolo", "m", "kg", "L", "pç"];

const UNIT_STATUS_STYLE = {
  DISPONIVEL: { cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", label: "Disponível" },
  EM_USO:     { cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",         label: "Em uso"     },
  INATIVO:    { cls: "bg-slate-100 text-slate-500 dark:bg-gray-800 dark:text-gray-400",              label: "Inativo"    },
};

const inputCls = "w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500";
const labelCls = "block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1";

function fmtDate(d) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ── Add Unit Modal ─────────────────────────────────────────────────────────────
function AddUnitModal({ itemId, onClose, onAdded }) {
  const [tombo, setTombo]   = useState("");
  const [note,  setNote]    = useState("");
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    setSaving(true);
    try {
      const res = await api.post(`/inventory/${itemId}/units`, {
        tombo: tombo.trim() || null,
        note:  note.trim()  || null,
      });
      onAdded(res.data);
    } catch (e) {
      setErr(e.response?.data?.error || "Erro ao adicionar unidade.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-gray-700/60">
          <h2 className="text-base font-semibold text-slate-800 dark:text-gray-100 flex items-center gap-2">
            <Hash size={15} className="text-brand-600" />
            Adicionar unidade / tombo
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelCls}>Tombo / SN <span className="text-slate-400">(opcional)</span></label>
            <input
              className={inputCls}
              value={tombo}
              onChange={(e) => setTombo(e.target.value)}
              placeholder="Ex: 3071, SN-ABC123..."
              autoFocus
            />
          </div>
          <div>
            <label className={labelCls}>Observação <span className="text-slate-400">(opcional)</span></label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Informações adicionais..."
            />
          </div>
          {err && (
            <p className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
              <AlertTriangle size={14} /> {err}
            </p>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-200 dark:border-gray-700 py-2 text-sm text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800 transition">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-60 py-2 text-sm font-medium text-white transition flex items-center justify-center gap-1.5">
              {saving ? <Spinner size="sm" /> : <Plus size={14} />}
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit Item Modal ────────────────────────────────────────────────────────────
function EditModal({ item, onClose, onSaved, categories }) {
  const [form, setForm] = useState({
    name:        item.name,
    description: item.description || "",
    unitMeasure: item.unitMeasure,
    category:    item.category || "",
    nucleo:      item.nucleo || "",
    status:      item.status,
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    if (!form.name.trim()) return setErr("Informe o nome do item.");
    setSaving(true);
    try {
      const payload = {
        name:        form.name.trim(),
        description: form.description.trim() || null,
        unitMeasure: form.unitMeasure,
        category:    form.category.trim() || null,
        nucleo:      form.nucleo || null,
        status:      form.status,
      };
      const res = await api.patch(`/inventory/${item.id}`, payload);
      onSaved(res.data);
    } catch (e) {
      setErr(e.response?.data?.error || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-gray-700/60">
          <h2 className="text-base font-semibold text-slate-800 dark:text-gray-100 flex items-center gap-2">
            <Edit2 size={15} className="text-brand-600" />
            Editar item
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelCls}>Nome *</label>
            <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Categoria</label>
              <input
                className={inputCls}
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                list="edit-cat-suggestions"
                placeholder="Opcional"
              />
              <datalist id="edit-cat-suggestions">
                {categories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className={labelCls}>Unidade de medida</label>
              <select className={inputCls} value={form.unitMeasure} onChange={(e) => set("unitMeasure", e.target.value)}>
                {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Núcleo</label>
              <select className={inputCls} value={form.nucleo} onChange={(e) => set("nucleo", e.target.value)}>
                <option value="">Sem núcleo</option>
                <option value="NMT">NMT</option>
                <option value="NIR">NIR</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={inputCls} value={form.status} onChange={(e) => set("status", e.target.value)}>
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Inativo</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Descrição</label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Informações adicionais..."
            />
          </div>

          {err && (
            <p className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
              <AlertTriangle size={14} /> {err}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-200 dark:border-gray-700 py-2 text-sm text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800 transition">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-60 py-2 text-sm font-medium text-white transition flex items-center justify-center gap-1.5">
              {saving ? <Spinner size="sm" /> : <Save size={14} />}
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Unit Row (inline edit) ─────────────────────────────────────────────────────
function UnitRow({ unit, onUpdated, onDeleted }) {
  const [editing,  setEditing]  = useState(false);
  const [tomboDft, setTomboDft] = useState(unit.tombo || "");
  const [statusDft,setStatusDft]= useState(unit.status);
  const [noteDft,  setNoteDft]  = useState(unit.note || "");
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await api.patch(`/inventory/units/${unit.id}`, {
        tombo:  tomboDft.trim() || null,
        status: statusDft,
        note:   noteDft.trim() || null,
      });
      onUpdated(res.data);
      setEditing(false);
    } catch (e) {
      alert(e.response?.data?.error || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!window.confirm("Remover esta unidade?")) return;
    setDeleting(true);
    try {
      await api.delete(`/inventory/units/${unit.id}`);
      onDeleted(unit.id);
    } catch (e) {
      alert(e.response?.data?.error || "Erro ao excluir.");
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <tr className="bg-brand-50 dark:bg-brand-900/10">
        <td className="px-3 py-2">
          <input
            className="w-full rounded border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
            value={tomboDft}
            onChange={(e) => setTomboDft(e.target.value)}
            placeholder="Tombo / SN"
            autoFocus
          />
        </td>
        <td className="px-3 py-2">
          <select
            className="rounded border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm focus:outline-none"
            value={statusDft}
            onChange={(e) => setStatusDft(e.target.value)}
          >
            <option value="DISPONIVEL">Disponível</option>
            <option value="EM_USO">Em uso</option>
            <option value="INATIVO">Inativo</option>
          </select>
        </td>
        <td className="px-3 py-2 hidden md:table-cell">
          <input
            className="w-full rounded border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm focus:outline-none"
            value={noteDft}
            onChange={(e) => setNoteDft(e.target.value)}
            placeholder="Observação"
          />
        </td>
        <td className="px-3 py-2 hidden sm:table-cell text-xs text-slate-400" />
        <td className="px-3 py-2">
          <div className="flex items-center gap-1">
            <button onClick={save} disabled={saving} className="flex h-7 w-7 items-center justify-center rounded bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white transition">
              {saving ? <Spinner size="sm" /> : <Save size={13} />}
            </button>
            <button onClick={() => setEditing(false)} className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 dark:border-gray-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-gray-800 transition">
              <X size={13} />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  const { cls, label } = UNIT_STATUS_STYLE[unit.status];

  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-gray-800/50 transition group">
      <td className="px-3 py-2.5">
        {unit.tombo
          ? <span className="font-mono text-sm bg-slate-100 dark:bg-gray-800 text-slate-700 dark:text-gray-300 px-2 py-0.5 rounded">{unit.tombo}</span>
          : <span className="text-xs text-slate-400 dark:text-gray-500 italic">Sem tombo</span>
        }
      </td>
      <td className="px-3 py-2.5">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
          {label}
        </span>
      </td>
      <td className="px-3 py-2.5 hidden md:table-cell text-xs text-slate-500 dark:text-gray-400">
        {unit.note || <span className="italic text-slate-300 dark:text-gray-600">—</span>}
      </td>
      <td className="px-3 py-2.5 hidden sm:table-cell text-xs text-slate-400 dark:text-gray-500">
        <div className="flex items-center gap-1">
          <User size={10} />
          {unit.createdBy?.name}
          <span className="ml-1 text-slate-300 dark:text-gray-600">{fmtDate(unit.createdAt)}</span>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button onClick={() => setEditing(true)} className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 dark:border-gray-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-gray-800 transition">
            <Edit2 size={12} />
          </button>
          <button onClick={del} disabled={deleting} className="flex h-7 w-7 items-center justify-center rounded border border-red-200 dark:border-red-900/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50">
            {deleting ? <Spinner size="sm" /> : <Trash2 size={12} />}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function InventoryItemDetailPage() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const { user }     = useAuth();
  const { addToast } = useToast();

  const [item,       setItem]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [categories, setCategories] = useState([]);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [showEdit,    setShowEdit]    = useState(false);
  const [deleting,    setDeleting]    = useState(false);

  const isAdmin = user?.role === "ADMIN";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/inventory/${id}`);
      setItem(res.data);
    } catch {
      addToast("Item não encontrado.", "error");
      navigate("/painel/inventario");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get("/inventory/categories").then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  function handleUnitAdded(unit) {
    setShowAddUnit(false);
    addToast("Unidade adicionada!", "success");
    setItem((prev) => ({ ...prev, units: [...(prev.units || []), unit] }));
  }

  function handleUnitUpdated(updated) {
    setItem((prev) => ({
      ...prev,
      units: prev.units.map((u) => u.id === updated.id ? updated : u),
    }));
  }

  function handleUnitDeleted(unitId) {
    addToast("Unidade removida.", "success");
    setItem((prev) => ({
      ...prev,
      units: prev.units.filter((u) => u.id !== unitId),
    }));
  }

  function handleSaved(updated) {
    setShowEdit(false);
    addToast("Item atualizado!", "success");
    setItem((prev) => ({ ...prev, ...updated }));
  }

  async function handleDelete() {
    if (!window.confirm(`Excluir "${item.name}" permanentemente?`)) return;
    setDeleting(true);
    try {
      await api.delete(`/inventory/${item.id}`);
      addToast("Item excluído.", "success");
      navigate("/painel/inventario");
    } catch (e) {
      addToast(e.response?.data?.error || "Erro ao excluir.", "error");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
        <AppHeader />
        <div className="flex items-center justify-center py-24"><Spinner /></div>
      </div>
    );
  }

  if (!item) return null;

  const units     = item.units || [];
  const disponivel = units.filter((u) => u.status === "DISPONIVEL").length;
  const emUso      = units.filter((u) => u.status === "EM_USO").length;
  const inativo    = units.filter((u) => u.status === "INATIVO").length;

  const StatusIcon  = item.status === "ATIVO" ? CheckCircle : XCircle;
  const statusColor = item.status === "ATIVO"
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-slate-400 dark:text-gray-500";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <AppHeader />

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* Breadcrumb + actions */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Link to="/painel/inventario" className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition">
            <ArrowLeft size={14} />
            Inventário
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowAddUnit(true)}
              className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition"
            >
              <Plus size={14} />
              Adicionar tombo
            </button>
            <button
              onClick={() => setShowEdit(true)}
              className="flex items-center gap-1.5 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800 text-sm px-3 py-1.5 rounded-lg transition"
            >
              <Edit2 size={14} />
              Editar
            </button>
            {isAdmin && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm px-3 py-1.5 rounded-lg transition disabled:opacity-50"
              >
                {deleting ? <Spinner size="sm" /> : <Trash2 size={14} />}
                Excluir
              </button>
            )}
          </div>
        </div>

        {/* Item info card */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-900/20 shrink-0">
              <Package size={22} className="text-brand-600 dark:text-brand-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-800 dark:text-gray-100">{item.name}</h1>
                <span className={`flex items-center gap-1 text-xs font-medium ${statusColor}`}>
                  <StatusIcon size={13} />
                  {item.status === "ATIVO" ? "Ativo" : "Inativo"}
                </span>
              </div>
              {item.description && (
                <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">{item.description}</p>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Disponível count */}
            <div>
              <div className="text-xs text-slate-500 dark:text-gray-400 mb-0.5">Disponível</div>
              <div className={`text-2xl font-bold ${disponivel === 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                {disponivel}
                <span className="text-sm font-normal text-slate-400 ml-1">{item.unitMeasure}</span>
              </div>
              {disponivel === 0 && emUso === 0 && (
                <div className="flex items-center gap-1 mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle size={11} /> Sem unidades
                </div>
              )}
            </div>

            {/* Em uso */}
            <div>
              <div className="text-xs text-slate-500 dark:text-gray-400 mb-0.5">Em uso</div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {emUso}
                {emUso > 0 && (
                  <span className="ml-2 inline-flex items-center gap-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                    <Wifi size={10} className="animate-pulse" />
                    checklist
                  </span>
                )}
              </div>
            </div>

            {/* Categoria */}
            <div>
              <div className="text-xs text-slate-500 dark:text-gray-400 mb-0.5">Categoria</div>
              <div className="text-sm mt-1">
                {item.category
                  ? <span className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full text-xs"><Tag size={10} />{item.category}</span>
                  : <span className="text-slate-400 dark:text-gray-500 italic text-xs">Sem categoria</span>
                }
              </div>
            </div>

            {/* Cadastrado por */}
            <div>
              <div className="text-xs text-slate-500 dark:text-gray-400 mb-0.5">Cadastrado por</div>
              <div className="text-sm text-slate-700 dark:text-gray-300 flex items-center gap-1">
                <User size={12} className="text-slate-400" />
                {item.createdBy?.name || "—"}
              </div>
              <div className="text-xs text-slate-400 dark:text-gray-500">
                {new Date(item.createdAt).toLocaleDateString("pt-BR")}
              </div>
            </div>
          </div>
        </div>

        {/* Units table */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-gray-700/60">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-200 flex items-center gap-2">
              <Hash size={15} className="text-slate-400" />
              Tombos / Unidades
            </h2>
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-gray-400">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">{disponivel} disponível</span>
              {emUso > 0 && <span className="text-amber-600 dark:text-amber-400 font-medium">{emUso} em uso</span>}
              {inativo > 0 && <span>{inativo} inativo</span>}
              <button
                onClick={() => setShowAddUnit(true)}
                className="flex items-center gap-1 text-brand-600 dark:text-brand-400 hover:underline font-medium"
              >
                <Plus size={12} /> Adicionar
              </button>
            </div>
          </div>

          {units.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <Hash size={28} className="text-slate-200 dark:text-gray-700" />
              <p className="text-sm text-slate-400 dark:text-gray-500">Nenhum tombo cadastrado.</p>
              <button onClick={() => setShowAddUnit(true)} className="text-brand-600 text-sm font-medium hover:underline flex items-center gap-1">
                <Plus size={13} /> Adicionar primeiro tombo
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-gray-700/60">
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">Tombo / SN</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide hidden md:table-cell">Observação</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide hidden sm:table-cell">Cadastrado por</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-gray-700/40">
                {units.map((unit) => (
                  <UnitRow
                    key={unit.id}
                    unit={unit}
                    onUpdated={handleUnitUpdated}
                    onDeleted={handleUnitDeleted}
                  />
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </main>

      {showAddUnit && (
        <AddUnitModal itemId={item.id} onClose={() => setShowAddUnit(false)} onAdded={handleUnitAdded} />
      )}
      {showEdit && (
        <EditModal item={item} onClose={() => setShowEdit(false)} onSaved={handleSaved} categories={categories} />
      )}
    </div>
  );
}
