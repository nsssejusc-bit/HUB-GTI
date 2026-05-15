import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Spinner } from "../components/ui";
import AppHeader from "../components/AppHeader";
import {
  Package, ArrowLeft, Edit2, Save, X, Plus, Minus, RefreshCw,
  Tag, Hash, AlertTriangle, ArrowUpCircle, ArrowDownCircle,
  SlidersHorizontal, Clock, User, Trash2, CheckCircle, XCircle,
} from "lucide-react";

const UNIT_OPTIONS = ["un", "cx", "par", "rolo", "m", "kg", "L", "pç"];

const MOVEMENT_STYLE = {
  ENTRADA: { icon: ArrowUpCircle,     cls: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20", label: "Entrada"  },
  SAIDA:   { icon: ArrowDownCircle,   cls: "text-red-500 dark:text-red-400",         bg: "bg-red-50 dark:bg-red-900/20",         label: "Saída"    },
  AJUSTE:  { icon: SlidersHorizontal, cls: "text-blue-600 dark:text-blue-400",       bg: "bg-blue-50 dark:bg-blue-900/20",       label: "Ajuste"   },
};

function fmtDate(d) {
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Movement Modal ────────────────────────────────────────────────────────────
function MovementModal({ item, onClose, onDone }) {
  const [type, setType]         = useState("ENTRADA");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote]         = useState("");
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState("");

  const isAjuste = type === "AJUSTE";

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1) return setErr("Quantidade deve ser ao menos 1.");
    setSaving(true);
    try {
      const res = await api.post(`/inventory/${item.id}/movements`, { type, quantity: qty, note: note.trim() || null });
      onDone(res.data);
    } catch (e) {
      setErr(e.response?.data?.error || "Erro ao registrar movimentação.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500";
  const labelCls = "block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1";

  const typeBtn = (t, label, Icon) => (
    <button
      type="button"
      onClick={() => setType(t)}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border transition ${
        type === t
          ? `border-transparent ${MOVEMENT_STYLE[t].bg} ${MOVEMENT_STYLE[t].cls}`
          : "border-slate-200 dark:border-gray-700 text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800"
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-gray-700/60">
          <h2 className="text-base font-semibold text-slate-800 dark:text-gray-100">Registrar movimentação</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelCls}>Tipo</label>
            <div className="flex gap-2">
              {typeBtn("ENTRADA", "Entrada",  ArrowUpCircle)}
              {typeBtn("SAIDA",   "Saída",    ArrowDownCircle)}
              {typeBtn("AJUSTE",  "Ajuste",   SlidersHorizontal)}
            </div>
          </div>

          <div>
            <label className={labelCls}>
              {isAjuste ? "Novo valor absoluto" : "Quantidade"}
            </label>
            <input
              className={inputCls}
              type="number" min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={isAjuste ? "Quantidade final no estoque" : "Ex: 5"}
            />
            {!isAjuste && (
              <p className="mt-1 text-xs text-slate-400 dark:text-gray-500">
                Estoque atual: <strong>{item.quantity} {item.unitMeasure}</strong>
                {type === "ENTRADA"
                  ? ` → ${item.quantity + (parseInt(quantity) || 0)} ${item.unitMeasure}`
                  : ` → ${Math.max(0, item.quantity - (parseInt(quantity) || 0))} ${item.unitMeasure}`
                }
              </p>
            )}
          </div>

          <div>
            <label className={labelCls}>Observação <span className="text-slate-400">(opcional)</span></label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex: Recebimento de NF 001, Empréstimo para setor X..."
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
              Registrar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({ item, onClose, onSaved, categories }) {
  const [form, setForm] = useState({
    name:        item.name,
    code:        item.code || "",
    description: item.description || "",
    unitMeasure: item.unitMeasure,
    category:    item.category || "",
    nucleo:      item.nucleo || "",
    status:      item.status,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    if (!form.name.trim()) return setErr("Informe o nome do item.");
    setSaving(true);
    try {
      const payload = {
        name:        form.name.trim(),
        code:        form.code.trim() || null,
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

  const inputCls = "w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500";
  const labelCls = "block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-gray-700 overflow-hidden">
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Código / SN</label>
              <input className={inputCls} value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="Opcional" />
            </div>
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Unidade de medida</label>
              <select className={inputCls} value={form.unitMeasure} onChange={(e) => set("unitMeasure", e.target.value)}>
                {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Núcleo</label>
              <select className={inputCls} value={form.nucleo} onChange={(e) => set("nucleo", e.target.value)}>
                <option value="">Sem núcleo</option>
                <option value="NMT">NMT</option>
                <option value="NIR">NIR</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select className={inputCls} value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="ATIVO">Ativo</option>
              <option value="INATIVO">Inativo</option>
            </select>
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function InventoryItemDetailPage() {
  const { id }      = useParams();
  const navigate    = useNavigate();
  const { user }    = useAuth();
  const { addToast } = useToast();

  const [item, setItem]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [categories, setCategories] = useState([]);
  const [showMovement, setShowMovement] = useState(false);
  const [showEdit, setShowEdit]     = useState(false);
  const [deleting, setDeleting]     = useState(false);

  const isAdmin = user?.role === "ADMIN";

  async function load() {
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
  }

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    api.get("/inventory/categories").then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  function handleMovementDone({ movement, newQuantity }) {
    setShowMovement(false);
    addToast("Movimentação registrada!", "success");
    setItem((prev) => ({
      ...prev,
      quantity:  newQuantity,
      movements: [movement, ...prev.movements],
    }));
  }

  function handleSaved(updated) {
    setShowEdit(false);
    addToast("Item atualizado!", "success");
    setItem((prev) => ({ ...prev, ...updated }));
  }

  async function handleDelete() {
    if (!window.confirm(`Excluir "${item.name}" permanentemente? Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    try {
      await api.delete(`/inventory/${item.id}`);
      addToast("Item excluído.", "success");
      navigate("/painel/inventario");
    } catch (e) {
      addToast(e.response?.data?.error || "Erro ao excluir.", "error");
    } finally {
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

  const StatusIcon = item.status === "ATIVO" ? CheckCircle : XCircle;
  const statusColor = item.status === "ATIVO"
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-slate-400 dark:text-gray-500";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <AppHeader />

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* Breadcrumb + actions */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Link
            to="/painel/inventario"
            className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition"
          >
            <ArrowLeft size={14} />
            Inventário
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMovement(true)}
              className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition"
            >
              <Plus size={14} />
              Movimentação
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
            <div>
              <div className="text-xs text-slate-500 dark:text-gray-400 mb-0.5">Quantidade</div>
              <div className={`text-2xl font-bold ${item.quantity === 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-800 dark:text-gray-100"}`}>
                {item.quantity}
                <span className="text-sm font-normal text-slate-400 dark:text-gray-500 ml-1">{item.unitMeasure}</span>
              </div>
              {item.quantity === 0 && (
                <div className="flex items-center gap-1 mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle size={11} /> Sem estoque
                </div>
              )}
            </div>

            <div>
              <div className="text-xs text-slate-500 dark:text-gray-400 mb-0.5">Código / SN</div>
              <div className="text-sm font-medium text-slate-800 dark:text-gray-100">
                {item.code
                  ? <span className="font-mono bg-slate-100 dark:bg-gray-800 px-2 py-0.5 rounded text-slate-700 dark:text-gray-300">{item.code}</span>
                  : <span className="text-slate-400 dark:text-gray-500 font-normal italic">Sem código</span>
                }
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 dark:text-gray-400 mb-0.5">Categoria</div>
              <div className="text-sm">
                {item.category
                  ? <span className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full text-xs"><Tag size={10} />{item.category}</span>
                  : <span className="text-slate-400 dark:text-gray-500 italic">Sem categoria</span>
                }
              </div>
            </div>

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

        {/* Movement history */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-gray-700/60">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-200 flex items-center gap-2">
              <Clock size={15} className="text-slate-400" />
              Histórico de movimentações
            </h2>
            <span className="text-xs text-slate-400 dark:text-gray-500">{item.movements.length} registro(s)</span>
          </div>

          {item.movements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
              <Clock size={28} className="text-slate-200 dark:text-gray-700" />
              <p className="text-sm text-slate-400 dark:text-gray-500">Nenhuma movimentação registrada.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-gray-700/40">
              {item.movements.map((mv) => {
                const { icon: MvIcon, cls, bg, label } = MOVEMENT_STYLE[mv.type];
                return (
                  <div key={mv.id} className="flex items-start gap-3 px-5 py-3.5">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 mt-0.5 ${bg}`}>
                      <MvIcon size={15} className={cls} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <span className={`text-sm font-semibold ${cls}`}>
                          {label}
                          {mv.type === "AJUSTE"
                            ? ` → ${mv.quantity} ${item.unitMeasure}`
                            : ` ${mv.type === "ENTRADA" ? "+" : "−"}${mv.quantity} ${item.unitMeasure}`
                          }
                        </span>
                        <span className="text-xs text-slate-400 dark:text-gray-500">{fmtDate(mv.createdAt)}</span>
                      </div>
                      {mv.note && <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">{mv.note}</p>}
                      <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5 flex items-center gap-1">
                        <User size={10} /> {mv.createdBy?.name || "—"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {showMovement && (
        <MovementModal item={item} onClose={() => setShowMovement(false)} onDone={handleMovementDone} />
      )}
      {showEdit && (
        <EditModal item={item} onClose={() => setShowEdit(false)} onSaved={handleSaved} categories={categories} />
      )}
    </div>
  );
}
