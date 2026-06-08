import { useEffect, useState } from "react";
import AppHeader from "../components/AppHeader";
import { api } from "../lib/api";
import { Spinner } from "../components/ui";
import { Save, RotateCcw, SlidersHorizontal } from "lucide-react";

const DEFAULTS = {
  HOME_ALERT_MESSAGE: "",
  FEEDBACK_ENABLED:  "false",
  EMERGENCY_CONTACT: "",
};

export default function SystemConfigPage() {
  const [flags,   setFlags]   = useState(null);
  const [draft,   setDraft]   = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [err,     setErr]     = useState("");

  useEffect(() => {
    api.get("/admin/config-flags").then((r) => {
      const merged = { ...DEFAULTS, ...r.data };
      setFlags(merged);
      setDraft(merged);
    });
  }, []);

  function set(key, value) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function save(e) {
    e.preventDefault();
    setErr("");
    setSaving(true);
    try {
      await api.put("/admin/config-flags", draft);
      setFlags({ ...draft });
      setSaved(true);
    } catch (ex) {
      setErr(ex.response?.data?.error || "Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setDraft({ ...flags });
    setSaved(false);
    setErr("");
  }

  const dirty = draft && flags && JSON.stringify(draft) !== JSON.stringify(flags);

  if (!draft) {
    return (
      <>
        <AppHeader />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Spinner className="h-8 w-8" />
        </div>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
            <SlidersHorizontal size={18} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-gray-100">Configurações do sistema</h1>
            <p className="text-sm text-slate-500 dark:text-gray-400">Alterações entram em vigor imediatamente, sem necessidade de redeploy.</p>
          </div>
        </div>

        <form onSubmit={save} className="space-y-5">

          {/* Aviso na home */}
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-200 uppercase tracking-wide">Comunicado</h2>

            <div className="space-y-1">
              <label className="field-label">Mensagem de aviso na página inicial</label>
              <textarea
                className="field-input resize-none"
                rows={3}
                value={draft.HOME_ALERT_MESSAGE}
                onChange={(e) => set("HOME_ALERT_MESSAGE", e.target.value)}
                placeholder="Deixe vazio para não exibir nenhum aviso."
                maxLength={500}
              />
              <p className="text-xs text-slate-400 dark:text-gray-500">
                Exibido como banner amarelo no topo da página inicial para todos os usuários. Deixe vazio para ocultar.
              </p>
            </div>
          </div>

          {/* Manual */}
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-200 uppercase tracking-wide">Manual do usuário</h2>

            <div className="space-y-1">
              <label className="field-label">Contato de emergência</label>
              <textarea
                className="field-input resize-none"
                rows={3}
                value={draft.EMERGENCY_CONTACT}
                onChange={(e) => set("EMERGENCY_CONTACT", e.target.value)}
                placeholder="Em caso de falha crítica que impossibilite o trabalho, entre em contato diretamente com a GTI pelo WhatsApp ou dirija-se pessoalmente à equipe de suporte."
                maxLength={500}
              />
              <p className="text-xs text-slate-400 dark:text-gray-500">
                Texto exibido no rodapé do manual do usuário. Deixe vazio para usar o padrão.
              </p>
            </div>
          </div>

          {/* Módulos */}
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-200 uppercase tracking-wide">Módulos</h2>

            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-gray-200">Avaliação de atendimento (feedback)</p>
                <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
                  Permite que o solicitante avalie o atendimento após a conclusão do chamado.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={draft.FEEDBACK_ENABLED === "true"}
                onClick={() => set("FEEDBACK_ENABLED", draft.FEEDBACK_ENABLED === "true" ? "false" : "true")}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  draft.FEEDBACK_ENABLED === "true"
                    ? "bg-brand-600"
                    : "bg-slate-200 dark:bg-gray-700"
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  draft.FEEDBACK_ENABLED === "true" ? "translate-x-6" : "translate-x-1"
                }`} />
              </button>
            </label>
          </div>

          {/* Erro */}
          {err && (
            <p className="text-sm text-red-600 dark:text-red-400">{err}</p>
          )}

          {/* Ações */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={reset}
              disabled={!dirty || saving}
              className="btn-secondary gap-2 disabled:opacity-40"
            >
              <RotateCcw size={15} />
              Descartar
            </button>

            <button
              type="submit"
              disabled={!dirty || saving}
              className="btn-primary gap-2 disabled:opacity-40"
            >
              {saving ? <Spinner className="h-4 w-4" /> : <Save size={15} />}
              {saved && !dirty ? "Salvo" : "Salvar alterações"}
            </button>
          </div>

        </form>
      </main>
    </>
  );
}
