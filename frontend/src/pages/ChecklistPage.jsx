import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Spinner } from "../components/ui";
import AppHeader from "../components/AppHeader";
import {
  ClipboardList, Plus, Search, ChevronRight, RefreshCw,
  CheckCircle, Clock, XCircle, AlertTriangle, Package, Trash2,
} from "lucide-react";

const NUCLEO_LABEL = { NMT: "NMT", NIR: "NIR" };
const NUCLEO_FULL  = { NMT: "Núcleo de Manutenção Técnica", NIR: "Núcleo de Infraestrutura e Redes" };

const STATUS_STYLE = {
  PENDENTE:  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  APROVADO:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  REJEITADO: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
};
const STATUS_ICON = { PENDENTE: Clock, APROVADO: CheckCircle, REJEITADO: XCircle };

function fmtDate(d) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ── Create Checklist Modal ────────────────────────────────────────────────────
function CreateChecklistModal({ onClose, onCreate }) {
  const [step,    setStep]    = useState(1); // 1=info, 2=select items
  const [form,    setForm]    = useState({ title: "", nucleo: "NMT", note: "" });
  const [items,   setItems]   = useState([]); // all inventory items
  const [selected, setSelected] = useState([]); // [{itemId, quantity}]
  const [search,  setSearch]  = useState("");
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState("");
  const { addToast } = useToast();

  useEffect(() => {
    if (step === 2) {
      api.get(`/inventory?status=ATIVO&nucleo=${form.nucleo}&limit=200`)
        .then((r) => setItems(r.data.items))
        .catch(() => setItems([]));
    }
  }, [step, form.nucleo]);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  function toggleItem(item) {
    setSelected((prev) => {
      const exists = prev.find((s) => s.itemId === item.id);
      if (exists) return prev.filter((s) => s.itemId !== item.id);
      return [...prev, { itemId: item.id, quantity: 1, name: item.name, code: item.code, unitMeasure: item.unitMeasure, stock: item.quantity }];
    });
  }

  function setQty(itemId, val) {
    const qty = Math.max(1, parseInt(val) || 1);
    setSelected((prev) => prev.map((s) => s.itemId === itemId ? { ...s, quantity: qty } : s));
  }

  const filtered = items.filter((i) =>
    !search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.code || "").toLowerCase().includes(search.toLowerCase())
  );

  async function handleSubmit() {
    setErr("");
    if (selected.length === 0) return setErr("Selecione ao menos 1 item.");
    setSaving(true);
    try {
      const res = await api.post("/inventory/checklists", {
        title:  form.title.trim(),
        nucleo: form.nucleo,
        note:   form.note.trim() || null,
        items:  selected.map(({ itemId, quantity }) => ({ itemId, quantity })),
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
        {/* Header */}
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
                  placeholder="Buscar item..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <Package size={28} className="text-slate-300 dark:text-gray-600" />
                  <p className="text-sm text-slate-400">Nenhum item ativo no núcleo {form.nucleo}.</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {filtered.map((item) => {
                    const sel = selected.find((s) => s.itemId === item.id);
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                          sel
                            ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                            : "border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800"
                        }`}
                        onClick={() => toggleItem(item)}
                      >
                        <div className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition ${sel ? "border-brand-600 bg-brand-600" : "border-slate-300 dark:border-gray-600"}`}>
                          {sel && <span className="text-white text-xs">✓</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-800 dark:text-gray-100">{item.name}</div>
                          <div className="text-xs text-slate-400 dark:text-gray-500">
                            {item.code ? `Código: ${item.code} · ` : ""}Estoque: {item.quantity} {item.unitMeasure}
                          </div>
                        </div>
                        {sel && (
                          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <span className="text-xs text-slate-500 dark:text-gray-400">Qtd:</span>
                            <input
                              type="number" min="1" max={item.quantity}
                              value={sel.quantity}
                              onChange={(e) => setQty(item.id, e.target.value)}
                              className="w-16 rounded border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-0.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-brand-500"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {selected.length > 0 && (
                <div className="bg-slate-50 dark:bg-gray-800 rounded-lg p-3">
                  <div className="text-xs font-semibold text-slate-600 dark:text-gray-400 mb-2">
                    Selecionados ({selected.length}):
                  </div>
                  <div className="space-y-1">
                    {selected.map((s) => (
                      <div key={s.itemId} className="flex items-center justify-between text-xs text-slate-700 dark:text-gray-300">
                        <span>{s.name}</span>
                        <span className="font-medium">{s.quantity} {s.unitMeasure}</span>
                      </div>
                    ))}
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

        {/* Footer */}
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
export default function ChecklistPage() {
  const [checklists, setChecklists] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filterNucleo, setFilterNucleo] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const { addToast } = useToast();
  const { user }     = useAuth();
  const navigate     = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterNucleo) params.set("nucleo", filterNucleo);
      if (filterStatus) params.set("status", filterStatus);
      const res = await api.get(`/inventory/checklists?${params}`);
      setChecklists(res.data);
    } catch {
      addToast("Erro ao carregar checklists", "error");
    } finally {
      setLoading(false);
    }
  }, [filterNucleo, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const pendingCount = checklists.filter((c) => c.status === "PENDENTE").length;

  function handleCreated(checklist) {
    setShowCreate(false);
    addToast(
      checklist.status === "APROVADO"
        ? "Checklist criado e aprovado automaticamente!"
        : "Checklist criado! Aguardando autorização do responsável.",
      "success",
    );
    load();
  }

  const tabCls = (active) =>
    `px-4 py-1.5 rounded-full text-sm font-medium transition ${
      active
        ? "bg-brand-600 text-white shadow-sm"
        : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-100 hover:bg-slate-100 dark:hover:bg-gray-800"
    }`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <AppHeader />

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-gray-100 flex items-center gap-2">
              <ClipboardList size={20} className="text-brand-600" />
              Checklists de Materiais
            </h1>
            <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">
              Separação de materiais para eventos
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition shadow-sm"
          >
            <Plus size={15} />
            Novo checklist
          </button>
        </div>

        {/* Pending alert for responsável */}
        {pendingCount > 0 && user?.nucleoResponsavel && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 flex items-center gap-3">
            <Clock size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {pendingCount} checklist(s) aguardando sua autorização ({user.nucleoResponsavel})
              </p>
              <button onClick={() => setFilterStatus("PENDENTE")} className="text-xs text-amber-600 dark:text-amber-400 hover:underline mt-0.5">
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
              <button key={key} onClick={() => setFilterStatus(key)} className={tabCls(filterStatus === key)}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            {[
              { key: "",    label: "Todos"  },
              { key: "NMT", label: "NMT"   },
              { key: "NIR", label: "NIR"   },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setFilterNucleo(key)} className={tabCls(filterNucleo === key)}>
                {label}
              </button>
            ))}
            <button onClick={load} title="Atualizar" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-gray-700 text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800 transition">
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-14"><Spinner /></div>
          ) : checklists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-2 text-center">
              <ClipboardList size={32} className="text-slate-300 dark:text-gray-600" />
              <p className="text-slate-500 dark:text-gray-400 text-sm">Nenhum checklist encontrado.</p>
              <button onClick={() => setShowCreate(true)} className="text-brand-600 text-sm font-medium hover:underline">Criar primeiro checklist</button>
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
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-gray-700/40">
                {checklists.map((c) => {
                  const Icon = STATUS_ICON[c.status];
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
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[c.status]}`}>
                          <Icon size={11} />
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-slate-500 dark:text-gray-400 text-xs">
                        {c.createdBy?.name}
                      </td>
                      <td className="px-2 py-3">
                        <ChevronRight size={14} className="text-slate-400 dark:text-gray-500" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </main>

      {showCreate && (
        <CreateChecklistModal onClose={() => setShowCreate(false)} onCreate={handleCreated} />
      )}
    </div>
  );
}
