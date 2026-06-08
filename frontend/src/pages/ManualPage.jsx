import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { api } from "../lib/api";
import {
  ArrowLeft, Sun, Moon, PlusCircle, Search, Clock,
  CheckCircle2, Eye, Navigation, Wrench, AlertTriangle,
  BookOpen, MessageSquare, Ticket, Info,
} from "lucide-react";

const DEFAULT_EMERGENCY = "Em caso de falha crítica que impossibilite o trabalho, entre em contato diretamente com a GTI pelo WhatsApp ou dirija-se pessoalmente à equipe de suporte. O chamado no sistema deve ser aberto mesmo assim para fins de registro.";

const STATUS_STEPS = [
  { icon: Ticket,       color: "text-slate-500  bg-slate-100  dark:bg-gray-800  dark:text-gray-400",  label: "Aberto",             desc: "Chamado registrado. A equipe de TI foi notificada e irá atender em breve." },
  { icon: Eye,          color: "text-blue-600   bg-blue-50    dark:bg-blue-900/30  dark:text-blue-400", label: "Visualizado",         desc: "Um técnico visualizou o chamado e está organizando o atendimento." },
  { icon: Navigation,   color: "text-amber-600  bg-amber-50   dark:bg-amber-900/30 dark:text-amber-400",label: "Técnico a caminho",   desc: "O técnico está se deslocando até você. Permaneça no local se possível." },
  { icon: Wrench,       color: "text-purple-600 bg-purple-50  dark:bg-purple-900/30 dark:text-purple-400",label: "Em atendimento",    desc: "O técnico está trabalhando na resolução do seu problema agora." },
  { icon: CheckCircle2, color: "text-green-600  bg-green-50   dark:bg-green-900/30 dark:text-green-400", label: "Concluído",         desc: "Problema resolvido. Você pode avaliar o atendimento recebido." },
];

function Step({ number, title, children }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white text-sm font-bold">
          {number}
        </div>
        {number < 5 && <div className="w-0.5 flex-1 bg-slate-200 dark:bg-gray-700 mt-1" />}
      </div>
      <div className="pb-6 flex-1 min-w-0">
        <p className="font-semibold text-slate-800 dark:text-gray-100 mb-1">{title}</p>
        <div className="text-sm text-slate-600 dark:text-gray-400 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400">
          <Icon size={16} />
        </div>
        <h2 className="text-base font-bold text-slate-800 dark:text-gray-100">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function ManualPage() {
  const { dark, toggle } = useTheme();
  const [emergencyContact, setEmergencyContact] = useState(DEFAULT_EMERGENCY);

  useEffect(() => {
    api.get("/config").then((r) => {
      if (r.data.emergencyContact) setEmergencyContact(r.data.emergencyContact);
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">

      {/* Header */}
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-gray-700 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition"
          >
            <ArrowLeft size={15} /> Início
          </Link>
          <div className="flex items-center gap-2 text-slate-800 dark:text-gray-100 font-semibold text-sm">
            <BookOpen size={16} className="text-brand-600" />
            Manual do Usuário
          </div>
          <button
            onClick={toggle}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-800 transition"
          >
            {dark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-10">

        {/* Introdução */}
        <div className="rounded-2xl bg-brand-600 text-white px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
              <BookOpen size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-snug">Bem-vindo ao HUB GTI</h1>
              <p className="text-sm text-blue-100 mt-1 leading-relaxed">
                Este manual explica como abrir um chamado de suporte técnico, acompanhar o atendimento e o que esperar em cada etapa.
              </p>
            </div>
          </div>
        </div>

        {/* Como abrir um chamado */}
        <Section icon={PlusCircle} title="Como abrir um chamado">
          <div className="card p-5">
            <Step number={1} title="Faça login na página inicial">
              Acesse o sistema com seu CPF e senha. Caso ainda não tenha conta, clique em{" "}
              <span className="font-medium text-brand-600 dark:text-brand-400">"Primeiro acesso? Criar conta"</span>{" "}
              e preencha o cadastro.
            </Step>
            <Step number={2} title='Clique em "Abrir novo chamado"'>
              Na página inicial, clique no botão{" "}
              <span className="font-medium text-brand-600 dark:text-brand-400">Abrir novo chamado</span>.
              Você será direcionado para o formulário de solicitação.
            </Step>
            <Step number={3} title="Escolha a categoria do problema">
              Selecione a categoria que melhor descreve o seu problema:{" "}
              <strong>Hardware</strong>, <strong>Rede</strong>, <strong>Acesso/Senha</strong>,{" "}
              <strong>Impressora</strong>, <strong>SIGED</strong>, entre outras.
              Em seguida, escolha a subcategoria mais específica.
            </Step>
            <Step number={4} title="Preencha os detalhes">
              Dependendo da categoria escolhida, alguns campos extras serão solicitados
              (como nome da impressora, localização, CPF, etc.). Preencha com atenção —
              informações completas agilizam o atendimento.
            </Step>
            <Step number={5} title="Envie o chamado e guarde o protocolo">
              Clique em <span className="font-medium text-brand-600 dark:text-brand-400">Abrir chamado</span>.
              Um número de protocolo será gerado no formato{" "}
              <span className="font-mono text-xs bg-slate-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                AAAAMMDD-XXXX
              </span>. Guarde esse número — você vai precisar dele para acompanhar o atendimento.
            </Step>
          </div>
        </Section>

        {/* Como acompanhar */}
        <Section icon={Search} title="Como acompanhar seu chamado">
          <div className="card divide-y divide-slate-100 dark:divide-gray-700/60">
            <div className="p-4 flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 text-sm font-bold">A</div>
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">Pela página inicial (logado)</p>
                <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">
                  Todos os seus chamados abertos aparecem na seção <strong>"Meus chamados"</strong> logo após o login. Clique em qualquer um para ver os detalhes e o status atual.
                </p>
              </div>
            </div>
            <div className="p-4 flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-400 text-sm font-bold">B</div>
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">Pelo número do protocolo (sem login)</p>
                <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">
                  Na página inicial, use o campo de busca no topo e digite o número do chamado
                  (ex:{" "}
                  <span className="font-mono text-xs bg-slate-100 dark:bg-gray-800 px-1 rounded">
                    20260601-0042
                  </span>
                  ) para acompanhar sem precisar fazer login.
                </p>
              </div>
            </div>
            <div className="p-4 flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400">
                <MessageSquare size={14} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">Chat com o técnico</p>
                <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">
                  Na página de acompanhamento do chamado, você pode trocar mensagens diretamente com o técnico responsável pelo atendimento.
                </p>
              </div>
            </div>
          </div>
        </Section>

        {/* Status */}
        <Section icon={Clock} title="O que significa cada status?">
          <div className="card divide-y divide-slate-100 dark:divide-gray-700/60">
            {STATUS_STEPS.map(({ icon: Icon, color, label, desc }) => (
              <div key={label} className="flex items-start gap-3 p-4">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color}`}>
                  <Icon size={15} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">{label}</p>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Dicas */}
        <Section icon={Info} title="Dicas para um atendimento mais rápido">
          <div className="card p-5 space-y-3">
            {[
              "Descreva o problema com o máximo de detalhes possível.",
              "Informe a localização exata do equipamento (bloco, sala, andar).",
              "Não abra chamados duplicados para o mesmo problema — aguarde o retorno.",
              "Se o problema for urgente, informe no campo de descrição.",
              "Fique disponível no local após abrir o chamado para agilizar o atendimento presencial.",
              "Em caso de dúvida sobre o status, acesse a página de acompanhamento pelo protocolo.",
            ].map((tip, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <CheckCircle2 size={15} className="text-green-500 shrink-0 mt-0.5" />
                <p className="text-sm text-slate-600 dark:text-gray-400 leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Aviso importante */}
        <div className="rounded-xl border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/15 px-5 py-4 flex gap-3">
          <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
            <strong>Emergências:</strong> {emergencyContact}
          </div>
        </div>

        {/* Botão de volta */}
        <div className="flex justify-center pt-2 pb-6">
          <Link to="/" className="btn-primary gap-2">
            <PlusCircle size={16} /> Abrir um chamado agora
          </Link>
        </div>

      </main>
    </div>
  );
}
