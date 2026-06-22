import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { STATUS_ORDER, STATUS_LABEL, statusIndex, formatElapsed, formatRelative } from "../lib/statuses";
import { useServerTick, serverNow } from "../lib/serverTime";
import { StatusBadge, InfoItem, Spinner } from "../components/ui";
import { isImageMessage } from "../lib/messages";
import {
  Home, Clock, CheckCircle2, Circle, Star, MonitorSmartphone, Wifi,
  Shield, ShieldCheck, ShieldX, MessageSquare, Send, UserCheck,
  ImageIcon, X, Copy, Check,
} from "lucide-react";

const STATUS_DESC = {
  OPEN:       "Chamado registrado, aguardando análise",
  VIEWED:     "Técnico visualizou e atribuiu responsável",
  EN_ROUTE:   "Técnico a caminho do seu departamento",
  IN_SERVICE: "Atendimento em andamento",
  COMPLETED:  "Problema resolvido",
  CANCELADO:  "Chamado cancelado pelo Chefe de Setor",
};

const PRIORITY_LABEL = { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta", URGENT: "Urgente" };
const PRIORITY_COLOR  = {
  LOW:    "bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-400",
  MEDIUM: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  HIGH:   "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  URGENT: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-semibold",
};

// Retorna 1-2 iniciais de um nome completo
function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function TrackPage() {
  const { ticketNumber } = useParams();
  const [ticket,       setTicket]       = useState(null);
  const [error,        setError]        = useState("");
  useServerTick(60000);
  const [config,       setConfig]       = useState({ feedbackEnabled: false });
  const [messages,     setMessages]     = useState([]);
  const [replyText,    setReplyText]    = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replyErr,     setReplyErr]     = useState("");
  const [lightbox,     setLightbox]     = useState(null);
  const [copied,       setCopied]       = useState(false);
  const [lastUpdated,  setLastUpdated]  = useState(null);
  const [hasNewMsg,    setHasNewMsg]    = useState(false);
  const imgInputRef      = useRef(null);
  const msgEndRef        = useRef(null);
  const prevMsgCountRef  = useRef(0);
  const scrollFlagRef    = useRef(true);

  const COUNTER_SUBCATEGORY_CODES = ["PRINTER_NO_PAPER", "PRINTER_TONER"];
  const isCounterTicket = COUNTER_SUBCATEGORY_CODES.includes(ticket?.subcategoryCode);
  const techMessages = messages.filter((m) => !m.fromUser);
  const canReply = ticket?.status !== "CANCELADO" && (isCounterTicket || techMessages.length > 0);

  useEffect(() => {
    api.get("/config").then((r) => setConfig(r.data));
    load();
    loadMessages();
    const t  = setInterval(load, 30000);
    const tm = setInterval(loadMessages, 15000); // poll mais rápido
    return () => { clearInterval(t); clearInterval(tm); };
  }, [ticketNumber]);

  // Rola para o fim apenas quando há mensagens novas (não em cada poll)
  useEffect(() => {
    if (!scrollFlagRef.current) return;
    scrollFlagRef.current = false;
    msgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function load() {
    try {
      const { data } = await api.get(`/tickets/track/${ticketNumber}`);
      setTicket(data);
    } catch (e) {
      setError(e.response?.data?.error || "Chamado não encontrado");
    }
  }

  async function loadMessages() {
    try {
      const { data } = await api.get(`/tickets/track/${ticketNumber}/messages`);
      const prevCount = prevMsgCountRef.current;
      prevMsgCountRef.current = data.length;
      setMessages(data);
      setLastUpdated(new Date());
      // Detecta nova mensagem do técnico chegando durante poll
      if (data.length > prevCount && prevCount > 0) {
        scrollFlagRef.current = true;
        setHasNewMsg(true);
        setTimeout(() => setHasNewMsg(false), 5000);
      }
    } catch (_) {}
  }

  function copyTicketNumber() {
    navigator.clipboard.writeText(ticket.ticketNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function sendReply() {
    if (!replyText.trim()) return;
    setReplySending(true);
    setReplyErr("");
    try {
      const { data } = await api.post(`/tickets/track/${ticketNumber}/messages`, { content: replyText });
      scrollFlagRef.current = true;
      setMessages((prev) => [...prev, data]);
      setReplyText("");
    } catch (e) {
      setReplyErr(e.response?.data?.error || "Erro ao enviar resposta");
    } finally {
      setReplySending(false);
    }
  }

  function handlePaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) { setReplyErr("Imagem muito grande. Máximo 3 MB."); return; }
        const reader = new FileReader();
        reader.onload = async (ev) => {
          setReplySending(true); setReplyErr("");
          try {
            const { data } = await api.post(`/tickets/track/${ticketNumber}/messages`, { content: ev.target.result });
            scrollFlagRef.current = true;
            setMessages((prev) => [...prev, data]);
          } catch (err) {
            setReplyErr(err.response?.data?.error || "Erro ao enviar imagem");
          } finally { setReplySending(false); }
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  }

  function handleImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setReplyErr("Imagem muito grande. Máximo 3 MB.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      setReplySending(true);
      setReplyErr("");
      try {
        const { data } = await api.post(`/tickets/track/${ticketNumber}/messages`, { content: ev.target.result });
        scrollFlagRef.current = true;
        setMessages((prev) => [...prev, data]);
      } catch (err) {
        setReplyErr(err.response?.data?.error || "Erro ao enviar imagem");
      } finally {
        setReplySending(false);
        e.target.value = "";
      }
    };
    reader.readAsDataURL(file);
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-950 p-6">
        <div className="card p-8 text-center max-w-sm w-full">
          <div className="text-4xl mb-3">🔍</div>
          <div className="font-semibold text-slate-800 dark:text-gray-100 mb-1">Chamado não encontrado</div>
          <p className="text-sm text-slate-500 dark:text-gray-400 mb-5">{error}</p>
          <Link to="/" className="btn-primary w-full justify-center">
            <Home size={16} /> Voltar ao início
          </Link>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-950">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const currentIdx    = statusIndex(ticket.status);
  const needsApproval = ticket.approvalStatus && ticket.approvalStatus !== "NOT_REQUIRED";
  const isRejected    = ticket.approvalStatus === "REJECTED";

  const visibleStatuses = STATUS_ORDER.filter(
    (s) => (s !== "EN_ROUTE" || ticket.presential) &&
           (s !== "CANCELADO" || ticket.status === "CANCELADO")
  );

  const timestamps = {
    OPEN:       ticket.openedAt,
    VIEWED:     ticket.viewedAt,
    EN_ROUTE:   ticket.enRouteAt,
    IN_SERVICE: ticket.inServiceAt,
    COMPLETED:  ticket.completedAt,
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      {/* Topbar */}
      <header className="bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-gray-700 px-4 h-14 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200 transition">
          <Home size={15} />
          Início
        </Link>
        <div className="h-4 w-px bg-slate-200 dark:bg-gray-700" />
        <span className="text-sm font-mono text-slate-600 dark:text-gray-300">{ticket.ticketNumber}</span>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

          {/* ── Coluna principal ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Status hero */}
            <div className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500 dark:text-gray-400 mb-1">Protocolo</div>
                  <div className="flex items-center gap-2">
                    <div className="text-xl font-bold text-slate-900 dark:text-gray-100 font-mono tracking-wide">
                      {ticket.ticketNumber}
                    </div>
                    {/* Botão copiar protocolo */}
                    <button
                      onClick={copyTicketNumber}
                      title="Copiar protocolo"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition"
                    >
                      {copied
                        ? <Check size={14} className="text-emerald-500" />
                        : <Copy size={14} />}
                    </button>
                  </div>
                </div>
                <div className="text-right space-y-1.5">
                  <StatusBadge status={ticket.status} />
                  {/* Badge de prioridade */}
                  {ticket.priority && (
                    <div className="flex justify-end">
                      <span className={`text-xs rounded-full px-2 py-0.5 ${PRIORITY_COLOR[ticket.priority] || ""}`}>
                        Prioridade {PRIORITY_LABEL[ticket.priority] || ticket.priority}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-gray-400 justify-end">
                    <Clock size={11} />
                    {formatElapsed(ticket.openedAt, ticket.completedAt, ticket.completedAt ? null : serverNow())}
                  </div>
                  {ticket.status === "COMPLETED" && ticket.completedAt && (
                    <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 justify-end">
                      <CheckCircle2 size={11} />
                      Concluído há {formatElapsed(ticket.completedAt, null, serverNow())}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Card de conclusão */}
            {ticket.status === "COMPLETED" && (
              <div className="card overflow-hidden">
                <div className="flex items-center gap-3 bg-emerald-500 dark:bg-emerald-600 px-5 py-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white">
                    <CheckCircle2 size={20} />
                  </span>
                  <div>
                    <div className="font-semibold text-white">Chamado concluído</div>
                    <div className="text-xs text-emerald-100 mt-0.5">
                      {ticket.completedAt && `Encerrado em ${new Date(ticket.completedAt).toLocaleString("pt-BR")}`}
                    </div>
                  </div>
                </div>
                {ticket.completionNote && (
                  <div className="px-5 py-4 bg-emerald-50 dark:bg-emerald-900/20 border-t border-emerald-200 dark:border-emerald-800/50">
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1.5 uppercase tracking-wide">
                      Instruções do técnico
                    </p>
                    <p className="text-sm text-emerald-900 dark:text-emerald-200 whitespace-pre-wrap leading-relaxed">
                      {ticket.completionNote}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Banners de aprovação */}
            {needsApproval && ticket.approvalStatus === "PENDING" && (
              <div className="card p-5 border-l-4 border-amber-400 dark:border-amber-500">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
                    <Shield size={20} />
                  </span>
                  <div>
                    <div className="font-semibold text-amber-800 dark:text-amber-300 text-sm">Aguardando aprovação</div>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                      Esta solicitação requer autorização do <strong>Chefe de Setor</strong> antes de ser processada pela GTI.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {needsApproval && ticket.approvalStatus === "APPROVED" && (
              <div className="card p-5 border-l-4 border-emerald-400 dark:border-emerald-500">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck size={20} />
                  </span>
                  <div>
                    <div className="font-semibold text-emerald-800 dark:text-emerald-300 text-sm">Solicitação autorizada</div>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                      O Chefe de Setor autorizou esta solicitação. A GTI irá processá-la em breve.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {needsApproval && isRejected && (
              <div className="card p-5 border-l-4 border-red-400 dark:border-red-500">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
                    <ShieldX size={20} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-red-800 dark:text-red-300 text-sm">Solicitação reprovada</div>
                    <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                      O Chefe de Setor não autorizou esta solicitação.
                    </p>
                    {ticket.approvalNote && (
                      <div className="mt-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2">
                        <p className="text-xs text-red-800 dark:text-red-300">
                          <strong>Motivo:</strong> {ticket.approvalNote}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Dados do chamado */}
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-gray-100 mb-4">Informações</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                <InfoItem label="Solicitante" value={ticket.beneficiaryName || ticket.requesterName} />
                <InfoItem label="Departamento" value={ticket.department} />
                <InfoItem label="Categoria" value={ticket.category} />
                <InfoItem label="Subcategoria" value={ticket.subcategory} />
                <InfoItem label="Unidade responsável" value={ticket.unit || "Aguardando atribuição..."} />
                <InfoItem label="Técnico responsável" value={ticket.technician || "Aguardando atribuição..."} />
              </dl>
              {ticket.freeTextDescription && (
                <div className="mt-4 rounded-xl bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 px-4 py-3">
                  <div className="text-xs font-medium text-slate-500 dark:text-gray-400 mb-1">Descrição</div>
                  <p className="text-sm text-slate-700 dark:text-gray-200 whitespace-pre-wrap">
                    {ticket.freeTextDescription}
                  </p>
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-gray-100 mb-5">Acompanhamento</h2>
              <ol className="space-y-0">
                {visibleStatuses.map((s, i) => {
                  const done = !isRejected && i <= currentIdx;
                  const isLast = i === visibleStatuses.length - 1;
                  const approvalInsert = needsApproval && s === "VIEWED";
                  const approvalDone   = ticket.approvalStatus === "APPROVED" || ticket.approvalStatus === "REJECTED";
                  const approvalColors =
                    ticket.approvalStatus === "APPROVED" ? "border-emerald-500 bg-emerald-500 text-white"
                    : ticket.approvalStatus === "REJECTED" ? "border-red-500 bg-red-500 text-white"
                    : "border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-500 dark:text-amber-400";
                  const approvalLabel =
                    ticket.approvalStatus === "APPROVED" ? "Autorizado pelo Chefe de Setor"
                    : ticket.approvalStatus === "REJECTED" ? "Reprovado pelo Chefe de Setor"
                    : "Aguardando aprovação do Chefe de Setor";
                  const approvalDesc =
                    ticket.approvalStatus === "APPROVED" ? "Solicitação autorizada — encaminhada para a GTI"
                    : ticket.approvalStatus === "REJECTED" ? (ticket.approvalNote ? `Motivo: ${ticket.approvalNote}` : "Solicitação não autorizada")
                    : "Aguardando decisão do Chefe de Setor";

                  return (
                    <>
                      {approvalInsert && (
                        <li key="approval" className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition ${
                              approvalDone ? approvalColors : "border-amber-300 bg-amber-50 dark:bg-amber-900/20 text-amber-400"
                            }`}>
                              {ticket.approvalStatus === "APPROVED" ? <ShieldCheck size={13} />
                               : ticket.approvalStatus === "REJECTED" ? <ShieldX size={13} />
                               : <Shield size={13} />}
                            </div>
                            <div className={`w-0.5 flex-1 min-h-[28px] my-1 ${ticket.approvalStatus === "APPROVED" ? "bg-emerald-500" : "bg-slate-200 dark:bg-gray-700"}`} />
                          </div>
                          <div className="pb-4 min-w-0">
                            <div className={`text-sm font-medium leading-7 ${approvalDone ? "text-slate-900 dark:text-gray-100" : "text-amber-600 dark:text-amber-400"}`}>
                              {approvalLabel}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-gray-500 -mt-1">
                              {approvalDesc}
                              {ticket.approvalStatus === "APPROVED" && ticket.approvalDecidedAt && (
                                <span className="ml-2 text-slate-400 dark:text-gray-600">
                                  · {new Date(ticket.approvalDecidedAt).toLocaleString("pt-BR")}
                                </span>
                              )}
                            </div>
                          </div>
                        </li>
                      )}

                      {(!isRejected || s === "OPEN") && (
                        <li key={s} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition ${
                              done ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-300 dark:text-gray-600"
                            }`}>
                              {done ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                            </div>
                            {(!isLast || isRejected || (s === "VIEWED" && ticket.technician)) && (
                              <div className={`w-0.5 flex-1 min-h-[28px] my-1 ${done ? "bg-brand-600" : "bg-slate-200 dark:bg-gray-700"}`} />
                            )}
                          </div>
                          <div className="pb-4 min-w-0">
                            <div className={`text-sm font-medium leading-7 ${done ? "text-slate-900 dark:text-gray-100" : "text-slate-400 dark:text-gray-600"}`}>
                              {STATUS_LABEL[s]}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-gray-500 -mt-1">
                              {STATUS_DESC[s]}
                              {done && timestamps[s] && (
                                <span className="ml-2 text-slate-400 dark:text-gray-600">
                                  · {new Date(timestamps[s]).toLocaleString("pt-BR")}
                                </span>
                              )}
                            </div>
                          </div>
                        </li>
                      )}

                      {/* Técnico atribuído — exibido logo após VIEWED */}
                      {s === "VIEWED" && ticket.technician && !isRejected && (
                        <li key="tech-assigned" className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-brand-400 bg-brand-50 dark:bg-brand-900/20 text-brand-500 dark:text-brand-400">
                              <UserCheck size={13} />
                            </div>
                            {!isLast && (
                              <div className={`w-0.5 flex-1 min-h-[28px] my-1 ${done ? "bg-brand-600" : "bg-slate-200 dark:bg-gray-700"}`} />
                            )}
                          </div>
                          <div className="pb-4 min-w-0">
                            <div className="text-sm font-medium leading-7 text-slate-900 dark:text-gray-100">
                              Técnico responsável atribuído
                            </div>
                            <div className="text-xs text-slate-500 dark:text-gray-500 -mt-1">
                              {ticket.technician}
                              {ticket.unit && <span className="text-slate-400 dark:text-gray-600"> · {ticket.unit}</span>}
                            </div>
                          </div>
                        </li>
                      )}
                    </>
                  );
                })}
              </ol>
            </div>

            {/* Banner AnyDesk — enquanto não concluído */}
            {ticket.isRemote && ticket.status !== "COMPLETED" && (
              <div className="card p-5 border-l-4 border-amber-400 dark:border-amber-500">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
                    <MonitorSmartphone size={20} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-amber-800 dark:text-amber-300 text-sm flex items-center gap-2">
                      <Wifi size={14} className="animate-pulse" />
                      Aguardando conexão AnyDesk
                    </div>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                      Mantenha o <strong>AnyDesk aberto</strong> no seu computador.
                      Quando o técnico se conectar, aparecerá uma notificação —
                      clique em <strong>Aceitar</strong> para iniciar o atendimento.
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Técnico ainda não se conectou</span>
                      {ticket.status === "IN_SERVICE" && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">✓ Em atendimento</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>{/* fim coluna principal */}

          {/* ── Coluna lateral — Chat + Feedback ── */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-4 space-y-4">

              {/* Card de mensagens */}
              <div className="card flex flex-col overflow-hidden" style={{ maxHeight: "calc(100vh - 5.5rem)" }}>
                {/* Header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-gray-700/60 shrink-0">
                  <MessageSquare size={14} className="text-brand-600 dark:text-brand-400" />
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-gray-100 flex-1">
                    {isCounterTicket ? "Envio do contador" : "Mensagens do técnico"}
                  </h2>
                  {/* Indicador de nova mensagem */}
                  {hasNewMsg && (
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Nova mensagem" />
                  )}
                  {messages.length > 0 && (
                    <span className="rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-400 text-[10px] font-bold px-2 py-0.5">
                      {messages.length}
                    </span>
                  )}
                  {/* Horário da última atualização */}
                  {lastUpdated && (
                    <span className="text-[10px] text-slate-400 dark:text-gray-500" title="Última atualização">
                      ↻ {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>

                {/* Corpo rolável */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 min-h-0">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-8 text-center gap-2">
                      <MessageSquare size={28} className="text-slate-200 dark:text-gray-700" />
                      <p className="text-xs text-slate-400 dark:text-gray-500 leading-relaxed max-w-[180px]">
                        {isCounterTicket
                          ? "Envie o screenshot do contador da impressora pelo campo abaixo."
                          : "O técnico pode enviar atualizações por aqui durante o atendimento."}
                      </p>
                    </div>
                  ) : (
                    messages.map((m) => (
                      <div key={m.id} className={`flex gap-2 ${m.fromUser ? "flex-row-reverse" : ""}`}>
                        {/* Avatar com iniciais reais */}
                        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                          m.fromUser
                            ? "bg-slate-200 dark:bg-gray-700 text-slate-600 dark:text-gray-300"
                            : "bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-400"
                        }`}>
                          {m.fromUser
                            ? getInitials(ticket.requesterName)
                            : getInitials(m.author?.name || "Técnico")}
                        </div>
                        <div className={`flex flex-col max-w-[80%] ${m.fromUser ? "items-end" : "items-start"}`}>
                          <div className={`rounded-xl text-sm leading-relaxed overflow-hidden ${
                            isImageMessage(m.content) ? "p-1" :
                            m.fromUser
                              ? "bg-slate-100 dark:bg-gray-800 text-slate-800 dark:text-gray-200 px-3 py-2"
                              : "bg-brand-50 dark:bg-brand-900/20 text-brand-900 dark:text-brand-100 px-3 py-2"
                          }`}>
                            {isImageMessage(m.content)
                              ? <img src={m.content} alt="imagem" className="max-w-[220px] max-h-60 rounded-lg object-contain cursor-zoom-in" onClick={() => setLightbox(m.content)} />
                              : m.content}
                          </div>
                          {/* Timestamp relativo com data completa no hover */}
                          <div
                            className="text-[10px] text-slate-400 dark:text-gray-500 mt-0.5 px-1 cursor-default"
                            title={new Date(m.createdAt).toLocaleString("pt-BR")}
                          >
                            {m.fromUser
                              ? ticket.requesterName.split(" ")[0]
                              : (m.author?.name?.split(" ")[0] || "Técnico GTI")}
                            {" · "}
                            {formatRelative(m.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  {/* Âncora para auto-scroll */}
                  <div ref={msgEndRef} />
                </div>

                {/* Rodapé — resposta */}
                {canReply && (
                  <div className="shrink-0 border-t border-slate-100 dark:border-gray-700/60 px-4 py-3 space-y-2">
                    <input
                      ref={imgInputRef}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleImageSelect}
                    />
                    <div className="flex gap-2">
                      <textarea
                        rows={2}
                        className="flex-1 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-800 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                        placeholder={isCounterTicket && techMessages.length === 0 ? "Descreva e envie o screenshot do contador..." : "Responder ao técnico..."}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendReply(); }}
                        onPaste={handlePaste}
                      />
                      <div className="flex flex-col gap-1.5 self-end">
                        <button
                          type="button"
                          onClick={() => imgInputRef.current?.click()}
                          disabled={replySending}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-gray-700 text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-50 transition"
                          title="Enviar imagem (máx. 3 MB)"
                        >
                          <ImageIcon size={15} />
                        </button>
                        <button
                          onClick={sendReply}
                          disabled={!replyText.trim() || replySending}
                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 transition"
                          title="Enviar (Ctrl+Enter)"
                        >
                          {replySending
                            ? <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                            : <Send size={15} />}
                        </button>
                      </div>
                    </div>
                    {replyErr && <p className="text-xs text-red-500 dark:text-red-400">{replyErr}</p>}
                    {/* Dica de atalho */}
                    <p className="text-[10px] text-slate-400 dark:text-gray-500">
                      Ctrl+Enter para enviar · Cole imagens com Ctrl+V
                    </p>
                  </div>
                )}
              </div>

              {/* Feedback */}
              {ticket.status === "COMPLETED" && config.feedbackEnabled && !ticket.hasFeedback && (
                <FeedbackForm ticketNumber={ticket.ticketNumber} onSaved={load} />
              )}
              {ticket.hasFeedback && (
                <div className="card p-4 flex items-center gap-3 text-sm text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  Avaliação enviada. Obrigado!
                </div>
              )}

            </div>
          </div>{/* fim coluna lateral */}

        </div>
      </main>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition"
            onClick={() => setLightbox(null)}
          >
            <X size={18} />
          </button>
          <img
            src={lightbox}
            alt="imagem ampliada"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function FeedbackForm({ ticketNumber, onSaved }) {
  const [rating,  setRating]  = useState(0);
  const [hover,   setHover]   = useState(0);
  const [comment, setComment] = useState("");
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState("");

  async function submit() {
    setErr("");
    setSaving(true);
    try {
      await api.post(`/tickets/track/${ticketNumber}/feedback`, { rating, comment });
      onSaved();
    } catch (e) {
      setErr(e.response?.data?.error || "Erro ao enviar");
    } finally {
      setSaving(false);
    }
  }

  const labels = ["", "Muito ruim", "Ruim", "Regular", "Bom", "Excelente"];

  return (
    <div className="card p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-gray-100">Avalie o atendimento</h3>
        <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Sua opinião ajuda a melhorar o serviço</p>
      </div>

      <div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              className="transition-transform hover:scale-110"
            >
              <Star
                size={28}
                className={`transition ${
                  n <= (hover || rating)
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-slate-200 dark:text-gray-700"
                }`}
              />
            </button>
          ))}
        </div>
        {(hover || rating) > 0 && (
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">{labels[hover || rating]}</p>
        )}
      </div>

      <div>
        <label className="field-label">Comentário (opcional)</label>
        <textarea
          rows={3}
          placeholder="Conte como foi o atendimento..."
          className="field-input resize-none"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>

      {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}

      <button disabled={!rating || saving} onClick={submit} className="btn-primary">
        {saving ? <Spinner className="h-4 w-4" /> : <Star size={15} />}
        {saving ? "Enviando..." : "Enviar avaliação"}
      </button>
    </div>
  );
}
