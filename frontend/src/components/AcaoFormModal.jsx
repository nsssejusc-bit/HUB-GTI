import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { Spinner } from "./ui";
import DateTimeInput from "./DateTimeInput";
import {
  Zap, MapPin, Calendar, Users, Package, ClipboardList,
  ChevronLeft, ChevronRight, Check, X, Plus, Minus, Search,
} from "lucide-react";

const NUCLEO_LABELS = { NMT: "NMT", NIR: "NIR" };

function fmtDT(v) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function TechChip({ name, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 text-xs px-2 py-0.5">
      {name}
      {onRemove && (
        <button type="button" onClick={onRemove} className="hover:text-red-500 transition">
          <X size={10} />
        </button>
      )}
    </span>
  );
}

// ── Step 1: Informações do evento ─────────────────────────────────────────────
function Step1({ form, setForm, techs }) {
  const selected = techs.filter((t) => form.tecnicoIds.includes(t.id));
  const available = techs.filter((t) => !form.tecnicoIds.includes(t.id));

  function toggleTech(id) {
    setForm((f) => ({
      ...f,
      tecnicoIds: f.tecnicoIds.includes(id)
        ? f.tecnicoIds.filter((x) => x !== id)
        : [...f.tecnicoIds, id],
    }));
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="field-label">Nome do evento *</label>
        <input
          type="text" required autoFocus
          value={form.nomeEvento}
          onChange={(e) => setForm((f) => ({ ...f, nomeEvento: e.target.value }))}
          placeholder="Ex: Operação Verão 2026, Formatura SEJUSC..."
          className="field-input"
        />
      </div>

      <div>
        <label className="field-label">Local *</label>
        <input
          type="text" required
          value={form.local}
          onChange={(e) => setForm((f) => ({ ...f, local: e.target.value }))}
          placeholder="Ex: Teatro Amazonas, Rua X nº 123..."
          className="field-input"
        />
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="field-label">Início *</label>
          <DateTimeInput
            value={form.startDateTime}
            onChange={(v) => setForm((f) => ({ ...f, startDateTime: v }))}
          />
        </div>
        <div>
          <label className="field-label">Término *</label>
          <DateTimeInput
            value={form.endDateTime}
            onChange={(v) => setForm((f) => ({ ...f, endDateTime: v }))}
          />
        </div>
      </div>

      <div>
        <label className="field-label">Técnicos responsáveis</label>
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {selected.map((t) => (
              <TechChip key={t.id} name={t.name} onRemove={() => toggleTech(t.id)} />
            ))}
          </div>
        )}
        {available.length > 0 && (
          <select
            defaultValue=""
            onChange={(e) => { if (e.target.value) { toggleTech(Number(e.target.value)); e.target.value = ""; } }}
            className="field-input text-sm"
          >
            <option value="">+ Adicionar técnico</option>
            {available.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
      </div>

      <div>
        <label className="field-label">Observações</label>
        <textarea
          rows={2}
          value={form.problema}
          onChange={(e) => setForm((f) => ({ ...f, problema: e.target.value }))}
          placeholder="Detalhes adicionais sobre a ação..."
          className="field-input resize-none text-sm"
        />
      </div>
    </div>
  );
}

// ── Step 2: Lista de materiais ────────────────────────────────────────────────
function Step2({ form, setForm, onChecklistTitleEdit }) {
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState("");
  const [expanded, setExpanded]     = useState(null);
  const [units, setUnits]           = useState({});
  const [loadingItems, setLoadingItems] = useState(new Set());

  useEffect(() => {
    if (!form.hasChecklist) return;
    setLoading(true);
    api.get("/inventory", { params: { limit: 200 } })
      .then((r) => setItems(r.data.items ?? r.data))
      .finally(() => setLoading(false));
  }, [form.hasChecklist]);

  async function expandItem(itemId) {
    if (expanded === itemId) { setExpanded(null); return; }
    setExpanded(itemId);
    if (units[itemId]) return;
    setLoadingItems((prev) => new Set([...prev, itemId]));
    try {
      const res = await api.get(`/inventory/${itemId}/units`);
      const available = (res.data ?? []).filter((u) => u.status === "DISPONIVEL");
      setUnits((prev) => ({ ...prev, [itemId]: available }));
    } finally {
      setLoadingItems((prev) => { const next = new Set(prev); next.delete(itemId); return next; });
    }
  }

  function toggleUnit(unitId) {
    setForm((f) => {
      const ids = f.checklist.unitIds;
      return {
        ...f,
        checklist: {
          ...f.checklist,
          unitIds: ids.includes(unitId) ? ids.filter((x) => x !== unitId) : [...ids, unitId],
        },
      };
    });
  }

  const filtered = items.filter((it) =>
    !search || it.name.toLowerCase().includes(search.toLowerCase()) ||
    it.category?.toLowerCase().includes(search.toLowerCase())
  );

  const selectedCount = form.checklist.unitIds.length;

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          onClick={() => setForm((f) => ({ ...f, hasChecklist: !f.hasChecklist }))}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            form.hasChecklist ? "bg-brand-600" : "bg-slate-200 dark:bg-gray-600"
          }`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            form.hasChecklist ? "translate-x-5" : "translate-x-0"
          }`} />
        </div>
        <span className="text-sm font-medium text-slate-700 dark:text-gray-300">
          Criar lista de materiais do inventário
        </span>
      </label>

      {form.hasChecklist && (
        <div className="space-y-3 border-t border-slate-100 dark:border-gray-700/60 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Título da lista *</label>
              <input
                type="text"
                value={form.checklist.title}
                onChange={(e) => {
                  onChecklistTitleEdit?.();
                  setForm((f) => ({ ...f, checklist: { ...f.checklist, title: e.target.value } }));
                }}
                placeholder="Nome da lista de materiais"
                className="field-input text-sm"
              />
            </div>
            <div>
              <label className="field-label">Núcleo *</label>
              <select
                value={form.checklist.nucleo}
                onChange={(e) => setForm((f) => ({ ...f, checklist: { ...f.checklist, nucleo: e.target.value } }))}
                className="field-input text-sm"
              >
                {Object.entries(NUCLEO_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="field-label">Observação da lista</label>
            <input
              type="text"
              value={form.checklist.note}
              onChange={(e) => setForm((f) => ({ ...f, checklist: { ...f.checklist, note: e.target.value } }))}
              placeholder="Opcional..."
              className="field-input text-sm"
            />
          </div>

          {/* Selected summary */}
          {selectedCount > 0 && (
            <div className="rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 px-3 py-2 text-xs text-brand-700 dark:text-brand-300">
              {selectedCount} unidade{selectedCount !== 1 ? "s" : ""} selecionada{selectedCount !== 1 ? "s" : ""}
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text" value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar item no inventário..."
              className="field-input pl-8 text-sm"
            />
          </div>

          {/* Item list */}
          {loading ? (
            <div className="flex justify-center py-6"><Spinner className="h-5 w-5" /></div>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-gray-700 divide-y divide-slate-100 dark:divide-gray-700/60">
              {filtered.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-400">Nenhum item encontrado</div>
              ) : filtered.map((item) => {
                const itemUnits = units[item.id] ?? [];
                const selectedInItem = itemUnits.filter((u) => form.checklist.unitIds.includes(u.id)).length;
                return (
                  <div key={item.id}>
                    <button
                      type="button"
                      onClick={() => expandItem(item.id)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-gray-800/60 transition text-left"
                    >
                      <Package size={13} className="text-slate-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-700 dark:text-gray-300 truncate">{item.name}</div>
                        {item.category && <div className="text-xs text-slate-400">{item.category}</div>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {selectedInItem > 0 && (
                          <span className="text-xs font-medium text-brand-600 dark:text-brand-400">
                            {selectedInItem} sel.
                          </span>
                        )}
                        {expanded === item.id ? <Minus size={13} className="text-slate-400" /> : <Plus size={13} className="text-slate-400" />}
                      </div>
                    </button>

                    {expanded === item.id && (
                      <div className="px-3 pb-2 bg-slate-50/60 dark:bg-gray-800/40">
                        {loadingItems.has(item.id) ? (
                          <div className="flex justify-center py-3"><Spinner className="h-4 w-4" /></div>
                        ) : itemUnits.length === 0 ? (
                          <div className="text-xs text-slate-400 py-2">Nenhuma unidade disponível</div>
                        ) : (
                          <div className="space-y-1 pt-1">
                            {itemUnits.map((u) => (
                              <label key={u.id} className="flex items-center gap-2 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={form.checklist.unitIds.includes(u.id)}
                                  onChange={() => toggleUnit(u.id)}
                                  className="rounded"
                                />
                                <span className="text-xs text-slate-600 dark:text-gray-400 group-hover:text-slate-800 dark:group-hover:text-gray-200 transition">
                                  {u.tombo ? `Tombo: ${u.tombo}` : `Unidade #${u.id}`}
                                  {u.note && <span className="text-slate-400 ml-1">— {u.note}</span>}
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Step 3: Visita técnica prévia ─────────────────────────────────────────────
function Step3({ form, setForm, techs }) {
  const selected  = techs.filter((t) => form.preVisita.tecnicoIds.includes(t.id));
  const available = techs.filter((t) => !form.preVisita.tecnicoIds.includes(t.id));

  function toggleTech(id) {
    setForm((f) => {
      const ids = f.preVisita.tecnicoIds;
      return {
        ...f,
        preVisita: {
          ...f.preVisita,
          tecnicoIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
        },
      };
    });
  }

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          onClick={() => setForm((f) => ({ ...f, hasPreVisita: !f.hasPreVisita }))}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            form.hasPreVisita ? "bg-brand-600" : "bg-slate-200 dark:bg-gray-600"
          }`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            form.hasPreVisita ? "translate-x-5" : "translate-x-0"
          }`} />
        </div>
        <span className="text-sm font-medium text-slate-700 dark:text-gray-300">
          Incluir visita técnica prévia
        </span>
      </label>

      {form.hasPreVisita && (
        <div className="space-y-3 border-t border-slate-100 dark:border-gray-700/60 pt-3">
          <div>
            <label className="field-label">Local da visita *</label>
            <input
              type="text"
              value={form.preVisita.local}
              onChange={(e) => setForm((f) => ({ ...f, preVisita: { ...f.preVisita, local: e.target.value } }))}
              placeholder="Mesmo local ou diferente do evento..."
              className="field-input"
            />
          </div>

          <div>
            <label className="field-label">Data/hora da visita *</label>
            <DateTimeInput
              value={form.preVisita.startDateTime}
              onChange={(v) => setForm((f) => ({ ...f, preVisita: { ...f.preVisita, startDateTime: v } }))}
            />
          </div>

          <div>
            <label className="field-label">Técnicos da visita</label>
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selected.map((t) => (
                  <TechChip key={t.id} name={t.name} onRemove={() => toggleTech(t.id)} />
                ))}
              </div>
            )}
            {available.length > 0 && (
              <select
                defaultValue=""
                onChange={(e) => { if (e.target.value) { toggleTech(Number(e.target.value)); e.target.value = ""; } }}
                className="field-input text-sm"
              >
                <option value="">+ Adicionar técnico</option>
                {available.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>

          <div>
            <label className="field-label">Observações da visita</label>
            <textarea
              rows={2}
              value={form.preVisita.problema}
              onChange={(e) => setForm((f) => ({ ...f, preVisita: { ...f.preVisita, problema: e.target.value } }))}
              placeholder="O que será verificado na visita..."
              className="field-input resize-none text-sm"
            />
          </div>
        </div>
      )}

      {/* Resumo */}
      <div className="rounded-xl bg-slate-50 dark:bg-gray-800/60 border border-slate-200 dark:border-gray-700 p-4 space-y-2 text-xs">
        <div className="font-semibold text-slate-700 dark:text-gray-300 mb-1">Resumo da Ação</div>
        <div className="flex gap-2"><span className="text-slate-400 w-20 shrink-0">Evento</span><span className="text-slate-700 dark:text-gray-300 font-medium">{form.nomeEvento || "—"}</span></div>
        <div className="flex gap-2"><span className="text-slate-400 w-20 shrink-0">Local</span><span className="text-slate-700 dark:text-gray-300">{form.local || "—"}</span></div>
        <div className="flex gap-2"><span className="text-slate-400 w-20 shrink-0">Início</span><span className="text-slate-700 dark:text-gray-300">{form.startDateTime ? fmtDT(new Date(form.startDateTime)) : "—"}</span></div>
        <div className="flex gap-2"><span className="text-slate-400 w-20 shrink-0">Término</span><span className="text-slate-700 dark:text-gray-300">{form.endDateTime ? fmtDT(new Date(form.endDateTime)) : "—"}</span></div>
        {form.hasChecklist && (
          <div className="flex gap-2"><span className="text-slate-400 w-20 shrink-0">Materiais</span><span className="text-brand-600 dark:text-brand-400">{form.checklist.unitIds.length} unidade{form.checklist.unitIds.length !== 1 ? "s" : ""} selecionada{form.checklist.unitIds.length !== 1 ? "s" : ""}</span></div>
        )}
        {form.hasPreVisita && (
          <div className="flex gap-2"><span className="text-slate-400 w-20 shrink-0">Visita</span><span className="text-slate-700 dark:text-gray-300">{form.preVisita.startDateTime ? fmtDT(new Date(form.preVisita.startDateTime)) : "A definir"}</span></div>
        )}
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
const STEP_META = [
  { label: "Evento",    icon: Zap          },
  { label: "Materiais", icon: Package      },
  { label: "Visita",    icon: ClipboardList },
];

const EMPTY_FORM = {
  nomeEvento:   "",
  local:        "",
  startDateTime: "",
  endDateTime:  "",
  tecnicoIds:   [],
  problema:     "",
  hasChecklist: false,
  checklist: { title: "", nucleo: "NMT", note: "", unitIds: [] },
  hasPreVisita: false,
  preVisita: { local: "", startDateTime: "", tecnicoIds: [], problema: "" },
};

export default function AcaoFormModal({ onClose, onCreate }) {
  const [step, setStep]   = useState(1);
  const [form, setForm]   = useState(EMPTY_FORM);
  const [techs, setTechs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr]     = useState("");
  // tracks whether checklist title was manually edited by user
  const [checklistTitleEdited, setChecklistTitleEdited] = useState(false);

  useEffect(() => {
    api.get("/technicians").then((r) => setTechs(r.data)).catch(() => {});
  }, []);

  // Auto-fill checklist title from event name (unless user already edited it)
  useEffect(() => {
    if (!checklistTitleEdited && form.nomeEvento) {
      setForm((f) => ({ ...f, checklist: { ...f.checklist, title: f.nomeEvento } }));
    }
  }, [form.nomeEvento, checklistTitleEdited]);

  function canGoNext() {
    if (step === 1) {
      return form.nomeEvento.trim().length >= 2 &&
             form.local.trim().length >= 2 &&
             form.startDateTime && form.endDateTime;
    }
    if (step === 2 && form.hasChecklist) {
      return form.checklist.title.trim().length >= 2 &&
             form.checklist.unitIds.length > 0;
    }
    return true;
  }

  async function handleSubmit() {
    setSaving(true);
    setErr("");
    try {
      const toISO = (v) => v ? new Date(v).toISOString() : null;

      const payload = {
        tipo:          "ACAO",
        local:         form.local,
        problema:      form.problema || null,
        nomeEvento:    form.nomeEvento,
        startDateTime: toISO(form.startDateTime),
        endDateTime:   toISO(form.endDateTime),
        tecnicoIds:    form.tecnicoIds,
        checklist:     form.hasChecklist && form.checklist.unitIds.length > 0 ? {
          title:   form.checklist.title,
          nucleo:  form.checklist.nucleo,
          note:    form.checklist.note || null,
          unitIds: form.checklist.unitIds,
        } : null,
        preVisita: form.hasPreVisita && form.preVisita.local && form.preVisita.startDateTime ? {
          local:         form.preVisita.local,
          startDateTime: toISO(form.preVisita.startDateTime),
          tecnicoIds:    form.preVisita.tecnicoIds,
          problema:      form.preVisita.problema || null,
        } : null,
      };

      const res = await api.post("/work-orders", payload);
      onCreate(res.data);
    } catch (e) {
      setErr(e.response?.data?.error || "Erro ao criar Ação");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card w-full max-w-xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400">
              <Zap size={20} />
            </span>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-gray-100">Criar Ação</h3>
              <p className="text-xs text-slate-500 dark:text-gray-400">Evento com materiais e visita técnica</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 transition mt-0.5">
            <X size={18} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1">
          {STEP_META.map((s, i) => {
            const n = i + 1;
            const done = n < step;
            const active = n === step;
            const Icon = s.icon;
            return (
              <div key={n} className="flex items-center gap-1 flex-1">
                <div className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition ${
                  active ? "bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300" :
                  done   ? "text-emerald-600 dark:text-emerald-400" :
                           "text-slate-400 dark:text-gray-500"
                }`}>
                  {done ? <Check size={11} /> : <Icon size={11} />}
                  {s.label}
                </div>
                {i < STEP_META.length - 1 && (
                  <div className={`h-px flex-1 ${n < step ? "bg-brand-300 dark:bg-brand-700" : "bg-slate-200 dark:bg-gray-700"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        {step === 1 && <Step1 form={form} setForm={setForm} techs={techs} />}
        {step === 2 && <Step2 form={form} setForm={setForm} onChecklistTitleEdit={() => setChecklistTitleEdited(true)} />}
        {step === 3 && <Step3 form={form} setForm={setForm} techs={techs} />}

        {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-gray-700/60">
          <button
            type="button"
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="flex items-center gap-1.5 btn-secondary text-sm py-2 px-4"
          >
            <ChevronLeft size={14} />
            {step === 1 ? "Cancelar" : "Voltar"}
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={!canGoNext()}
              className="flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
            >
              Próximo <ChevronRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-semibold transition disabled:opacity-60"
            >
              {saving ? <Spinner className="h-4 w-4" /> : <Check size={14} />}
              Criar Ação
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
