import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Spinner } from "../components/ui";
import AppHeader from "../components/AppHeader";
import {
  ClipboardList, ArrowLeft, Download, CheckCircle, XCircle,
  Clock, AlertTriangle, User, Package, Trash2, FileText,
} from "lucide-react";

const NUCLEO_FULL = {
  NMT: "NMT – Núcleo de Mídias e Tecnologia",
  NIR: "NIR – Núcleo de Infraestrutura e Redes",
};

const STATUS_STYLE = {
  PENDENTE:  { cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",   icon: Clock,         label: "Pendente"  },
  APROVADO:  { cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", icon: CheckCircle, label: "Aprovado"  },
  REJEITADO: { cls: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",            icon: XCircle,       label: "Rejeitado" },
};

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ChecklistDetailPage() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const { user }     = useAuth();
  const { addToast } = useToast();

  const [checklist, setChecklist] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [acting,    setActing]     = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting,    setDeleting]    = useState(false);

  const isAdmin       = user?.role === "ADMIN";
  const isResponsavel = checklist && user?.nucleoResponsavel === checklist.nucleo;
  const canAct        = (isResponsavel || isAdmin) && checklist?.status === "PENDENTE";

  async function load() {
    setLoading(true);
    try {
      const res = await api.get(`/inventory/checklists/${id}`);
      setChecklist(res.data);
    } catch {
      addToast("Checklist não encontrado.", "error");
      navigate("/painel/inventario");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleApprove() {
    setActing(true);
    try {
      await api.post(`/inventory/checklists/${id}/approve`);
      addToast("Checklist aprovado! Estoque atualizado.", "success");
      load();
    } catch (e) {
      addToast(e.response?.data?.error || "Erro ao aprovar.", "error");
    } finally {
      setActing(false);
    }
  }

  async function handleReject() {
    setActing(true);
    try {
      await api.post(`/inventory/checklists/${id}/reject`, { note: rejectNote });
      addToast("Checklist rejeitado.", "success");
      setShowRejectModal(false);
      load();
    } catch (e) {
      addToast(e.response?.data?.error || "Erro ao rejeitar.", "error");
    } finally {
      setActing(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await api.get(`/inventory/checklists/${id}/docx`, { responseType: "blob" });
      const url  = URL.createObjectURL(res.data);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `Checklist_${checklist.title.replace(/\s+/g, "_")}_${id}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      addToast("Erro ao gerar documento.", "error");
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Excluir este checklist?")) return;
    setDeleting(true);
    try {
      await api.delete(`/inventory/checklists/${id}`);
      addToast("Checklist excluído.", "success");
      navigate("/painel/inventario");
    } catch (e) {
      addToast(e.response?.data?.error || "Erro ao excluir.", "error");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <AppHeader />
      <div className="flex items-center justify-center py-24"><Spinner /></div>
    </div>
  );

  if (!checklist) return null;

  const { cls: statusCls, icon: StatusIcon, label: statusLabel } = STATUS_STYLE[checklist.status];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <AppHeader />

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* Breadcrumb + actions */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Link to="/painel/inventario" className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-gray-400 hover:text-brand-600 transition">
            <ArrowLeft size={14} />
            Checklists
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition"
            >
              {downloading ? <Spinner size="sm" /> : <Download size={14} />}
              Baixar DOCX
            </button>
            {canAct && (
              <>
                <button
                  onClick={handleApprove}
                  disabled={acting}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition"
                >
                  {acting ? <Spinner size="sm" /> : <CheckCircle size={14} />}
                  Aprovar
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={acting}
                  className="flex items-center gap-1.5 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm px-3 py-1.5 rounded-lg transition"
                >
                  <XCircle size={14} />
                  Rejeitar
                </button>
              </>
            )}
            {isAdmin && checklist.status !== "APROVADO" && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm px-3 py-1.5 rounded-lg transition"
              >
                {deleting ? <Spinner size="sm" /> : <Trash2 size={14} />}
                Excluir
              </button>
            )}
          </div>
        </div>

        {/* Info card */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-900/20 shrink-0">
              <ClipboardList size={22} className="text-brand-600 dark:text-brand-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-800 dark:text-gray-100">{checklist.title}</h1>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCls}`}>
                  <StatusIcon size={11} />
                  {statusLabel}
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">{NUCLEO_FULL[checklist.nucleo]}</p>
              {checklist.note && <p className="text-sm text-slate-600 dark:text-gray-300 mt-1 italic">{checklist.note}</p>}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-slate-500 dark:text-gray-400 mb-0.5">Criado por</div>
              <div className="text-sm font-medium text-slate-700 dark:text-gray-200 flex items-center gap-1">
                <User size={12} className="text-slate-400" />
                {checklist.createdBy?.name || "—"}
              </div>
              <div className="text-xs text-slate-400 dark:text-gray-500">{fmtDate(checklist.createdAt)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-gray-400 mb-0.5">
                {checklist.status === "REJEITADO" ? "Rejeitado por" : "Autorizado por"}
              </div>
              <div className="text-sm font-medium text-slate-700 dark:text-gray-200 flex items-center gap-1">
                <User size={12} className="text-slate-400" />
                {checklist.approvedBy?.name || "—"}
              </div>
              {checklist.approvedAt && <div className="text-xs text-slate-400 dark:text-gray-500">{fmtDate(checklist.approvedAt)}</div>}
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-gray-400 mb-0.5">Total de itens</div>
              <div className="text-xl font-bold text-slate-800 dark:text-gray-100">{checklist.items.length}</div>
            </div>
            {checklist.rejectedNote && (
              <div className="col-span-2">
                <div className="text-xs text-slate-500 dark:text-gray-400 mb-0.5">Motivo da rejeição</div>
                <div className="text-sm text-red-600 dark:text-red-400">{checklist.rejectedNote}</div>
              </div>
            )}
          </div>

          {checklist.status === "PENDENTE" && !canAct && (
            <div className="mt-4 flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg p-3">
              <Clock size={15} className="text-amber-600 shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Aguardando autorização do responsável do núcleo <strong>{checklist.nucleo}</strong>.
              </p>
            </div>
          )}
        </div>

        {/* Items table */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700/60">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-200 flex items-center gap-2">
              <Package size={15} className="text-slate-400" />
              Itens do checklist
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-gray-700/60">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Item</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Código</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Qtd solicitada</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Estoque atual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-gray-700/40">
              {checklist.items.map((ci) => (
                <tr key={ci.id} className="hover:bg-slate-50 dark:hover:bg-gray-800/30">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-gray-100">{ci.item.name}</td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    {ci.item.code
                      ? <span className="font-mono text-xs bg-slate-100 dark:bg-gray-800 px-2 py-0.5 rounded">{ci.item.code}</span>
                      : <span className="text-slate-300 dark:text-gray-600 text-xs">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-brand-600 dark:text-brand-400">
                    {ci.quantity} <span className="text-xs font-normal text-slate-400">{ci.item.unitMeasure}</span>
                  </td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    <span className={`text-sm font-medium ${ci.item.quantity === 0 ? "text-amber-600" : "text-slate-600 dark:text-gray-300"}`}>
                      {ci.item.quantity} {ci.item.unitMeasure}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-gray-700 p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-800 dark:text-gray-100 flex items-center gap-2">
              <XCircle size={16} className="text-red-500" />
              Rejeitar checklist
            </h2>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">Motivo <span className="text-slate-400">(opcional)</span></label>
              <textarea
                className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                rows={3}
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Explique o motivo da rejeição..."
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowRejectModal(false)} className="flex-1 rounded-lg border border-slate-200 dark:border-gray-700 py-2 text-sm text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800 transition">
                Cancelar
              </button>
              <button
                onClick={handleReject}
                disabled={acting}
                className="flex-1 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 py-2 text-sm font-medium text-white transition flex items-center justify-center gap-1.5"
              >
                {acting ? <Spinner size="sm" /> : <XCircle size={14} />}
                Rejeitar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
