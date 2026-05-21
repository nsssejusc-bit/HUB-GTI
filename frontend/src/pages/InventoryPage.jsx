import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Spinner } from "../components/ui";
import AppHeader from "../components/AppHeader";
import {
  Package, Plus, Search, Tag, Hash, AlertTriangle,
  CheckCircle, XCircle, ChevronRight, RefreshCw, Filter,
  ClipboardList, Clock, RotateCcw,
} from "lucide-react";

const STATUS_STYLE_ITEM = {
  ATIVO:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  INATIVO: "bg-slate-100 text-slate-500 dark:bg-gray-800 dark:text-gray-400",
};

const CHECKLIST_STATUS_STYLE = {
  PENDENTE:  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  APROVADO:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  REJEITADO: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
};
const CHECKLIST_STATUS_ICON = { PENDENTE: Clock, APROVADO: CheckCircle, REJEITADO: XCircle };

const NUCLEO_FULL = { NMT: "Núcleo de Manutenção Técnica", NIR: "Núcleo de Infraestrutura e Redes" };
const UNIT_OPTIONS = ["un", "cx", "par", "rolo", "m", "kg", "L", "pç"];

function fmtDate(d) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ── Create Item Modal ─────────────────────────────────────────────────────────
function CreateItemModal({ onClose, onCreate, categories }) {
  const [form, setForm] = useState({
    name: "", description: "", unitMeasure: "un", category: "", nucleo: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

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
      };
      const res = await api.post("/inventory", payload);
      onCreate(res.data);
    } catch (e) {
      setErr(e.response?.data?.error || "Erro ao criar item.");
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
            <Package size={16} className="text-brand-600" />
            Novo item
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelCls}>Nome *</label>
            <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Cabo HDMI, Mouse Logitech..." />
          </div>

          <div>
            <label className={labelCls}>Categoria <span className="text-slate-400">(opcional)</span></label>

            {/* Chips das categorias já cadastradas */}
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set("category", form.category === c ? "" : c)}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition ${
                      form.category === c
                        ? "bg-brand-600 text-white border-brand-600"
                        : "border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-400 hover:border-brand-400 dark:hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}

            {/* Input para nova categoria */}
            <input
              className={inputCls}
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              placeholder={categories.length > 0 ? "Ou digite uma nova categoria..." : "Ex: Periférico, Cabo..."}
            />
          </div>

          <div>
            <label className={labelCls}>Núcleo <span className="text-slate-400">(opcional)</span></label>
            <select className={inputCls} value={form.nucleo} onChange={(e) => set("nucleo", e.target.value)}>
              <option value="">Sem núcleo</option>
              <option value="NMT">NMT – Manutenção Técnica</option>
              <option value="NIR">NIR – Infraestrutura e Redes</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>Unidade de medida</label>
            <select className={inputCls} value={form.unitMeasure} onChange={(e) => set("unitMeasure", e.target.value)}>
              {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-400 dark:text-gray-500">
              Tombos/SNs são adicionados individualmente após criar o item.
            </p>
          </div>

          <div>
            <label className={labelCls}>Descrição <span className="text-slate-400">(opcional)</span></label>
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
              {saving ? <Spinner size="sm" /> : <Plus size={14} />}
              Criar item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Create Checklist Modal ────────────────────────────────────────────────────
function CreateChecklistModal({ onClose, onCreate }) {
  const [step,     setStep]     = useState(1);
  const [form,     setForm]     = useState({ title: "", nucleo: "NMT", note: "" });
  const [items,    setItems]    = useState([]);   // items with available units
  const [selected, setSelected] = useState([]);   // array of unit ids
  const [search,   setSearch]   = useState("");
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState("");

  useEffect(() => {
    if (step === 2) {
      api.get(`/inventory?status=ATIVO&nucleo=${form.nucleo}&limit=200&withUnits=true`)
        .then((r) => setItems(r.data.items))
        .catch(() => setItems([]));
    }
  }, [step, form.nucleo]);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  function toggleUnit(unitId) {
    setSelected((prev) =>
      prev.includes(unitId) ? prev.filter((id) => id !== unitId) : [...prev, unitId]
    );
  }

  // All available units across items, filtered by search
  const allUnits = items.flatMap((item) =>
    (item.units || [])
      .filter((u) => u.status === "DISPONIVEL")
      .map((u) => ({ ...u, itemName: item.name, itemUnitMeasure: item.unitMeasure }))
  );
  const filtered = search.trim()
    ? allUnits.filter((u) =>
        u.itemName.toLowerCase().includes(search.toLowerCase()) ||
        (u.tombo || "").toLowerCase().includes(search.toLowerCase())
      )
    : allUnits;

  // Group filtered units by itemName for display
  const grouped = filtered.reduce((acc, u) => {
    if (!acc[u.itemName]) acc[u.itemName] = [];
    acc[u.itemName].push(u);
    return acc;
  }, {});

  async function handleSubmit() {
    setErr("");
    if (selected.length === 0) return setErr("Selecione ao menos 1 unidade.");
    setSaving(true);
    try {
      const res = await api.post("/inventory/checklists", {
        title:   form.title.trim(),
        nucleo:  form.nucleo,
        note:    form.note.trim() || null,
        unitIds: selected,
      });
      onCreate(res.data);
    } catch (e) {
      setErr(e.response?.data?.error || "Erro ao criar checklist.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500";
  const labelCls = "block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-gray-700 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-gray-700/60 shrink-0">
          <h2 className="text-base font-semibold text-slate-800 dark:text-gray-100 flex items-center gap-2">
            <ClipboardList size={16} className="text-brand-600" />
            Novo checklist
            <span className="text-xs text-slate-400 ml-1">Passo {step}/2</span>
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {step === 1 && (
            <>
              <div>
                <label className={labelCls}>Título / Evento *</label>
                <input className={inputCls} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex: Evento da Paz, Operação SEJUSC..." />
              </div>
              <div>
                <label className={labelCls}>Núcleo *</label>
                <div className="flex gap-3">
                  {["NMT", "NIR"].map((n) => (
                    <button
                      key={n} type="button"
                      onClick={() => set("nucleo", n)}
                      className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition ${
                        form.nucleo === n
                          ? "border-brand-600 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300"
                          : "border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      <div className="font-bold">{n}</div>
                      <div className="text-xs opacity-70">{NUCLEO_FULL[n]}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Observação <span className="text-slate-400">(opcional)</span></label>
                <textarea className={`${inputCls} resize-none`} rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="Informações adicionais..." />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 text-sm text-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Buscar por item ou tombo..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {allUnits.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <Package size={28} className="text-slate-300 dark:text-gray-600" />
                  <p className="text-sm text-slate-400">Nenhuma unidade disponível no núcleo {form.nucleo}.</p>
                </div>
              ) : Object.keys(grouped).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2">
                  <p className="text-sm text-slate-400">Nenhum resultado para "{search}".</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {Object.entries(grouped).map(([itemName, units]) => (
                    <div key={itemName}>
                      <div className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 px-1">
                        {itemName}
                      </div>
                      <div className="space-y-1">
                        {units.map((u) => {
                          const isSel = selected.includes(u.id);
                          return (
                            <div
                              key={u.id}
                              onClick={() => toggleUnit(u.id)}
                              className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition ${
                                isSel
                                  ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                                  : "border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800"
                              }`}
                            >
                              <div className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition ${isSel ? "border-brand-600 bg-brand-600" : "border-slate-300 dark:border-gray-600"}`}>
                                {isSel && <span className="text-white text-[10px] leading-none">✓</span>}
                              </div>
                              <span className="font-mono text-sm text-slate-700 dark:text-gray-300">
                                {u.tombo || <span className="italic text-slate-400">Sem tombo</span>}
                              </span>
                              <span className="ml-auto text-xs text-slate-400 dark:text-gray-500">{u.itemUnitMeasure}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selected.length > 0 && (
                <div className="bg-slate-50 dark:bg-gray-800 rounded-lg p-3">
                  <div className="text-xs font-semibold text-slate-600 dark:text-gray-400 mb-1">
                    {selected.length} unidade(s) selecionada(s)
                  </div>
                </div>
              )}
            </>
          )}

          {err && (
            <p className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
              <AlertTriangle size={14} /> {err}
            </p>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-slate-100 dark:border-gray-700/60 shrink-0">
          {step === 1 ? (
            <>
              <button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 dark:border-gray-700 py-2 text-sm text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800 transition">
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!form.title.trim()) return setErr("Informe o título do checklist.");
                  setErr("");
                  setStep(2);
                }}
                className="flex-1 rounded-lg bg-brand-600 hover:bg-brand-700 py-2 text-sm font-medium text-white transition"
              >
                Próximo →
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep(1)} className="flex-1 rounded-lg border border-slate-200 dark:border-gray-700 py-2 text-sm text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800 transition">
                ← Voltar
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || selected.length === 0}
                className="flex-1 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-60 py-2 text-sm font-medium text-white transition flex items-center justify-center gap-1.5"
              >
                {saving ? <Spinner size="sm" /> : <Plus size={14} />}
                Criar checklist
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function InventoryPage() {
  const [tab, setTab] = useState("items"); // "items" | "checklists"

  // Items state
  const [items, setItems]               = useState([]);
  const [total, setTotal]               = useState(0);
  const [loadingItems, setLoadingItems] = useState(true);
  const [search, setSearch]             = useState("");
  const [filterCat, setFilterCat]       = useState("");
  const [filterStatus, setFilterStatus] = useState("ATIVO");
  const [categories, setCategories]     = useState([]);
  const [showCreateItem, setShowCreateItem] = useState(false);

  // Checklists state
  const [checklists, setChecklists]         = useState([]);
  const [loadingCL, setLoadingCL]           = useState(false);
  const [filterCLNucleo, setFilterCLNucleo] = useState("");
  const [filterCLStatus, setFilterCLStatus] = useState("");
  const [showCreateCL, setShowCreateCL]     = useState(false);

  const { addToast } = useToast();
  const { user }     = useAuth();
  const navigate     = useNavigate();

  // Load items
  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (search)       params.set("search", search);
      if (filterCat)    params.set("category", filterCat);
      if (filterStatus) params.set("status", filterStatus);
      const res = await api.get(`/inventory?${params}`);
      setItems(res.data.items);
      setTotal(res.data.total);
    } catch {
      addToast("Erro ao carregar inventário", "error");
    } finally {
      setLoadingItems(false);
    }
  }, [search, filterCat, filterStatus]);

  // Load checklists
  const loadChecklists = useCallback(async () => {
    setLoadingCL(true);
    try {
      const params = new URLSearchParams();
      if (filterCLNucleo) params.set("nucleo", filterCLNucleo);
      if (filterCLStatus) params.set("status", filterCLStatus);
      const res = await api.get(`/inventory/checklists?${params}`);
      setChecklists(res.data);
    } catch {
      addToast("Erro ao carregar checklists", "error");
    } finally {
      setLoadingCL(false);
    }
  }, [filterCLNucleo, filterCLStatus]);

  useEffect(() => { loadItems(); }, [loadItems]);
  useEffect(() => { if (tab === "checklists") loadChecklists(); }, [tab, loadChecklists]);
  // Reload items when switching back to items tab
  useEffect(() => { if (tab === "items") loadItems(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  // Reload data when the window regains focus (user returns from another page/tab)
  useEffect(() => {
    function onFocus() { loadItems(); if (tab === "checklists") loadChecklists(); }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadItems, loadChecklists, tab]);

  useEffect(() => {
    api.get("/inventory/categories").then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  // KPI counts
  const totalActive  = items.filter((i) => i.status === "ATIVO").length;
  const lowStock     = items.filter((i) => i.status === "ATIVO" && (i.disponivel ?? 0) === 0).length;
  const totalUnitsAll = items.reduce((acc, i) => acc + (i.totalUnits ?? 0), 0);

  const pendingCLCount = checklists.filter((c) => c.status === "PENDENTE").length;

  function handleItemCreated(item) {
    setShowCreateItem(false);
    addToast("Item criado! Agora adicione os tombos/SNs na página do item.", "success");
    loadItems();
    if (item.category && !categories.includes(item.category)) {
      setCategories((c) => [...c, item.category].sort());
    }
  }

  function handleChecklistCreated(checklist) {
    setShowCreateCL(false);
    addToast(
      checklist.status === "APROVADO"
        ? "Checklist criado e aprovado automaticamente!"
        : "Checklist criado! Aguardando autorização do responsável.",
      "success",
    );
    loadChecklists();
    if (checklist.status === "APROVADO") loadItems();
  }

  const [confirmReturn, setConfirmReturn] = useState(null);

  async function handleReturn(checklist) {
    try {
      await api.post(`/inventory/checklists/${checklist.id}/return`);
      addToast("Itens devolvidos ao estoque com sucesso!", "success");
      loadChecklists();
      loadItems();
    } catch (e) {
      addToast(e.response?.data?.error || "Erro ao devolver itens", "error");
    } finally {
      setConfirmReturn(null);
    }
  }

  const pillCls = (active) =>
    `px-4 py-1.5 rounded-full text-sm font-medium transition ${
      active
        ? "bg-brand-600 text-white shadow-sm"
        : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-100 hover:bg-slate-100 dark:hover:bg-gray-800"
    }`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <AppHeader />

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* Page header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-gray-100 flex items-center gap-2">
              <Package size={20} className="text-brand-600" />
              Inventário
            </h1>
            <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">
              Gestão de equipamentos e materiais
            </p>
          </div>

          {tab === "items" ? (
            <button
              onClick={() => setShowCreateItem(true)}
              className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition shadow-sm"
            >
              <Plus size={15} />
              Novo item
            </button>
          ) : (
            <button
              onClick={() => setShowCreateCL(true)}
              className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition shadow-sm"
            >
              <Plus size={15} />
              Novo checklist
            </button>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 border-b border-slate-200 dark:border-gray-700">
          <button
            onClick={() => setTab("items")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
              tab === "items"
                ? "border-brand-600 text-brand-700 dark:text-brand-400"
                : "border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200"
            }`}
          >
            <Package size={15} />
            Itens
          </button>
          <button
            onClick={() => setTab("checklists")}
            className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
              tab === "checklists"
                ? "border-brand-600 text-brand-700 dark:text-brand-400"
                : "border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200"
            }`}
          >
            <ClipboardList size={15} />
            Checklists
            {pendingCLCount > 0 && (
              <span className="ml-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold px-1">
                {pendingCLCount > 9 ? "9+" : pendingCLCount}
              </span>
            )}
          </button>
        </div>

        {/* ── ITEMS TAB ── */}
        {tab === "items" && (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Modelos ativos",  value: totalActive,  icon: CheckCircle,   color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
                { label: "Sem disponível", value: lowStock,     icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-50 dark:bg-amber-900/20"     },
                { label: "Total modelos",  value: total,        icon: Package,       color: "text-brand-600 dark:text-brand-400",    bg: "bg-brand-50 dark:bg-brand-900/20"     },
                { label: "Total tombos",   value: totalUnitsAll,icon: Hash,          color: "text-purple-600 dark:text-purple-400",  bg: "bg-purple-50 dark:bg-purple-900/20"   },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700 p-4 flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
                    <Icon size={18} className={color} />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-slate-800 dark:text-gray-100">{value}</div>
                    <div className="text-xs text-slate-500 dark:text-gray-400">{label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 text-sm text-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="Buscar por nome, código ou categoria..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                {categories.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Filter size={14} className="text-slate-400 dark:text-gray-500 shrink-0" />
                    <button
                      type="button"
                      onClick={() => setFilterCat("")}
                      className={`text-xs px-2.5 py-1 rounded-full border font-medium transition ${
                        !filterCat
                          ? "bg-slate-600 dark:bg-gray-300 text-white dark:text-gray-900 border-slate-600 dark:border-gray-300"
                          : "border-slate-200 dark:border-gray-700 text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      Todas
                    </button>
                    {categories.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFilterCat(filterCat === c ? "" : c)}
                        className={`text-xs px-2.5 py-1 rounded-full border font-medium transition ${
                          filterCat === c
                            ? "bg-brand-600 text-white border-brand-600"
                            : "border-slate-200 dark:border-gray-700 text-slate-500 dark:text-gray-400 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={loadItems} title="Atualizar" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-gray-700 text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800 transition">
                  <RefreshCw size={14} />
                </button>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { key: "",        label: "Todos"    },
                  { key: "ATIVO",   label: "Ativos"   },
                  { key: "INATIVO", label: "Inativos" },
                ].map(({ key, label }) => (
                  <button key={key} onClick={() => setFilterStatus(key)} className={pillCls(filterStatus === key)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Items list */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
              {loadingItems ? (
                <div className="flex items-center justify-center py-16"><Spinner /></div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <Package size={36} className="text-slate-300 dark:text-gray-600" />
                  <p className="text-slate-500 dark:text-gray-400 text-sm">Nenhum item encontrado.</p>
                  <button onClick={() => setShowCreateItem(true)} className="text-brand-600 text-sm font-medium hover:underline">
                    Cadastrar primeiro item
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-gray-700/60">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">Item</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide hidden md:table-cell">Categoria</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">Disponível</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide hidden sm:table-cell">Em uso</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide hidden sm:table-cell">Status</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-gray-700/40">
                    {items.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50 dark:hover:bg-gray-800/50 transition cursor-pointer"
                        onClick={() => navigate(`/painel/inventario/${item.id}`)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800 dark:text-gray-100">{item.name}</div>
                          {item.description && (
                            <div className="text-xs text-slate-400 dark:text-gray-500 truncate max-w-[200px]">{item.description}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {item.category
                            ? <span className="inline-flex items-center gap-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full"><Tag size={10} />{item.category}</span>
                            : <span className="text-slate-300 dark:text-gray-600 text-xs">—</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-semibold text-sm ${(item.disponivel ?? 0) === 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                            {item.disponivel ?? 0}
                          </span>
                          <span className="text-xs text-slate-400 dark:text-gray-500 ml-1">{item.unitMeasure}</span>
                        </td>
                        <td className="px-4 py-3 text-center hidden sm:table-cell">
                          <span className={`font-semibold text-sm ${(item.emUso ?? 0) > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-400 dark:text-gray-600"}`}>
                            {item.emUso ?? 0}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center hidden sm:table-cell">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE_ITEM[item.status]}`}>
                            {item.status === "ATIVO" ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          <ChevronRight size={14} className="text-slate-400 dark:text-gray-500" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── CHECKLISTS TAB ── */}
        {tab === "checklists" && (
          <>
            {/* Pending alert */}
            {pendingCLCount > 0 && user?.nucleoResponsavel && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 flex items-center gap-3">
                <Clock size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    {pendingCLCount} checklist(s) aguardando sua autorização ({user.nucleoResponsavel})
                  </p>
                  <button onClick={() => setFilterCLStatus("PENDENTE")} className="text-xs text-amber-600 dark:text-amber-400 hover:underline mt-0.5">
                    Ver pendentes →
                  </button>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700 p-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { key: "",          label: "Todos os status" },
                  { key: "PENDENTE",  label: "Pendentes"       },
                  { key: "APROVADO",  label: "Aprovados"       },
                  { key: "REJEITADO", label: "Rejeitados"      },
                ].map(({ key, label }) => (
                  <button key={key} onClick={() => setFilterCLStatus(key)} className={pillCls(filterCLStatus === key)}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 ml-auto">
                {[
                  { key: "",    label: "Todos" },
                  { key: "NMT", label: "NMT"  },
                  { key: "NIR", label: "NIR"  },
                ].map(({ key, label }) => (
                  <button key={key} onClick={() => setFilterCLNucleo(key)} className={pillCls(filterCLNucleo === key)}>
                    {label}
                  </button>
                ))}
                <button onClick={loadChecklists} title="Atualizar" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-gray-700 text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800 transition">
                  <RefreshCw size={13} />
                </button>
              </div>
            </div>

            {/* Checklists list */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
              {loadingCL ? (
                <div className="flex items-center justify-center py-14"><Spinner /></div>
              ) : checklists.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 gap-2 text-center">
                  <ClipboardList size={32} className="text-slate-300 dark:text-gray-600" />
                  <p className="text-slate-500 dark:text-gray-400 text-sm">Nenhum checklist encontrado.</p>
                  <button onClick={() => setShowCreateCL(true)} className="text-brand-600 text-sm font-medium hover:underline">
                    Criar primeiro checklist
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-gray-700/60">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">Checklist</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide hidden sm:table-cell">Núcleo</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide hidden md:table-cell">Itens</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide hidden lg:table-cell">Criado por</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-gray-700/40">
                    {checklists.map((c) => {
                      const Icon = CHECKLIST_STATUS_ICON[c.status];
                      return (
                        <tr
                          key={c.id}
                          className="hover:bg-slate-50 dark:hover:bg-gray-800/50 transition cursor-pointer"
                          onClick={() => navigate(`/painel/checklists/${c.id}`)}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800 dark:text-gray-100">{c.title}</div>
                            <div className="text-xs text-slate-400 dark:text-gray-500">{fmtDate(c.createdAt)}</div>
                          </td>
                          <td className="px-4 py-3 text-center hidden sm:table-cell">
                            <span className="inline-block text-xs font-bold bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded">
                              {c.nucleo}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center hidden md:table-cell text-slate-600 dark:text-gray-300 font-medium">
                            {c._count.items}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${CHECKLIST_STATUS_STYLE[c.status]}`}>
                              <Icon size={11} />
                              {c.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell text-slate-500 dark:text-gray-400 text-xs">
                            {c.createdBy?.name}
                          </td>
                          <td className="px-3 py-3 text-right">
                            {c.status === "APROVADO" ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); setConfirmReturn(c); }}
                                title="Devolver itens ao estoque"
                                className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 px-2 py-1 rounded-lg transition"
                              >
                                <RotateCcw size={11} />
                                Devolver
                              </button>
                            ) : (
                              <ChevronRight size={14} className="text-slate-400 dark:text-gray-500" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {showCreateItem && (
        <CreateItemModal
          onClose={() => setShowCreateItem(false)}
          onCreate={handleItemCreated}
          categories={categories}
        />
      )}

      {showCreateCL && (
        <CreateChecklistModal
          onClose={() => setShowCreateCL(false)}
          onCreate={handleChecklistCreated}
        />
      )}

      {confirmReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-gray-700 p-6 max-w-sm w-full space-y-4">
            <h3 className="font-semibold text-slate-800 dark:text-gray-100 flex items-center gap-2">
              <RotateCcw size={16} className="text-emerald-600" />
              Devolver itens ao estoque
            </h3>
            <p className="text-sm text-slate-500 dark:text-gray-400">
              Os {confirmReturn._count?.items} itens do checklist{" "}
              <strong className="text-slate-700 dark:text-gray-200">{confirmReturn.title}</strong>{" "}
              serão adicionados de volta ao estoque. Confirmar?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmReturn(null)}
                className="flex-1 rounded-lg border border-slate-200 dark:border-gray-700 py-2 text-sm text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleReturn(confirmReturn)}
                className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 py-2 text-sm font-medium text-white transition flex items-center justify-center gap-1.5"
              >
                <RotateCcw size={13} />
                Confirmar devolução
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
