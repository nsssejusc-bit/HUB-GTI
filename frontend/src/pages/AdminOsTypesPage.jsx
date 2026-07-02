import { useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";
import { Spinner } from "../components/ui";
import AppHeader from "../components/AppHeader";
import {
  ClipboardList, Plus, Edit2, Trash2, ChevronUp, ChevronDown,
  Check, X, AlertTriangle, GripVertical, Settings2,
} from "lucide-react";

const FIELD_TYPES = [
  { value: "text",        label: "Texto curto"     },
  { value: "textarea",    label: "Texto longo"     },
  { value: "number",      label: "Número"          },
  { value: "date",        label: "Data"            },
  { value: "datetime",    label: "Data e hora"     },
  { value: "select",      label: "Lista de opções" },
  { value: "multiselect", label: "Múltipla escolha"},
  { value: "checkbox",    label: "Sim / Não"       },
];

const PRESET_COLORS = [
  "#6366f1","#0ea5e9","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6","#f97316","#64748b",
];

function labelToKey(label) {
  return label
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "")
    || "campo";
}

// ── Editor de um único campo ──────────────────────────────────────────────────
function FieldEditor({ field, index, total, onChange, onRemove, onMoveUp, onMoveDown,
                       onDragStart, onDragOver, onDrop, onDragEnd, isDragging, isDropTarget }) {
  const [expanded, setExpanded] = useState(false);
  const [newOpt,   setNewOpt]   = useState("");

  function set(k, v) { onChange({ ...field, [k]: v }); }

  function addOption() {
    const t = newOpt.trim();
    if (!t) return;
    set("options", [...(field.options || []), t]);
    setNewOpt("");
  }

  function removeOption(i) {
    set("options", field.options.filter((_, idx) => idx !== i));
  }

  return (
    <div
      className={`border rounded-xl overflow-hidden transition-all ${
        isDragging    ? "opacity-40 scale-[0.98] border-slate-200 dark:border-gray-700" :
        isDropTarget  ? "border-brand-400 dark:border-brand-500 ring-2 ring-brand-300 dark:ring-brand-700 ring-offset-1 dark:ring-offset-gray-900" :
                        "border-slate-200 dark:border-gray-700"
      }`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Row header — draggable */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-gray-900 cursor-grab active:cursor-grabbing"
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <GripVertical size={14} className="text-slate-400 dark:text-gray-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-slate-700 dark:text-gray-300">{field.label || <span className="text-slate-400 italic">sem label</span>}</span>
          <span className="ml-2 text-xs text-slate-400 dark:text-gray-500">{FIELD_TYPES.find(t => t.value === field.type)?.label}</span>
          {field.required && <span className="ml-2 text-[10px] font-medium bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded px-1 py-0.5">obrigatório</span>}
        </div>
        <div className="flex items-center gap-1 shrink-0" onDragStart={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => onMoveUp(index)}   disabled={index === 0}          className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-gray-200 disabled:opacity-30 transition cursor-default"><ChevronUp   size={14} /></button>
          <button type="button" onClick={() => onMoveDown(index)} disabled={index === total - 1}  className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-gray-200 disabled:opacity-30 transition cursor-default"><ChevronDown size={14} /></button>
          <button type="button" onClick={() => setExpanded(e => !e)} className="p-1 rounded text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition cursor-default"><Edit2 size={13} /></button>
          <button type="button" onClick={() => onRemove(index)}   className="p-1 rounded text-slate-400 hover:text-red-500 transition cursor-default"><Trash2 size={13} /></button>
        </div>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 bg-slate-50 dark:bg-gray-800/60 space-y-2.5 border-t border-slate-100 dark:border-gray-700/60">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="field-label">Label *</label>
              <input type="text" value={field.label} onChange={(e) => {
                const lbl = e.target.value;
                onChange({ ...field, label: lbl, key: field._keyEdited ? field.key : labelToKey(lbl) });
              }} className="field-input text-sm" />
            </div>
            <div>
              <label className="field-label">Chave (key)</label>
              <input type="text" value={field.key}
                onChange={(e) => onChange({ ...field, key: e.target.value.replace(/[^a-zA-Z0-9_]/g, ""), _keyEdited: true })}
                className="field-input text-sm font-mono" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">Tipo</label>
              <select value={field.type} onChange={(e) => set("type", e.target.value)} className="field-input text-sm">
                {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" id={`req-${index}`} checked={!!field.required} onChange={(e) => set("required", e.target.checked)} className="h-4 w-4 rounded" />
              <label htmlFor={`req-${index}`} className="text-sm text-slate-700 dark:text-gray-300">Obrigatório</label>
            </div>
          </div>
          {(field.type === "select" || field.type === "multiselect") && (
            <div>
              <label className="field-label">Opções</label>
              <div className="space-y-1 mb-2">
                {(field.options || []).map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="flex-1 text-sm text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-900 rounded-lg px-2 py-1 border border-slate-200 dark:border-gray-700">{opt}</span>
                    <button type="button" onClick={() => removeOption(i)} className="text-slate-400 hover:text-red-500 transition"><X size={13} /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" value={newOpt} onChange={(e) => setNewOpt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(); } }}
                  placeholder="Nova opção..." className="field-input text-sm flex-1" />
                <button onClick={addOption} type="button"
                  className="inline-flex items-center gap-1 rounded-xl border border-brand-300 dark:border-brand-700 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 px-3 py-1.5 text-xs font-semibold transition">
                  <Plus size={12} /> Add
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Modal criar/editar tipo ───────────────────────────────────────────────────
function TypeModal({ existing, onClose, onSaved }) {
  const isEdit = !!existing;
  const [name,    setName]    = useState(existing?.name    ?? "");
  const [color,   setColor]   = useState(existing?.color   ?? "#6366f1");
  const [active,  setActive]  = useState(existing?.active  ?? true);
  const [fields,  setFields]  = useState(() => (existing?.fields ?? []).map((f, i) => ({ ...f, _keyEdited: true, _uid: String(i) })));
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState("");
  const [dragIdx, setDragIdx] = useState(null);
  const [dropIdx, setDropIdx] = useState(null);

  function handleDrop(dropIndex) {
    if (dragIdx === null || dragIdx === dropIndex) { setDragIdx(null); setDropIdx(null); return; }
    setFields(f => {
      const arr = [...f];
      const [removed] = arr.splice(dragIdx, 1);
      arr.splice(dropIndex, 0, removed);
      return arr;
    });
    setDragIdx(null);
    setDropIdx(null);
  }

  function addField() {
    setFields(f => [...f, { key: `campo_${f.length + 1}`, label: "", type: "text", required: false, _keyEdited: false, _uid: Math.random().toString(36).slice(2) }]);
  }

  function updateField(i, val)  { setFields(f => f.map((x, idx) => idx === i ? val : x)); }
  function removeField(i)       { setFields(f => f.filter((_, idx) => idx !== i)); }
  function moveField(i, dir)    {
    setFields(f => {
      const arr = [...f];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setErr("");
    const cleanFields = fields.map(({ _keyEdited, _uid, ...f }) => f);
    const keys = cleanFields.map(f => f.key);
    if (new Set(keys).size !== keys.length) { setErr("Chaves de campo duplicadas"); setSaving(false); return; }
    try {
      const payload = { name: name.trim(), color, active, fields: cleanFields };
      const res = isEdit
        ? await api.patch(`/work-order-types/${existing.id}`, payload)
        : await api.post("/work-order-types", payload);
      onSaved(res.data);
    } catch (ex) {
      setErr(ex.response?.data?.error || "Erro ao salvar");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card w-full max-w-2xl p-6 space-y-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: color + "22", color }}>
            <Settings2 size={20} />
          </span>
          <h3 className="font-semibold text-slate-900 dark:text-gray-100">
            {isEdit ? "Editar tipo de OS" : "Novo tipo de OS"}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome + cor + ativo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="field-label">Nome *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                required placeholder="Ex: Visita técnica" className="field-input" />
            </div>
            <div>
              <label className="field-label">Cor</label>
              <div className="flex items-center gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setColor(c)}
                      className={`h-6 w-6 rounded-full transition border-2 ${color === c ? "border-slate-700 dark:border-gray-200 scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
                  className="h-7 w-7 rounded cursor-pointer border border-slate-200 dark:border-gray-700 bg-transparent" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="tipo-active" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 rounded" />
            <label htmlFor="tipo-active" className="text-sm text-slate-700 dark:text-gray-300">Tipo ativo (disponível para criação de OS)</label>
          </div>

          {/* Campos dinâmicos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="field-label mb-0">Campos do formulário</label>
              <button type="button" onClick={addField}
                className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium">
                <Plus size={12} /> Adicionar campo
              </button>
            </div>

            {fields.length === 0 && (
              <p className="text-sm text-slate-400 dark:text-gray-500 italic py-2">
                Nenhum campo. Clique em "Adicionar campo" para definir os campos do formulário desta OS.
              </p>
            )}

            <div className="space-y-2">
              {fields.map((field, i) => (
                <FieldEditor
                  key={field._uid}
                  field={field}
                  index={i}
                  total={fields.length}
                  onChange={(val) => updateField(i, val)}
                  onRemove={removeField}
                  onMoveUp={(idx)   => moveField(idx, -1)}
                  onMoveDown={(idx) => moveField(idx, +1)}
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={(e) => { e.preventDefault(); setDropIdx(i); }}
                  onDrop={() => handleDrop(i)}
                  onDragEnd={() => { setDragIdx(null); setDropIdx(null); }}
                  isDragging={dragIdx === i}
                  isDropTarget={dropIdx === i && dragIdx !== i}
                />
              ))}
            </div>
          </div>

          {err && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertTriangle size={14} /> {err}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="btn-secondary text-sm py-2 px-4">Cancelar</button>
            <button type="submit" disabled={saving || !name.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-semibold transition disabled:opacity-60">
              {saving ? <Spinner className="h-4 w-4" /> : <Check size={14} />}
              {isEdit ? "Salvar alterações" : "Criar tipo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function AdminOsTypesPage() {
  const [types,   setTypes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null); // null | "create" | existing type object
  const [deleting, setDeleting] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [err,     setErr]     = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/work-order-types?includeInactive=true");
      setTypes(res.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(type) {
    try {
      const res = await api.patch(`/work-order-types/${type.id}`, { active: !type.active });
      setTypes(prev => prev.map(t => t.id === type.id ? res.data : t));
    } catch (ex) { setErr(ex.response?.data?.error || "Erro"); }
  }

  async function move(index, dir) {
    const arr = [...types];
    const j   = index + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[index], arr[j]] = [arr[j], arr[index]];
    const order = arr.map((t, i) => ({ id: t.id, sortOrder: i }));
    setTypes(arr);
    try {
      await api.patch("/work-order-types/reorder", { order });
    } catch { load(); }
  }

  async function deleteType(type) {
    setDeleting(type.id);
    try {
      await api.delete(`/work-order-types/${type.id}`);
      setTypes(prev => prev.filter(t => t.id !== type.id));
    } catch (ex) {
      setErr(ex.response?.data?.error || "Erro ao excluir");
    } finally { setDeleting(null); }
  }

  function handleSaved(updated) {
    setTypes(prev => {
      const exists = prev.find(t => t.id === updated.id);
      return exists
        ? prev.map(t => t.id === updated.id ? updated : t)
        : [...prev, updated];
    });
    setModal(null);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <AppHeader />

      <main className="max-w-4xl mx-auto p-4 md:p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 size={20} className="text-brand-600" />
            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-gray-100">Tipos de OS</h1>
              <p className="text-xs text-slate-500 dark:text-gray-400">Defina os tipos de Ordens de Serviço e seus campos de formulário</p>
            </div>
          </div>
          <button
            onClick={() => setModal("create")}
            className="flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-3.5 py-2 text-sm font-semibold transition"
          >
            <Plus size={15} /> Novo tipo
          </button>
        </div>

        {err && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            <AlertTriangle size={15} /> {err}
            <button onClick={() => setErr("")} className="ml-auto"><X size={14} /></button>
          </div>
        )}

        {loading && <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>}

        {!loading && types.length === 0 && (
          <div className="card p-14 text-center">
            <ClipboardList size={44} className="mx-auto text-slate-300 dark:text-gray-700 mb-4" />
            <div className="font-semibold text-slate-700 dark:text-gray-300">Nenhum tipo cadastrado</div>
            <button onClick={() => setModal("create")} className="mt-3 text-brand-600 dark:text-brand-400 hover:underline text-sm font-medium">
              Criar primeiro tipo
            </button>
          </div>
        )}

        {!loading && types.length > 0 && (
          <div className="card divide-y divide-slate-100 dark:divide-gray-700/60">
            {types.map((type, index) => (
              <div key={type.id} className="flex items-center gap-3 px-4 py-4">
                {/* Cor + nome */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => move(index, -1)} disabled={index === 0}
                      className="p-0.5 text-slate-300 dark:text-gray-600 hover:text-slate-600 dark:hover:text-gray-300 disabled:opacity-20 transition">
                      <ChevronUp size={14} />
                    </button>
                    <button onClick={() => move(index, 1)} disabled={index === types.length - 1}
                      className="p-0.5 text-slate-300 dark:text-gray-600 hover:text-slate-600 dark:hover:text-gray-300 disabled:opacity-20 transition">
                      <ChevronDown size={14} />
                    </button>
                  </div>
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: type.color }} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800 dark:text-gray-100">{type.name}</span>
                      {!type.active && (
                        <span className="text-[10px] font-medium bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 rounded px-1.5 py-0.5">inativo</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
                      {type.fields?.length ?? 0} campo{(type.fields?.length ?? 0) !== 1 ? "s" : ""}
                      {type.fields?.length > 0 && (
                        <span className="ml-1">
                          ({type.fields.slice(0, 3).map(f => f.label).join(", ")}{type.fields.length > 3 ? "..." : ""})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleActive(type)}
                    title={type.active ? "Desativar" : "Ativar"}
                    className={`text-xs rounded-full px-2.5 py-1 font-medium transition border ${
                      type.active
                        ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
                        : "bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 border-slate-200 dark:border-gray-700 hover:bg-slate-200"
                    }`}
                  >
                    {type.active ? "Ativo" : "Inativo"}
                  </button>
                  <button
                    onClick={() => setModal(type)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800 px-2.5 py-1.5 text-xs font-medium transition"
                  >
                    <Edit2 size={12} /> Editar
                  </button>
                  {deleteConfirm === type.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-gray-400">Confirmar?</span>
                      <button
                        onClick={() => { setDeleteConfirm(null); deleteType(type); }}
                        disabled={deleting === type.id}
                        className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline disabled:opacity-60"
                      >
                        {deleting === type.id ? <Spinner className="h-3 w-3 inline" /> : "Sim"}
                      </button>
                      <button onClick={() => setDeleteConfirm(null)} className="text-xs text-slate-400 dark:text-gray-500 hover:underline">Não</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(type.id)}
                      className="flex items-center gap-1 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 px-2.5 py-1.5 text-xs font-medium transition"
                    >
                      <Trash2 size={12} /> Excluir
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {modal && (
        <TypeModal
          existing={modal === "create" ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
