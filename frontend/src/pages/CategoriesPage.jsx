import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "../lib/api";
import AppHeader from "../components/AppHeader";
import { Spinner, Alert } from "../components/ui";
import { useToast } from "../context/ToastContext";
import {
  GripVertical, ChevronDown, Plus, Trash2, Pencil, Check, X,
  Monitor, Wifi, KeyRound, HelpCircle, MonitorSmartphone, Printer, Server, BookOpen,
  Tag, ToggleLeft, ToggleRight, Clock, Flame, Lightbulb, ShieldCheck, AlignLeft,
  Eye, Layout, GripHorizontal,
} from "lucide-react";

// ── Constantes ────────────────────────────────────────────────────────────────
const NUCLEO_OPTIONS = [
  { value: "NMT", label: "NMT" },
  { value: "NIR", label: "NIR" },
  { value: "NSS", label: "NSS" },
];

const PRIORITY_OPTIONS = [
  { value: "LOW",    label: "Baixa",   cls: "bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300",  active: "bg-slate-500 text-white" },
  { value: "MEDIUM", label: "Média",   cls: "bg-blue-50   dark:bg-blue-900/30 text-blue-600 dark:text-blue-300",  active: "bg-blue-500  text-white" },
  { value: "HIGH",   label: "Alta",    cls: "bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300", active: "bg-orange-500 text-white" },
  { value: "URGENT", label: "Urgente", cls: "bg-red-50    dark:bg-red-900/30 text-red-600 dark:text-red-300",    active: "bg-red-500   text-white" },
];

const FORM_TYPE_OPTIONS = [
  { value: "",               label: "Sem formulário extra" },
  { value: "freetext",       label: "Texto livre" },
  { value: "custom",         label: "Campos personalizados" },
  { value: "whatsapp_print", label: "Envio de arquivo via WhatsApp (impressão)" },
];

const FORM_TYPE_LABELS = {
  ...Object.fromEntries(FORM_TYPE_OPTIONS.filter(o => o.value).map(o => [o.value, o.label])),
  // legados (não aparecem no select mas ainda existem em subcategorias antigas)
  printer:            "Impressora — identificação + bloco",
  printer_counter:    "Impressora — com contador de páginas",
  net_user_create:    "Rede — criar usuário",
  net_user_delete:    "Rede — excluir usuário",
  net_password_reset: "Rede — resetar senha",
  siged_user_create:  "SIGED — criar usuário",
  siged_sector_move:  "SIGED — mover setor",
  siged_user_delete:  "SIGED — excluir usuário",
};

const CUSTOM_FIELD_TYPES = [
  { value: "text",     label: "Texto" },
  { value: "textarea", label: "Parágrafo" },
  { value: "number",   label: "Número" },
  { value: "select",   label: "Lista de opções" },
];

const CAT_ICONS = {
  HARDWARE:  Monitor,
  NETWORK:   Wifi,
  NETSERVER: Server,
  ACCESS:    KeyRound,
  REMOTE:    MonitorSmartphone,
  PRINTER:   Printer,
  SIGED:     BookOpen,
  OTHER:     HelpCircle,
};

const CAT_COLORS = {
  HARDWARE:  "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
  NETWORK:   "bg-blue-100   dark:bg-blue-900/30   text-blue-600   dark:text-blue-400",
  NETSERVER: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400",
  ACCESS:    "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400",
  REMOTE:    "bg-cyan-100   dark:bg-cyan-900/30   text-cyan-600   dark:text-cyan-400",
  PRINTER:   "bg-green-100  dark:bg-green-900/30  text-green-600  dark:text-green-400",
  SIGED:     "bg-amber-100  dark:bg-amber-900/30  text-amber-600  dark:text-amber-400",
  OTHER:     "bg-slate-100  dark:bg-gray-800      text-slate-500  dark:text-gray-400",
};

function getCatIcon(code) { return CAT_ICONS[code] || Tag; }
function getCatColor(code) { return CAT_COLORS[code] || CAT_COLORS.OTHER; }

// ── Drag-to-reorder ───────────────────────────────────────────────────────────
function useDragReorder(items, onReorder) {
  const [drag, setDrag]   = useState(null);
  const dragRef  = useRef(null);
  const itemsRef = useRef(items);
  const listRef  = useRef(null);

  useEffect(() => { itemsRef.current = items; }, [items]);

  function startDrag(e, idx) {
    e.preventDefault();
    const container = listRef.current;
    if (!container) return;
    const itemEl = [...container.children][idx];
    if (!itemEl) return;
    const rect    = itemEl.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const clone   = itemEl.cloneNode(true);
    clone.style.cssText = [
      `position:fixed`, `left:${rect.left}px`, `top:${rect.top}px`,
      `width:${rect.width}px`, `margin:0`, `z-index:9999`, `pointer-events:none`,
      `opacity:0.93`, `transform:scale(1.025) rotate(0.5deg)`,
      `box-shadow:0 24px 48px -8px rgba(0,0,0,0.35),0 12px 24px -6px rgba(0,0,0,0.2)`,
      `transition:none`,
    ].join(';');
    document.body.appendChild(clone);
    dragRef.current = { fromIdx: idx, overIdx: idx };
    setDrag({ fromIdx: idx, overIdx: idx });
    function computeOver(clientY) {
      const children = [...container.children];
      let over = 0, bestDist = Infinity;
      children.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const dist = Math.abs(clientY - (r.top + r.height / 2));
        if (dist < bestDist) { bestDist = dist; over = i; }
      });
      return over;
    }
    function onMove(ev) {
      clone.style.top = (ev.clientY - offsetY) + 'px';
      const over = computeOver(ev.clientY);
      if (over !== dragRef.current?.overIdx) {
        dragRef.current = { ...dragRef.current, overIdx: over };
        setDrag({ ...dragRef.current });
      }
    }
    function onUp() {
      document.body.removeChild(clone);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const { fromIdx, overIdx } = dragRef.current || {};
      dragRef.current = null;
      setDrag(null);
      if (fromIdx != null && overIdx != null && fromIdx !== overIdx && onReorder) {
        const next = [...itemsRef.current];
        const [moved] = next.splice(fromIdx, 1);
        next.splice(overIdx, 0, moved);
        onReorder(next);
      }
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  return { listRef, startDrag, fromIdx: drag?.fromIdx ?? null, overIdx: drag?.overIdx ?? null };
}

// ── Inline name editor ────────────────────────────────────────────────────────
function InlineName({ value, onSave, className = "" }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value);
  const inputRef = useRef(null);

  function start(e) { e.stopPropagation(); setDraft(value); setEditing(true); }
  function cancel()  { setEditing(false); }
  function confirm() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    setEditing(false);
  }

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  if (editing) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") confirm(); if (e.key === "Escape") cancel(); }}
          className="field-input py-1 text-sm min-w-0 w-40"
          maxLength={80}
        />
        <button onClick={confirm} className="flex h-7 w-7 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition"><Check size={14} /></button>
        <button onClick={cancel}  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-700 transition"><X size={14} /></button>
      </div>
    );
  }
  return (
    <button onClick={start} className={`group flex items-center gap-1.5 text-left ${className}`} title="Clique para editar">
      <span>{value}</span>
      <Pencil size={12} className="opacity-0 group-hover:opacity-60 transition text-slate-400 shrink-0" />
    </button>
  );
}

function DropLine({ show }) {
  if (!show) return null;
  return <div className="h-0.5 rounded-full bg-brand-500 mx-1" />;
}

// ── Toggle row ────────────────────────────────────────────────────────────────
function ToggleRow({ label, description, checked, onChange, indent = false }) {
  return (
    <label className={`flex items-start gap-3 cursor-pointer rounded-xl border px-3 py-2.5 transition hover:bg-slate-50 dark:hover:bg-gray-800/50 ${
      checked ? "border-brand-200 dark:border-brand-700 bg-brand-50/50 dark:bg-brand-900/10" : "border-slate-200 dark:border-gray-700"
    } ${indent ? "ml-6" : ""}`}>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-brand-600" : "bg-slate-200 dark:bg-gray-600"}`}>
        <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </div>
      <div>
        <div className="text-sm font-medium text-slate-700 dark:text-gray-200">{label}</div>
        {description && <div className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">{description}</div>}
      </div>
    </label>
  );
}

// ── Custom field row (construtor de campos) ───────────────────────────────────
function CustomFieldRow({ field, onChange, onRemove }) {
  const [optionsText, setOptionsText] = useState((field.options || []).join("\n"));

  function slugify(str) {
    return str.toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
      || `campo_${Date.now()}`;
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-gray-700 p-3 space-y-2.5 bg-white dark:bg-gray-900">
      <div className="flex items-center gap-2">
        <GripHorizontal size={13} className="text-slate-300 shrink-0" />
        <input
          className="field-input flex-1 text-sm py-1.5"
          placeholder="Label do campo *"
          value={field.label}
          onChange={(e) => {
            const label = e.target.value;
            onChange({ ...field, label, key: slugify(label) });
          }}
        />
        <select
          className="field-input w-36 text-sm py-1.5 shrink-0"
          value={field.type}
          onChange={(e) => {
            setOptionsText("");
            onChange({ ...field, type: e.target.value, options: [] });
          }}
        >
          {CUSTOM_FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-gray-300 cursor-pointer shrink-0 select-none">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => onChange({ ...field, required: e.target.checked })}
            className="accent-brand-600 rounded"
          />
          Obrig.
        </label>
        <button
          onClick={onRemove}
          className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
        >
          <X size={12} />
        </button>
      </div>
      {field.type === "select" && (
        <div>
          <label className="field-label text-[10px]">Opções (uma por linha)</label>
          <textarea
            rows={3}
            className="field-input text-xs resize-none"
            placeholder={"Opção 1\nOpção 2\nOpção 3"}
            value={optionsText}
            onChange={(e) => {
              const raw = e.target.value;
              setOptionsText(raw);
              const opts = raw.split("\n").map(s => s.trim()).filter(Boolean);
              onChange({ ...field, options: opts });
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── Modal de edição completa de subcategoria ──────────────────────────────────
function SubEditModal({ sub, catId, onClose, onUpdate }) {
  const addToast = useToast();
  const [name,                  setName]                  = useState(sub.name);
  const [slaHours,              setSlaHours]              = useState(sub.slaHours != null ? String(sub.slaHours) : "");
  const [priority,              setPriority]              = useState(sub.defaultPriority ?? "MEDIUM");
  const [nucleo,                setNucleo]                = useState(sub.nucleoResponsavel ?? "");
  const [requiresApproval,      setRequiresApproval]      = useState(sub.requiresApproval ?? false);
  const [dualApproval,          setDualApproval]          = useState(sub.dualApproval ?? false);
  const [requiresPresential,    setRequiresPresential]    = useState(sub.requiresPresential ?? true);
  const [requiresCauseSolution, setRequiresCauseSolution] = useState(sub.requiresCauseSolution ?? true);
  const [allowsFreeText,        setAllowsFreeText]        = useState(sub.allowsFreeText ?? false);
  const [freeTextLabel,         setFreeTextLabel]         = useState(sub.freeTextLabel ?? "");
  const [formTypeVal,           setFormTypeVal]           = useState(sub.formType ?? "");
  const [customFieldsList,      setCustomFieldsList]      = useState(() => {
    try {
      const parsed = sub.customFields ? JSON.parse(sub.customFields) : [];
      // garante id estável para cada campo (evita remount ao digitar label)
      return parsed.map((f, i) => ({ id: f.id || `cf_${Date.now()}_${i}`, ...f }));
    } catch { return []; }
  });
  const [n1Tips,   setN1Tips]   = useState(sub.n1Tips ? JSON.parse(sub.n1Tips).join("\n") : "");
  const [saving,   setSaving]   = useState(false);

  function addCustomField() {
    const ts = Date.now();
    setCustomFieldsList(prev => [...prev, { id: `cf_${ts}`, key: `campo_${ts}`, label: "", type: "text", required: false, options: [] }]);
  }

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) { addToast({ message: "Nome obrigatório", type: "error" }); return; }
    if (formTypeVal === "custom" && customFieldsList.some(f => !f.label.trim())) {
      addToast({ message: "Todos os campos personalizados precisam de um label", type: "error" }); return;
    }
    setSaving(true);
    try {
      const slaVal  = slaHours ? parseInt(slaHours, 10) : null;
      const lines   = n1Tips.split("\n").map((s) => s.trim()).filter(Boolean);
      const n1Json  = lines.length > 0 ? JSON.stringify(lines) : null;
      const cfJson  = (formTypeVal === "custom" && customFieldsList.length > 0)
        ? JSON.stringify(customFieldsList) : null;

      const res = await api.patch(`/categories/${catId}/subcategories/${sub.id}`, {
        name: trimmedName, slaHours: slaVal, defaultPriority: priority,
        nucleoResponsavel: nucleo || null,
        requiresApproval, dualApproval, requiresPresential, requiresCauseSolution,
        allowsFreeText,
        freeTextLabel: formTypeVal === "whatsapp_print"
          ? (freeTextLabel.replace(/\D/g, "") || null)
          : (allowsFreeText ? freeTextLabel.trim() || null : null),
        formType: formTypeVal || null, customFields: cfJson,
        n1Tips: n1Json,
      });
      onUpdate(res.data);
      addToast({ message: "Subcategoria salva", type: "success" });
      onClose();
    } catch (e) {
      addToast({ message: e.response?.data?.error || "Erro ao salvar", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-gray-100">Editar subcategoria</h3>
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">{sub.name}</p>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-700 transition"><X size={14} /></button>
        </div>

        {/* Nome */}
        <div>
          <label className="field-label">Nome *</label>
          <input autoFocus className="field-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} onKeyDown={(e) => e.key === "Enter" && handleSave()} />
        </div>

        {/* Prioridade + Núcleo + SLA */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">Prioridade padrão</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {PRIORITY_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setPriority(opt.value)}
                  className={`rounded-full border text-[11px] font-semibold transition px-2 py-0.5 ${priority === opt.value ? `${opt.active} border-transparent` : `${opt.cls} border-transparent hover:opacity-80`}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="field-label">Núcleo responsável</label>
              <select className="field-input" value={nucleo} onChange={(e) => setNucleo(e.target.value)}>
                <option value="">Sem núcleo definido</option>
                {NUCLEO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">SLA (horas)</label>
              <input type="number" min="1" max="9999" className="field-input" placeholder="Ex: 24" value={slaHours} onChange={(e) => setSlaHours(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Comportamento */}
        <div>
          <p className="text-[11px] font-semibold text-slate-400 dark:text-gray-500 uppercase tracking-wide mb-2">Comportamento</p>
          <div className="space-y-2">
            <ToggleRow label="Requer aprovação do Chefe de Setor" description="Chamado fica em PENDENTE até aprovação antes de avançar" checked={requiresApproval} onChange={(v) => { setRequiresApproval(v); if (!v) setDualApproval(false); }} />
            {requiresApproval && <ToggleRow label="Aprovação dupla" description="Exige dois chefes de setor diferentes" checked={dualApproval} onChange={setDualApproval} indent />}
            <ToggleRow label="Atendimento presencial" description="Habilita transição EN_ROUTE (técnico se desloca ao local)" checked={requiresPresential} onChange={setRequiresPresential} />
            <ToggleRow label="Obrigar Causa e Solução ao concluir" description="Técnico precisa preencher Causa e Solução antes de fechar" checked={requiresCauseSolution} onChange={setRequiresCauseSolution} />
            {formTypeVal !== "whatsapp_print" && (
              <>
                <ToggleRow label="Campo de texto livre complementar" description="Textarea extra no formulário, abaixo do formulário principal" checked={allowsFreeText} onChange={setAllowsFreeText} />
                {allowsFreeText && (
                  <div className="ml-6 space-y-1">
                    <label className="field-label text-[11px]">Label do campo <span className="font-normal text-slate-400">(opcional)</span></label>
                    <input className="field-input text-sm py-1.5" placeholder='Ex: "Descreva o equipamento com defeito"' value={freeTextLabel} onChange={(e) => setFreeTextLabel(e.target.value)} maxLength={100} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Formulário extra */}
        <div>
          <p className="text-[11px] font-semibold text-slate-400 dark:text-gray-500 uppercase tracking-wide mb-2">Formulário extra</p>
          <div className="space-y-3">
            <div>
              <label className="field-label">Tipo de formulário</label>
              <select className="field-input" value={formTypeVal} onChange={(e) => { setFormTypeVal(e.target.value); if (e.target.value !== "custom") setCustomFieldsList([]); }}>
                {FORM_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-1">
                Define os campos exibidos no formulário de chamado ao selecionar esta subcategoria.
              </p>
            </div>

            {formTypeVal === "whatsapp_print" && (
              <div>
                <label className="field-label">Número WhatsApp da GTI *</label>
                <input
                  className="field-input"
                  placeholder="Ex: 559281234567 (DDI+DDD+número, sem espaços)"
                  value={freeTextLabel}
                  onChange={(e) => setFreeTextLabel(e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                />
                <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-1">
                  Formato internacional sem "+" — ex: <strong>559281234567</strong>. O solicitante verá um botão para abrir direto no WhatsApp.
                </p>
              </div>
            )}

            {formTypeVal === "custom" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-600 dark:text-gray-300">Campos personalizados</p>
                  <button onClick={addCustomField}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/40 transition font-medium">
                    <Plus size={11} /> Adicionar campo
                  </button>
                </div>
                {customFieldsList.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-gray-500 italic text-center py-3 border border-dashed border-slate-200 dark:border-gray-700 rounded-xl">
                    Nenhum campo. Clique em "Adicionar campo".
                  </p>
                ) : (
                  <div className="space-y-2">
                    {customFieldsList.map((field, idx) => (
                      <CustomFieldRow
                        key={field.id}
                        field={field}
                        onChange={(updated) => setCustomFieldsList(prev => prev.map((f, i) => i === idx ? updated : f))}
                        onRemove={() => setCustomFieldsList(prev => prev.filter((_, i) => i !== idx))}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Dicas N1 */}
        <div>
          <label className="field-label flex items-center gap-1.5">
            <Lightbulb size={12} className="text-amber-500" />
            Dicas N1 <span className="font-normal text-slate-400 dark:text-gray-500">(uma por linha)</span>
          </label>
          <textarea rows={3} className="field-input resize-none text-sm"
            placeholder={"Ex:\nReinicie o computador e tente novamente\nVerifique se o cabo está conectado"}
            value={n1Tips} onChange={(e) => setN1Tips(e.target.value)} />
          <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-1">
            Cada linha vira uma dica numerada exibida ao solicitante antes de abrir o chamado.
          </p>
        </div>

        <div className="flex gap-2 justify-end pt-1 border-t border-slate-100 dark:border-gray-700">
          <button type="button" onClick={onClose} className="btn-secondary text-sm py-2 px-4">Cancelar</button>
          <button type="button" onClick={handleSave} disabled={saving || !name.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-semibold transition disabled:opacity-60">
            {saving ? <Spinner className="h-4 w-4" /> : <Check size={14} />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Dicas N1 simplificado (para preview) ─────────────────────────────────────
function N1TipsPreview({ tips, title }) {
  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/15 px-3 py-2.5 space-y-1.5 mb-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
        <Lightbulb size={12} /> Antes de continuar — {title}
      </div>
      <ul className="space-y-1">
        {tips.map((tip, i) => (
          <li key={i} className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
            <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full bg-amber-200 dark:bg-amber-800/60 text-amber-700 dark:text-amber-300 font-bold flex items-center justify-center text-[10px]">{i + 1}</span>
            {tip}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Modal de preview ──────────────────────────────────────────────────────────
function CategoryPreviewModal({ cat, onClose }) {
  const [selectedSubId, setSelectedSubId] = useState(null);
  const selectedSub = cat.subcategories?.find(s => s.id === selectedSubId);
  const catN1Tips   = cat.n1Tips ? (() => { try { return JSON.parse(cat.n1Tips); } catch { return []; } })() : [];
  const subN1Tips   = selectedSub?.n1Tips ? (() => { try { return JSON.parse(selectedSub.n1Tips); } catch { return []; } })() : [];
  const subFormType = selectedSub?.formType || null;
  const customFields = (subFormType === "custom" && selectedSub?.customFields)
    ? (() => { try { return JSON.parse(selectedSub.customFields); } catch { return []; } })()
    : [];

  function renderFormPreview() {
    if (!selectedSub) return null;
    if (selectedSub.allowsFreeText && !subFormType) {
      return (
        <div className="rounded-xl border border-slate-200 dark:border-gray-700 p-3 mt-2 space-y-1">
          <label className="field-label text-xs">{selectedSub.freeTextLabel || "Descreva a solicitação"} *</label>
          <div className="field-input bg-slate-50 dark:bg-gray-800 text-slate-400 dark:text-gray-500 text-xs italic min-h-[60px] flex items-start pt-1.5">
            Descreva com o máximo de detalhes...
          </div>
        </div>
      );
    }
    if (subFormType === "freetext") {
      return (
        <div className="rounded-xl border border-slate-200 dark:border-gray-700 p-3 mt-2 space-y-1">
          <label className="field-label text-xs">Descreva a solicitação *</label>
          <div className="field-input bg-slate-50 dark:bg-gray-800 text-slate-400 dark:text-gray-500 text-xs italic min-h-[60px] flex items-start pt-1.5">
            Descreva com o máximo de detalhes...
          </div>
        </div>
      );
    }
    if (subFormType === "custom" && customFields.length > 0) {
      return (
        <div className="rounded-xl border border-slate-200 dark:border-gray-700 p-3 mt-2 space-y-2">
          {customFields.map(f => (
            <div key={f.key}>
              <label className="field-label text-xs">{f.label} {f.required && <span className="text-red-500">*</span>}</label>
              {f.type === "select" ? (
                <div className="field-input bg-slate-50 dark:bg-gray-800 text-slate-400 dark:text-gray-500 text-xs italic">
                  Selecione: {(f.options || []).join(", ") || "sem opções"}
                </div>
              ) : f.type === "textarea" ? (
                <div className="field-input bg-slate-50 dark:bg-gray-800 text-slate-400 dark:text-gray-500 text-xs italic min-h-[50px]">
                  Texto longo...
                </div>
              ) : (
                <div className="field-input bg-slate-50 dark:bg-gray-800 text-slate-400 dark:text-gray-500 text-xs italic">
                  {f.type === "number" ? "Ex: 123" : "Texto..."}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }
    if (subFormType && !["none"].includes(subFormType)) {
      return (
        <div className="rounded-xl border border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 p-3 mt-2">
          <p className="text-xs text-slate-500 dark:text-gray-400">
            Formulário: <span className="font-medium text-slate-700 dark:text-gray-200">{FORM_TYPE_LABELS[subFormType] || subFormType}</span>
          </p>
          <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-1">Formulário predefinido do sistema</p>
        </div>
      );
    }
    return null;
  }

  const CatIcon = getCatIcon(cat.code);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card w-full max-w-lg max-h-[85vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Eye size={15} className="text-brand-500 dark:text-brand-400" />
            <span className="font-semibold text-sm text-slate-800 dark:text-gray-100">Preview — visão do solicitante</span>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-700 transition"><X size={14} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Banner de contexto */}
          <div className="rounded-xl border border-brand-200 dark:border-brand-700/60 bg-brand-50 dark:bg-brand-900/10 px-3 py-2 flex items-center gap-2">
            <Layout size={13} className="text-brand-500 shrink-0" />
            <p className="text-xs text-brand-700 dark:text-brand-300">Simulação da tela "Detalhes" do formulário de chamado</p>
          </div>

          {/* Tela simulada */}
          <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-gray-700 p-4 space-y-3">
            {/* Dicas N1 da categoria (só para freeText) */}
            {cat.allowsFreeText && catN1Tips.length > 0 && (
              <N1TipsPreview tips={catN1Tips} title={cat.name} />
            )}

            {/* Header da tela */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${getCatColor(cat.code)}`}>
                  <CatIcon size={14} />
                </span>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-gray-100">{cat.name}</h3>
              </div>
              <p className="text-xs text-slate-400 dark:text-gray-500">
                {cat.allowsFreeText ? "Descreva o problema com detalhes" : "Selecione a opção que mais se encaixa"}
              </p>
            </div>

            {/* Texto livre (categoria) */}
            {cat.allowsFreeText && (
              <div className="space-y-1">
                <label className="field-label text-xs">Descrição do problema</label>
                <div className="field-input bg-slate-50 dark:bg-gray-800 text-slate-400 dark:text-gray-500 text-xs italic min-h-[80px] flex items-start pt-1.5">
                  Descreva o problema com o máximo de detalhes possível...
                </div>
              </div>
            )}

            {/* Subcategorias */}
            {!cat.allowsFreeText && (
              <div className="space-y-1.5">
                {(cat.subcategories || []).length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-3">Nenhuma subcategoria cadastrada</p>
                ) : (cat.subcategories || []).map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => setSelectedSubId(sub.id === selectedSubId ? null : sub.id)}
                    className={`w-full flex items-center gap-3 rounded-xl border cursor-pointer p-3 text-left transition ${
                      sub.id === selectedSubId
                        ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 ring-1 ring-brand-500/30"
                        : "border-slate-200 dark:border-gray-700 hover:border-slate-300 dark:hover:border-gray-600 hover:bg-slate-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <div className={`h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center ${
                      sub.id === selectedSubId ? "border-brand-600 bg-brand-600" : "border-slate-300 dark:border-gray-600"
                    }`}>
                      {sub.id === selectedSubId && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-slate-700 dark:text-gray-200">{sub.name}</span>
                      {sub.requiresApproval && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-700">
                          <ShieldCheck size={9} /> Requer aprovação
                        </span>
                      )}
                    </div>
                    {/* Badges de info da sub */}
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                      {sub.slaHours && <span>{sub.slaHours}h</span>}
                      {(sub.formType || sub.allowsFreeText) && <AlignLeft size={10} className="text-blue-400" />}
                    </div>
                  </button>
                ))}

                {/* Detalhe da subcategoria selecionada */}
                {selectedSub && (
                  <div className="space-y-1 pt-1">
                    {subN1Tips.length > 0 && <N1TipsPreview tips={subN1Tips} title={selectedSub.name} />}
                    {renderFormPreview()}
                    {selectedSub.allowsFreeText && (selectedSub.formType && selectedSub.formType !== "freetext") && (
                      <div className="rounded-xl border border-slate-200 dark:border-gray-700 p-3 mt-1 space-y-1">
                        <label className="field-label text-xs">{selectedSub.freeTextLabel || "Descreva a solicitação"} (complementar)</label>
                        <div className="field-input bg-slate-50 dark:bg-gray-800 text-slate-400 text-xs italic min-h-[50px]">
                          Textarea complementar...
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="text-[10px] text-slate-400 dark:text-gray-500 text-center">
            Clique em uma subcategoria para ver o formulário que aparecerá ao solicitante
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Subcategory row ───────────────────────────────────────────────────────────
function SubRow({ sub, catId, onDelete, onUpdate, onGripPointerDown, isDragging }) {
  const addToast  = useToast();
  const [editOpen,  setEditOpen]  = useState(false);
  const [deleteErr, setDeleteErr] = useState("");

  async function handleDelete() {
    setDeleteErr("");
    try {
      await api.delete(`/categories/${catId}/subcategories/${sub.id}`);
      onDelete(sub.id);
    } catch (e) {
      setDeleteErr(e.response?.data?.error || "Erro ao excluir");
    }
  }

  const priorityOpt = PRIORITY_OPTIONS.find((p) => p.value === (sub.defaultPriority ?? "MEDIUM"));
  const tipsCount   = sub.n1Tips ? JSON.parse(sub.n1Tips).length : 0;
  const hasForm     = sub.formType || sub.allowsFreeText;

  return (
    <div className="flex flex-col" style={isDragging ? { opacity: 0.3 } : undefined}>
      <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-gray-800/60 hover:bg-slate-100 dark:hover:bg-gray-800 transition group">
        <GripVertical
          size={14}
          className="text-slate-300 dark:text-gray-600 shrink-0 cursor-grab active:cursor-grabbing select-none"
          onPointerDown={onGripPointerDown}
          style={{ touchAction: "none" }}
        />

        <span className="flex-1 text-sm text-slate-700 dark:text-gray-200 font-medium truncate">{sub.name}</span>

        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition">
          {sub.nucleoResponsavel && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 border border-brand-200 dark:border-brand-700">
              {sub.nucleoResponsavel}
            </span>
          )}
          {sub.slaHours && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300">
              {sub.slaHours}h
            </span>
          )}
          {priorityOpt && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${priorityOpt.cls}`}>{priorityOpt.label}</span>
          )}
          {sub.requiresApproval && (
            <ShieldCheck size={12} className="text-amber-500 dark:text-amber-400" title={sub.dualApproval ? "Aprovação dupla" : "Requer aprovação"} />
          )}
          {hasForm && (
            <AlignLeft size={12} className="text-blue-500 dark:text-blue-400" title={sub.formType ? `Formulário: ${FORM_TYPE_LABELS[sub.formType] || sub.formType}` : "Campo livre"} />
          )}
          {tipsCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400" title={`${tipsCount} dica(s) N1`}>
              <Lightbulb size={11} />{tipsCount}
            </span>
          )}
        </div>

        <button onClick={() => setEditOpen(true)}
          className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-300 dark:text-gray-600 hover:text-brand-500 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition opacity-0 group-hover:opacity-100"
          title="Editar subcategoria">
          <Pencil size={12} />
        </button>
        <button onClick={handleDelete}
          className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition opacity-0 group-hover:opacity-100"
          title="Excluir subcategoria">
          <Trash2 size={12} />
        </button>
      </div>

      {deleteErr && <p className="text-xs text-red-500 dark:text-red-400 mt-1 px-3">{deleteErr}</p>}

      {editOpen && (
        <SubEditModal
          sub={sub}
          catId={catId}
          onClose={() => setEditOpen(false)}
          onUpdate={(updated) => { onUpdate(updated); setEditOpen(false); }}
        />
      )}
    </div>
  );
}

// ── Category card ─────────────────────────────────────────────────────────────
function CategoryCard({ cat, onUpdate, onDelete, onGripPointerDown, isDragging }) {
  const addToast = useToast();
  const [open,       setOpen]      = useState(false);
  const [newSub,     setNewSub]    = useState("");
  const [addingErr,  setAddingErr] = useState("");
  const [deleteErr,  setDeleteErr] = useState("");
  const [savingSub,  setSavingSub] = useState(false);
  const [subcats,    setSubcats]   = useState(cat.subcategories || []);
  const [slaDraft,   setSlaDraft]  = useState(cat.slaHours != null ? String(cat.slaHours) : "");
  const [slaEditing, setSlaEditing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => { setSubcats(cat.subcategories || []); }, [cat.subcategories]);

  const { listRef: subListRef, startDrag: startSubDrag, fromIdx: subFromIdx, overIdx: subOverIdx } =
    useDragReorder(subcats, (next) => {
      setSubcats(next);
      api.patch(`/categories/${cat.id}/subcategories/reorder`, { ids: next.map((s) => s.id) })
        .catch(() => addToast({ message: "Erro ao salvar ordem", type: "error" }));
    });

  const Icon = getCatIcon(cat.code);

  async function renameCategory(name) {
    try {
      const res = await api.patch(`/categories/${cat.id}`, { name });
      onUpdate({ ...cat, name: res.data.name });
      addToast({ message: "Categoria renomeada", type: "success" });
    } catch (e) {
      addToast({ message: e.response?.data?.error || "Erro ao renomear", type: "error" });
    }
  }

  async function saveSlaHours() {
    setSlaEditing(false);
    const val = slaDraft.trim();
    const parsed = val === "" ? null : Number(val);
    if (val !== "" && (isNaN(parsed) || parsed <= 0)) {
      addToast({ message: "SLA inválido", type: "error" });
      setSlaDraft(cat.slaHours != null ? String(cat.slaHours) : "");
      return;
    }
    if (parsed === cat.slaHours) return;
    try {
      const res = await api.patch(`/categories/${cat.id}`, { slaHours: parsed });
      onUpdate({ ...cat, slaHours: res.data.slaHours });
      addToast({ message: parsed ? `SLA definido: ${parsed}h` : "SLA removido", type: "success" });
    } catch (e) {
      addToast({ message: e.response?.data?.error || "Erro ao salvar SLA", type: "error" });
    }
  }

  async function toggleFreeText() {
    try {
      const res = await api.patch(`/categories/${cat.id}`, { allowsFreeText: !cat.allowsFreeText });
      onUpdate({ ...cat, allowsFreeText: res.data.allowsFreeText });
    } catch (e) {
      addToast({ message: "Erro ao atualizar", type: "error" });
    }
  }

  async function handleDeleteCat() {
    setDeleteErr("");
    try {
      await api.delete(`/categories/${cat.id}`);
      onDelete(cat.id);
    } catch (e) {
      setDeleteErr(e.response?.data?.error || "Erro ao excluir");
    }
  }

  async function addSubcategory() {
    const name = newSub.trim();
    if (!name) return;
    setAddingErr(""); setSavingSub(true);
    try {
      const res = await api.post(`/categories/${cat.id}/subcategories`, { name });
      setSubcats((prev) => [...prev, res.data]);
      setNewSub("");
    } catch (e) {
      setAddingErr(e.response?.data?.error || "Erro ao adicionar");
    } finally {
      setSavingSub(false);
    }
  }

  function updateSubcat(updatedSub) {
    setSubcats((prev) => prev.map((s) => s.id === updatedSub.id ? updatedSub : s));
  }

  function deleteSubcat(subId) {
    setSubcats((prev) => prev.filter((s) => s.id !== subId));
  }

  async function saveCategoryPriority(defaultPriority) {
    try {
      const res = await api.patch(`/categories/${cat.id}`, { defaultPriority });
      onUpdate({ ...cat, defaultPriority: res.data.defaultPriority });
      addToast({ message: "Prioridade padrão atualizada", type: "success" });
    } catch (e) {
      addToast({ message: e.response?.data?.error || "Erro ao salvar prioridade", type: "error" });
    }
  }

  // Cat com subcats atualizado para o preview
  const catForPreview = { ...cat, subcategories: subcats };

  return (
    <>
      <div className={`card transition-opacity duration-150 ${isDragging ? "opacity-30" : "opacity-100"}`}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none" onClick={() => setOpen((v) => !v)}>
          <GripVertical
            size={16} className="text-slate-300 dark:text-gray-600 shrink-0 cursor-grab active:cursor-grabbing"
            style={{ touchAction: "none" }}
            onPointerDown={(e) => { e.stopPropagation(); onGripPointerDown(e); }}
            onClick={(e) => e.stopPropagation()}
          />

          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${getCatColor(cat.code)}`}>
            <Icon size={18} />
          </span>

          <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap" onClick={(e) => e.stopPropagation()}>
            <InlineName value={cat.name} onSave={renameCategory} className="font-semibold text-slate-800 dark:text-gray-100" />
            <button onClick={toggleFreeText}
              title={cat.allowsFreeText ? "Texto livre — clique para usar subcategorias" : "Subcategorias — clique para texto livre"}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                cat.allowsFreeText ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" : "bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-400"
              }`}>
              {cat.allowsFreeText ? <><ToggleRight size={13} /> Texto livre</> : <><ToggleLeft size={13} /> Subcategorias</>}
            </button>
            {!cat.allowsFreeText && (
              <span className="text-xs text-slate-400 dark:text-gray-500">
                {subcats.length} {subcats.length !== 1 ? "subcategorias" : "subcategoria"}
              </span>
            )}
          </div>

          {/* Preview button */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowPreview(true); }}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg text-slate-400 dark:text-gray-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition shrink-0"
            title="Visualizar como o solicitante vê"
          >
            <Eye size={13} /> Preview
          </button>

          <button onClick={(e) => { e.stopPropagation(); handleDeleteCat(); }}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition shrink-0"
            title="Excluir categoria">
            <Trash2 size={14} />
          </button>

          <ChevronDown size={16} className={`text-slate-400 dark:text-gray-500 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </div>

        {deleteErr && <p className="px-5 pb-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10">{deleteErr}</p>}

        {/* Expanded body */}
        {open && (
          <div className="border-t border-slate-100 dark:border-gray-700/60 px-5 py-4 space-y-4">
            {/* SLA */}
            <div className="flex items-center gap-3">
              <Clock size={14} className="text-slate-400 dark:text-gray-500 shrink-0" />
              <span className="text-sm text-slate-500 dark:text-gray-400 w-20 shrink-0">SLA (horas)</span>
              {slaEditing ? (
                <input autoFocus type="number" min="1" value={slaDraft}
                  onChange={(e) => setSlaDraft(e.target.value)} onBlur={saveSlaHours}
                  onKeyDown={(e) => { if (e.key === "Enter") saveSlaHours(); if (e.key === "Escape") { setSlaEditing(false); setSlaDraft(cat.slaHours != null ? String(cat.slaHours) : ""); } }}
                  placeholder="Ex: 24" className="field-input py-1 text-sm w-24" />
              ) : (
                <button onClick={() => setSlaEditing(true)}
                  className="group flex items-center gap-1.5 text-sm text-slate-700 dark:text-gray-200 rounded-lg px-2 py-1 hover:bg-slate-100 dark:hover:bg-gray-800 transition">
                  {cat.slaHours ? <span className="font-medium">{cat.slaHours}h</span> : <span className="text-slate-400 dark:text-gray-500 italic">Sem prazo</span>}
                  <Pencil size={11} className="opacity-0 group-hover:opacity-60 transition text-slate-400" />
                </button>
              )}
            </div>

            {cat.allowsFreeText && (
              <div className="flex items-center gap-3">
                <Flame size={14} className="text-slate-400 dark:text-gray-500 shrink-0" />
                <span className="text-sm text-slate-500 dark:text-gray-400 w-20 shrink-0">Prioridade</span>
                <div className="flex flex-wrap gap-1">
                  {PRIORITY_OPTIONS.map((opt) => (
                    <button key={opt.value} type="button"
                      onClick={async () => {
                        try {
                          const res = await api.patch(`/categories/${cat.id}`, { defaultPriority: opt.value });
                          onUpdate({ ...cat, defaultPriority: res.data.defaultPriority });
                          addToast({ message: "Prioridade padrão atualizada", type: "success" });
                        } catch (e) { addToast({ message: "Erro ao salvar", type: "error" }); }
                      }}
                      className={`rounded-full border text-[11px] font-semibold transition px-2 py-0.5 ${
                        (cat.defaultPriority ?? "MEDIUM") === opt.value ? `${opt.active} border-transparent` : `${opt.cls} border-transparent hover:opacity-80`
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {cat.allowsFreeText ? (
              <p className="text-sm text-slate-400 dark:text-gray-500 italic">
                O usuário descreve o problema livremente — nenhuma subcategoria é exibida.
              </p>
            ) : (
              <>
                {subcats.length === 0 ? (
                  <p className="text-sm text-slate-400 dark:text-gray-500 border border-dashed border-slate-200 dark:border-gray-700 rounded-xl py-4 text-center">
                    Nenhuma subcategoria. Adicione abaixo.
                  </p>
                ) : (
                  <div ref={subListRef} className="space-y-1.5">
                    {subcats.map((sub, idx) => (
                      <div key={sub.id}>
                        <DropLine show={subFromIdx !== null && subOverIdx === idx && subFromIdx > idx} />
                        <SubRow
                          sub={sub} catId={cat.id}
                          onDelete={deleteSubcat} onUpdate={updateSubcat}
                          isDragging={subFromIdx === idx}
                          onGripPointerDown={(e) => { e.stopPropagation(); startSubDrag(e, idx); }}
                        />
                        <DropLine show={subFromIdx !== null && subOverIdx === idx && subFromIdx < idx} />
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <input
                    className="field-input flex-1 text-sm py-2" placeholder="Nova subcategoria..."
                    value={newSub} onChange={(e) => setNewSub(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addSubcategory()} maxLength={80}
                  />
                  <button onClick={addSubcategory} disabled={!newSub.trim() || savingSub}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 text-slate-700 dark:text-gray-200 text-sm font-medium transition disabled:opacity-40 shrink-0">
                    {savingSub ? <Spinner className="h-4 w-4" /> : <><Plus size={14} /> Adicionar</>}
                  </button>
                </div>
                {addingErr && <p className="text-xs text-red-500 dark:text-red-400">{addingErr}</p>}
              </>
            )}
          </div>
        )}
      </div>

      {showPreview && (
        <CategoryPreviewModal cat={catForPreview} onClose={() => setShowPreview(false)} />
      )}
    </>
  );
}

// ── New Category Modal ────────────────────────────────────────────────────────
function NewCategoryModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [allowsFreeText, setAllowsFreeText] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(""); setSaving(true);
    try {
      const res = await api.post("/categories", { name: name.trim(), allowsFreeText });
      onCreate(res.data);
    } catch (e) {
      setErr(e.response?.data?.error || "Erro ao criar categoria");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400">
            <Tag size={20} />
          </span>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-gray-100">Nova categoria</h3>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Será exibida no formulário de chamado</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="field-label">Nome *</label>
            <input autoFocus required className="field-input" placeholder="Ex: Periféricos" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </div>
          <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-slate-200 dark:border-gray-700 px-4 py-3 hover:bg-slate-50 dark:hover:bg-gray-800 transition">
            <input type="checkbox" checked={allowsFreeText} onChange={(e) => setAllowsFreeText(e.target.checked)} className="rounded accent-brand-600" />
            <div>
              <div className="text-sm font-medium text-slate-700 dark:text-gray-200">Texto livre</div>
              <div className="text-xs text-slate-400 dark:text-gray-500">Usuário descreve em vez de escolher subcategoria</div>
            </div>
          </label>
          {err && <Alert message={err} />}
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="btn-secondary text-sm py-2 px-4">Cancelar</button>
            <button type="submit" disabled={saving || !name.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-semibold transition disabled:opacity-60">
              {saving ? <Spinner className="h-4 w-4" /> : <Plus size={14} />} Criar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CategoriesPage() {
  const addToast = useToast();
  const [categories, setCategories] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showNew,    setShowNew]    = useState(false);

  const { listRef: catListRef, startDrag: startCatDrag, fromIdx: catFromIdx, overIdx: catOverIdx } =
    useDragReorder(categories, (next) => {
      setCategories(next);
      api.patch("/categories/reorder", { ids: next.map((c) => c.id) })
        .catch(() => addToast({ message: "Erro ao salvar ordem", type: "error" }));
    });

  const load = useCallback(async () => {
    try {
      const res = await api.get("/categories");
      setCategories(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleUpdate(updated) {
    setCategories((prev) => prev.map((c) => c.id === updated.id ? { ...c, ...updated } : c));
  }
  function handleDelete(catId) {
    setCategories((prev) => prev.filter((c) => c.id !== catId));
    addToast({ message: "Categoria excluída", type: "success" });
  }
  function handleCreate(cat) {
    setCategories((prev) => [...prev, { ...cat, subcategories: cat.subcategories || [] }]);
    setShowNew(false);
    addToast({ message: "Categoria criada", type: "success" });
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <AppHeader />
      <main className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-gray-100">Categorias de chamado</h1>
            <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">
              Arraste para reordenar · lápis para editar subcategoria · <Eye size={12} className="inline" /> para preview
            </p>
          </div>
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-3.5 py-2 text-sm font-semibold transition">
            <Plus size={15} /> Nova categoria
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Spinner className="h-8 w-8" /></div>
        ) : categories.length === 0 ? (
          <div className="card p-12 text-center">
            <Tag size={32} className="mx-auto text-slate-300 dark:text-gray-600 mb-3" />
            <div className="font-medium text-slate-600 dark:text-gray-400">Nenhuma categoria cadastrada</div>
            <p className="text-sm text-slate-400 dark:text-gray-500 mt-1">Crie a primeira categoria de chamado</p>
          </div>
        ) : (
          <div ref={catListRef} className="space-y-2">
            {categories.map((cat, idx) => (
              <div key={cat.id}>
                <DropLine show={catFromIdx !== null && catOverIdx === idx && catFromIdx > idx} />
                <CategoryCard cat={cat} onUpdate={handleUpdate} onDelete={handleDelete}
                  onGripPointerDown={(e) => startCatDrag(e, idx)} isDragging={catFromIdx === idx} />
                <DropLine show={catFromIdx !== null && catOverIdx === idx && catFromIdx < idx} />
              </div>
            ))}
          </div>
        )}
      </main>
      {showNew && <NewCategoryModal onClose={() => setShowNew(false)} onCreate={handleCreate} />}
    </div>
  );
}
