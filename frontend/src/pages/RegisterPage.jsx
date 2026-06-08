import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Eye, EyeOff, Sun, Moon, CheckCircle2, ChevronDown, Check,
  AlertTriangle, User, Hash, Briefcase, Mail, Phone, Shield, ArrowLeft,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { maskCpf, stripCpf, isValidCpf } from "../lib/cpf";
import { api } from "../lib/api";

// ── Termo de Responsabilidade SEJUSC ─────────────────────────────────────────
function TermoContent() {
  const cl = "font-semibold text-gray-700 dark:text-gray-200 mt-3 mb-1 block";
  const p  = "text-gray-600 dark:text-gray-400 leading-relaxed text-justify";
  const li = "ml-4 text-gray-600 dark:text-gray-400 leading-relaxed text-justify";
  return (
    <div className="text-xs space-y-1">
      <span className="font-bold text-gray-700 dark:text-gray-200 block text-center leading-snug mb-2">
        TERMO DE RESPONSABILIDADE, SIGILO, CONFIDENCIALIDADE E USO DOS RECURSOS DE TECNOLOGIA DA INFORMAÇÃO DA SEJUSC
      </span>
      <p className={p}>Pelo presente instrumento, o(a) servidor(a), empregado(a) público(a), colaborador(a), estagiário(a), terceirizado(a) ou qualquer usuário autorizado, doravante denominado(a) COMPROMISSÁRIO(A), em razão do acesso concedido aos recursos de Tecnologia da Informação da Secretaria de Estado de Justiça, Direitos Humanos e Cidadania – SEJUSC, declara ciência e concordância com as disposições deste Termo, comprometendo-se a observá-las integralmente.</p>

      <span className={cl}>CLÁUSULA PRIMEIRA – DO OBJETO</span>
      <p className={p}>O presente Termo tem por objeto assegurar a confidencialidade, integridade, disponibilidade, rastreabilidade e uso adequado das informações institucionais, sistemas corporativos, documentos eletrônicos, dados pessoais, recursos computacionais e demais ativos de Tecnologia da Informação disponibilizados pela SEJUSC.</p>
      <p className={p}>Para fins deste Termo, consideram-se recursos de Tecnologia da Informação, entre outros:</p>
      {["I – Sistema Integrado de Gestão Eletrônica de Documentos – SIGED;","II – Serviços de diretório e autenticação (Active Directory);","III – Pastas compartilhadas e servidores de arquivos;","IV – Correio eletrônico institucional;","V – Sistemas corporativos internos e externos;","VI – Redes cabeadas e sem fio da SEJUSC;","VII – VPN e demais mecanismos de acesso remoto;","VIII – Equipamentos de informática disponibilizados pela instituição;","IX – Quaisquer outros sistemas, aplicações, bancos de dados ou recursos tecnológicos administrados ou disponibilizados pela Gerência de Tecnologia da Informação – GTI."].map((t, i) => <p key={i} className={li}>{t}</p>)}

      <span className={cl}>CLÁUSULA SEGUNDA – DA CONCESSÃO DE ACESSO</span>
      <p className={p}>A criação de contas de usuário, concessão de credenciais, permissões de acesso e utilização dos recursos tecnológicos da SEJUSC está condicionada à aceitação deste Termo.</p>
      <p className={p}><strong>Parágrafo único.</strong> A recusa em aceitar as condições aqui estabelecidas poderá impedir a criação ou manutenção dos acessos solicitados.</p>

      <span className={cl}>CLÁUSULA TERCEIRA – DAS OBRIGAÇÕES DO(A) COMPROMISSÁRIO(A)</span>
      <p className={p}>O(A) COMPROMISSÁRIO(A) obriga-se a:</p>
      {["I – Utilizar os recursos de Tecnologia da Informação exclusivamente para fins institucionais e no exercício de suas atribuições funcionais;","II – Manter absoluto sigilo sobre quaisquer informações, documentos, processos administrativos, dados pessoais, dados sensíveis, pareceres, relatórios, comunicações internas ou quaisquer conteúdos acessados em razão das permissões concedidas;","III – Não divulgar, compartilhar, reproduzir, encaminhar, transmitir, copiar, fotografar ou permitir acesso de terceiros às informações institucionais sem autorização expressa da autoridade competente;","IV – Não utilizar informações institucionais para benefício próprio ou de terceiros;","V – Zelar pela guarda e segurança de suas credenciais de acesso, responsabilizando-se integralmente pelo uso de seu login, senha, certificado digital, token ou qualquer outro mecanismo de autenticação;","VI – Comunicar imediatamente à GTI qualquer suspeita de acesso indevido, vazamento de informações, perda de credenciais, comprometimento de senha ou incidente de segurança;","VII – Observar as normas de segurança da informação, proteção de dados pessoais e demais regulamentos internos vigentes;","VIII – Não realizar download, armazenamento externo, impressão, captura de tela, cópia local ou qualquer forma de extração de documentos e informações para finalidades não autorizadas;","IX – Manter bloqueada sua estação de trabalho sempre que se ausentar do ambiente de trabalho, ainda que temporariamente;","X – Zelar pela integridade dos equipamentos e sistemas disponibilizados pela instituição;","XI – Utilizar apenas softwares autorizados pela GTI nos equipamentos institucionais;","XII – Comunicar imediatamente à GTI qualquer irregularidade identificada nos sistemas ou equipamentos sob sua responsabilidade."].map((t, i) => <p key={i} className={li}>{t}</p>)}

      <span className={cl}>CLÁUSULA QUARTA – DAS VEDAÇÕES</span>
      <p className={p}>É expressamente vedado ao(à) COMPROMISSÁRIO(A):</p>
      {["I – Compartilhar credenciais de acesso com terceiros, inclusive colegas de trabalho, estagiários, terceirizados, prestadores de serviço ou superiores hierárquicos;","II – Utilizar credenciais pertencentes a outro usuário;","III – Alterar, excluir, ocultar, modificar ou destruir documentos, registros ou informações institucionais sem autorização ou competência funcional;","IV – Tentar burlar mecanismos de segurança, autenticação, monitoramento ou auditoria;","V – Instalar softwares, aplicativos ou ferramentas sem autorização da GTI;","VI – Utilizar os recursos tecnológicos para atividades ilícitas, incompatíveis com as atribuições institucionais ou que possam comprometer a segurança da informação;","VII – Promover acesso não autorizado a sistemas, bancos de dados, equipamentos ou informações institucionais."].map((t, i) => <p key={i} className={li}>{t}</p>)}

      <span className={cl}>CLÁUSULA QUINTA – DA PROTEÇÃO DE DADOS PESSOAIS</span>
      <p className={p}>O(A) COMPROMISSÁRIO(A) declara ciência de que poderá ter acesso a dados pessoais e, eventualmente, dados pessoais sensíveis tratados pela SEJUSC.</p>
      <p className={p}><strong>Parágrafo primeiro.</strong> O tratamento dessas informações deverá ocorrer exclusivamente para finalidades institucionais e em conformidade com a Lei Federal nº 13.709/2018 – Lei Geral de Proteção de Dados Pessoais (LGPD).</p>
      <p className={p}><strong>Parágrafo segundo.</strong> É vedada qualquer utilização, compartilhamento, divulgação ou tratamento de dados pessoais para finalidade diversa daquela relacionada às atribuições funcionais do usuário.</p>

      <span className={cl}>CLÁUSULA SEXTA – DO CONTROLE E RASTREABILIDADE</span>
      <p className={p}>O(A) COMPROMISSÁRIO(A) declara ciência de que todos os acessos realizados nos recursos tecnológicos da SEJUSC poderão ser registrados, monitorados, auditados e armazenados para fins de segurança, conformidade, investigação de incidentes e atendimento a determinações legais ou administrativas.</p>
      <p className={p}><strong>Parágrafo primeiro.</strong> Poderão ser registrados, entre outros:</p>
      {["I – Data e hora dos acessos;","II – Endereço IP utilizado;","III – Equipamento utilizado;","IV – Operações realizadas nos sistemas;","V – Alterações efetuadas em documentos e registros;","VI – Logs de autenticação e utilização dos sistemas."].map((t, i) => <p key={i} className={li}>{t}</p>)}
      <p className={p}><strong>Parágrafo segundo.</strong> O compartilhamento de credenciais ou qualquer tentativa de ocultar a autoria de ações realizadas nos sistemas será considerada falta grave.</p>

      <span className={cl}>CLÁUSULA SÉTIMA – DA RESPONSABILIZAÇÃO</span>
      <p className={p}>O descumprimento das disposições previstas neste Termo poderá ensejar:</p>
      {["I – Suspensão ou revogação imediata dos acessos concedidos;","II – Comunicação à chefia imediata e à unidade de lotação do usuário;","III – Instauração de procedimentos administrativos cabíveis;","IV – Responsabilização civil, administrativa e penal, nos termos da legislação vigente;","V – Comunicação aos órgãos de controle competentes, quando aplicável."].map((t, i) => <p key={i} className={li}>{t}</p>)}

      <span className={cl}>CLÁUSULA OITAVA – DA VIGÊNCIA</span>
      <p className={p}>As obrigações de sigilo, confidencialidade e proteção das informações permanecerão vigentes mesmo após o desligamento, transferência, exoneração, término do contrato, encerramento do vínculo ou revogação dos acessos concedidos.</p>

      <span className={cl}>CLÁUSULA NONA – DA ACEITAÇÃO ELETRÔNICA</span>
      <p className={p}>A aceitação deste Termo por meio eletrônico, no âmbito do HUB GTI ou de qualquer outro sistema institucional disponibilizado pela SEJUSC, produzirá os mesmos efeitos legais da assinatura física.</p>
      <p className={p}><strong>Parágrafo primeiro.</strong> A manifestação de concordância ficará vinculada ao usuário autenticado e poderá ser registrada juntamente com informações de auditoria, incluindo data, horário, endereço IP, identificador do usuário e versão do Termo aceito.</p>
      <p className={p}><strong>Parágrafo segundo.</strong> O registro eletrônico de aceite constituirá prova de ciência e concordância integral com todas as disposições aqui estabelecidas.</p>

      <span className={cl}>CLÁUSULA DÉCIMA – DAS DISPOSIÇÕES FINAIS</span>
      <p className={p}>O(A) COMPROMISSÁRIO(A) declara ter lido, compreendido e aceitado integralmente as disposições deste Termo, assumindo total responsabilidade pela utilização adequada dos recursos tecnológicos e das informações institucionais disponibilizadas pela SEJUSC.</p>
      <p className={`${p} mt-3 text-center italic`}>Manaus/AM, na data do aceite eletrônico registrado pelo sistema.</p>
      <p className={`${p} text-center font-semibold`}>SECRETARIA DE ESTADO DE JUSTIÇA, DIREITOS HUMANOS E CIDADANIA – SEJUSC</p>
      <p className={`${p} text-center font-semibold`}>GERÊNCIA DE TECNOLOGIA DA INFORMAÇÃO – GTI</p>
    </div>
  );
}

const PREFIXOS = [
  { value: "GOVERNO",      label: "Servidor do Governo" },
  { value: "TERCEIRIZADO", label: "Terceirizado" },
  { value: "ESTAGIARIO",   label: "Estagiário" },
];

// ── Setor com busca ──────────────────────────────────────────────────────────
function DeptSelect({ value, onChange, departments }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");
  const ref               = useRef(null);

  const filtered = departments.filter((d) =>
    d.name.toLowerCase().includes(query.toLowerCase())
  );
  const selected = departments.find((d) => d.id === value);

  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="field-input w-full flex items-center justify-between text-left"
      >
        <span className={selected ? "text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"}>
          {selected ? selected.name : "Selecione seu setor..."}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <input
              autoFocus
              type="text"
              placeholder="Filtrar setor..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-sm rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <ul className="max-h-48 overflow-y-auto">
            {filtered.length === 0 && (
              <li className="px-4 py-3 text-sm text-gray-400">Nenhum setor encontrado</li>
            )}
            {filtered.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => { onChange(d.id); setOpen(false); setQuery(""); }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors
                    ${value === d.id
                      ? "bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 font-medium"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                >
                  {d.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function RegisterPage() {
  const { theme, toggle } = useTheme();
  const navigate           = useNavigate();

  const [departments, setDepartments] = useState([]);
  const [done, setDone]               = useState(false);
  const [loading, setLoading]         = useState(false);
  const [err, setErr]                 = useState("");

  const [name,         setName]         = useState("");
  const [cpf,          setCpf]          = useState("");
  const [matricula,    setMatricula]    = useState("");
  const [prefixo,      setPrefixo]      = useState("");
  const [departmentId, setDepartmentId] = useState(null);
  const [email,        setEmail]        = useState("");
  const [telefone,     setTelefone]     = useState("");
  const [password,     setPassword]     = useState("");
  const [confirm,      setConfirm]      = useState("");
  const [showPwd,      setShowPwd]      = useState(false);
  const [showConf,     setShowConf]     = useState(false);
  const [isChefe,      setIsChefe]      = useState(false);
  const [termoLido,    setTermoLido]    = useState(false);
  const [declaracao1,  setDeclaracao1]  = useState(false);
  const [declaracao2,  setDeclaracao2]  = useState(false);

  useEffect(() => {
    api.get("/departments").then(({ data }) => setDepartments(data)).catch(() => {});
  }, []);

  const cpfClean  = stripCpf(cpf);
  const cpfValid  = cpf.length > 0 && isValidCpf(cpfClean);
  const pwdMatch  = password === confirm;
  const emailValid  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const phoneClean  = telefone.replace(/\D/g, "");
  const phoneValid  = phoneClean.length >= 10;
  const canSubmit = (
    name.trim().length >= 3 &&
    cpfValid &&
    !!prefixo &&
    !!departmentId &&
    emailValid &&
    phoneValid &&
    password.length >= 6 &&
    pwdMatch &&
    termoLido &&
    declaracao1 &&
    declaracao2
  );

  function handleTermScroll(e) {
    if (termoLido) return;
    const el = e.target;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) setTermoLido(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setErr("");
    try {
      await api.post("/auth/register", {
        name:         name.trim(),
        cpf:          cpfClean,
        matricula:    matricula.trim() || null,
        prefixo,
        departmentId,
        email:        email.trim() || null,
        telefone:     telefone.replace(/\D/g, "") || null,
        isChefe,
        password,
      });
      setDone(true);
    } catch (ex) {
      setErr(ex.response?.data?.error || "Erro ao criar conta. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  // ── Tela de sucesso ──────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-950 px-4">
        <div className="card max-w-md w-full p-8 text-center space-y-4">
          <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Conta criada!</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Sua conta foi criada com sucesso. Você já pode fazer login.
          </p>
          <button onClick={() => navigate("/login")} className="btn-primary w-full">
            Ir para o login
          </button>
        </div>
      </div>
    );
  }

  // ── Formulário ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex items-start justify-center py-10 px-4">
      {/* Toggle tema */}
      <button
        onClick={toggle}
        className="fixed top-4 right-4 p-2 rounded-full bg-white dark:bg-gray-800 shadow border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:scale-110 transition-transform"
        aria-label="Alternar tema"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className="w-full max-w-lg">
        {/* Botão voltar */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <img src="/logo-gov.svg" alt="Logo" className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Criar conta</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Preencha os dados abaixo para criar sua conta.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-5">

          {err && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {err}
            </div>
          )}

          {/* Nome */}
          <div>
            <label className="field-label flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Nome completo <span className="text-red-500">*</span>
            </label>
            <input
              className="field-input w-full"
              type="text"
              placeholder="Seu nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* CPF */}
          <div>
            <label className="field-label flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5" /> CPF <span className="text-red-500">*</span>
            </label>
            <input
              className={`field-input w-full ${cpf && !cpfValid ? "border-red-400 dark:border-red-600" : ""}`}
              type="text"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              maxLength={14}
              required
            />
            {cpf && !cpfValid && (
              <p className="text-xs text-red-500 mt-1">CPF inválido</p>
            )}
          </div>

          {/* Matrícula */}
          <div>
            <label className="field-label flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5" /> Matrícula{" "}
              <span className="text-gray-400 dark:text-gray-500 font-normal">(opcional)</span>
            </label>
            <input
              className="field-input w-full"
              type="text"
              placeholder="Número de matrícula funcional"
              value={matricula}
              onChange={(e) => setMatricula(e.target.value)}
            />
          </div>

          {/* Vínculo funcional */}
          <div>
            <label className="field-label flex items-center gap-1.5 mb-2">
              <Briefcase className="h-3.5 w-3.5" /> Vínculo funcional <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-3">
              {PREFIXOS.map((p) => (
                <label
                  key={p.value}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all select-none text-sm font-medium
                    ${prefixo === p.value
                      ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400"
                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-brand-300 dark:hover:border-brand-700"
                    }`}
                >
                  <input
                    type="radio"
                    name="prefixo"
                    value={p.value}
                    checked={prefixo === p.value}
                    onChange={() => { setPrefixo(p.value); if (p.value !== "GOVERNO") setIsChefe(false); }}
                    className="sr-only"
                  />
                  <span className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0
                    ${prefixo === p.value ? "border-brand-500" : "border-gray-300 dark:border-gray-600"}`}>
                    {prefixo === p.value && (
                      <span className="h-2 w-2 rounded-full bg-brand-500 block" />
                    )}
                  </span>
                  {p.label}
                </label>
              ))}
            </div>
          </div>

          {/* Setor */}
          <div>
            <label className="field-label mb-1.5">
              Setor <span className="text-red-500">*</span>
            </label>
            <DeptSelect
              value={departmentId}
              onChange={setDepartmentId}
              departments={departments}
            />
          </div>

          {/* E-mail */}
          <div>
            <label className="field-label flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> E-mail <span className="text-red-500">*</span>
            </label>
            <input
              className={`field-input w-full ${email && !emailValid ? "border-red-400 dark:border-red-600" : ""}`}
              type="email"
              placeholder="seu@email.gov.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {email && !emailValid && (
              <p className="text-xs text-red-500 mt-1">E-mail inválido</p>
            )}
          </div>

          {/* Telefone */}
          <div>
            <label className="field-label flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" /> Telefone para contato <span className="text-red-500">*</span>
            </label>
            <input
              className={`field-input w-full ${telefone && !phoneValid ? "border-red-400 dark:border-red-600" : ""}`}
              type="tel"
              placeholder="(92) 99999-9999"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              required
            />
            {telefone && !phoneValid && (
              <p className="text-xs text-red-500 mt-1">Informe um número válido (mínimo 10 dígitos)</p>
            )}
          </div>

          {/* Chefe de Setor — visível apenas para Servidor do Governo */}
          {prefixo === "GOVERNO" && <div>
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <div className="mt-0.5 shrink-0">
                <div
                  onClick={() => setIsChefe((v) => !v)}
                  className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-all cursor-pointer
                    ${isChefe
                      ? "border-amber-500 bg-amber-500"
                      : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                    }`}
                >
                  {isChefe && (
                    <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </div>
              <div className="flex-1">
                <span
                  onClick={() => setIsChefe((v) => !v)}
                  className="text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center gap-1.5"
                >
                  <Shield className="h-4 w-4 text-amber-500" />
                  Sou Chefe de Setor
                </span>
                {isChefe && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-2 flex items-start gap-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    Esta informação está sujeita a verificação e validação. Declarações incorretas podem causar problemas no seu acesso ao sistema.
                  </p>
                )}
              </div>
            </label>
          </div>}

          {/* Senha */}
          <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Senha de acesso
            </p>

            <div>
              <label className="field-label">Senha <span className="text-red-500">*</span></label>
              <div className="relative">
                <input
                  className="field-input w-full pr-10"
                  type={showPwd ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="field-label">Confirmar senha <span className="text-red-500">*</span></label>
              <div className="relative">
                <input
                  className={`field-input w-full pr-10 ${confirm && !pwdMatch ? "border-red-400 dark:border-red-600" : ""}`}
                  type={showConf ? "text" : "password"}
                  placeholder="Repita a senha"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConf((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirm && !pwdMatch && (
                <p className="text-xs text-red-500 mt-1">As senhas não coincidem</p>
              )}
            </div>
          </div>

          {/* Termo de Responsabilidade */}
          <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Termo de Responsabilidade
            </p>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="field-label mb-0 text-xs">Leia o termo antes de prosseguir</label>
                <span className={`text-xs flex items-center gap-1 font-medium transition-colors ${
                  termoLido ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"
                }`}>
                  {termoLido
                    ? <><Check className="h-3 w-3" /> Lido</>
                    : <><ChevronDown className="h-3 w-3 animate-bounce" /> Role até o final</>}
                </span>
              </div>
              <div
                onScroll={handleTermScroll}
                className="h-56 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gray-50 dark:bg-gray-900/50"
              >
                <TermoContent />
              </div>
            </div>

            <div className={`space-y-3 transition-opacity duration-200 ${
              termoLido ? "opacity-100" : "opacity-40 pointer-events-none select-none"
            }`}>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded accent-brand-600 cursor-pointer"
                  checked={declaracao1}
                  onChange={(e) => setDeclaracao1(e.target.checked)}
                />
                <span className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  Declaro que li integralmente o Termo de Responsabilidade, Sigilo, Confidencialidade e Uso dos Recursos de Tecnologia da Informação da SEJUSC e concordo com todas as suas disposições.
                </span>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded accent-brand-600 cursor-pointer"
                  checked={declaracao2}
                  onChange={(e) => setDeclaracao2(e.target.checked)}
                />
                <span className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  Declaro estar ciente de que meus acessos poderão ser registrados e auditados pela GTI para fins de segurança da informação e conformidade institucional.
                </span>
              </label>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
            )}
            {loading ? "Criando conta..." : "Criar conta"}
          </button>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            Já tem conta?{" "}
            <Link to="/login" className="text-brand-600 hover:underline font-medium">
              Entrar
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
