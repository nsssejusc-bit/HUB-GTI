import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useSocketConnected, useUnreadCount } from "../context/SocketContext";
import { api } from "../lib/api";
import {
  LayoutDashboard, BarChart2, LogOut, Users,
  Crown, Sun, Moon, Building2, ChevronDown, UserCircle, Ticket, KeyRound, ClipboardList, Settings, Tag, Shield, Package, SlidersHorizontal, Monitor, Settings2, Search, X,
} from "lucide-react";
import { STATUS_LABEL } from "../lib/statuses";

// Slot da logo — quando /logo.png existir, a imagem aparece automaticamente;
// enquanto isso exibe o ícone de texto.
function LogoMark() {
  const [hasLogo, setHasLogo] = useState(true);
  if (hasLogo) {
    return (
      <img
        src="/logo.png"
        alt="HUB GTI"
        className="h-8 w-auto"
        onError={() => setHasLogo(false)}
      />
    );
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white text-xs font-bold shadow-sm">
      GTI
    </span>
  );
}

const ROLE_LABEL = {
  ADMIN:       "Administrador",
  TECHNICIAN:  "Técnico",
  CHEFE_SETOR: "Chefe de Setor",
  USER:        "Usuário",
};

const STAFF_ROLES      = ["TECHNICIAN", "ADMIN", "CHEFE_SETOR"];
const FULL_STAFF_ROLES = ["TECHNICIAN", "ADMIN"];

export default function AppHeader() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const loc = useLocation();
  const nav = useNavigate();
  const [resetCount,      setResetCount]      = useState(0);
  const [osOpenCount,     setOsOpenCount]     = useState(0);
  const [pendingChecklists, setPendingChecklists] = useState(0);
  const [userOpen,   setUserOpen]   = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const userRef   = useRef(null);
  const configRef = useRef(null);

  const socketConnected = useSocketConnected();
  const unreadCount     = useUnreadCount();

  const isStaff     = STAFF_ROLES.includes(user?.role);
  const isFullStaff = FULL_STAFF_ROLES.includes(user?.role);
  const isAdmin     = user?.role === "ADMIN";
  const isChefe     = user?.role === "CHEFE_SETOR";

  useEffect(() => {
    function handle(e) {
      if (userRef.current   && !userRef.current.contains(e.target))   setUserOpen(false);
      if (configRef.current && !configRef.current.contains(e.target)) setConfigOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Atalho Ctrl+K para abrir busca
  useEffect(() => {
    if (!isFullStaff) return;
    function handleKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isFullStaff]);

  // Busca global — debounce 300 ms, apenas para TECHNICIAN/ADMIN
  useEffect(() => {
    if (!isFullStaff || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await api.get(`/tickets?search=${encodeURIComponent(searchQuery.trim())}&limit=8`);
        setSearchResults(r.data.tickets || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, isFullStaff]);

  useEffect(() => {
    if (!isAdmin) return;
    function fetchCounts() {
      api.get("/password-reset-requests").then((r) => setResetCount(r.data.length)).catch(() => {});
    }
    fetchCounts();
    const t = setInterval(fetchCounts, 30000);
    return () => clearInterval(t);
  }, [isAdmin]);

  useEffect(() => {
    if (!isFullStaff) return;
    function fetchOsCount() {
      api.get("/work-orders?status=ABERTA").then((r) => setOsOpenCount(r.data.length)).catch(() => {});
    }
    fetchOsCount();
    const t = setInterval(fetchOsCount, 30000);
    return () => clearInterval(t);
  }, [isFullStaff]);

  useEffect(() => {
    if (!isFullStaff || !user?.nucleoResponsavel) return;
    function fetchPending() {
      api.get(`/inventory/checklists?status=PENDENTE&nucleo=${user.nucleoResponsavel}`)
        .then((r) => setPendingChecklists(r.data.length)).catch(() => {});
    }
    fetchPending();
    const t = setInterval(fetchPending, 30000);
    return () => clearInterval(t);
  }, [isFullStaff, user?.nucleoResponsavel]);

  const isActive = (path) => loc.pathname === path;
  const isActiveSearch = (path, search) => loc.pathname === path && loc.search.includes(search);
  const configActive = isActive("/painel/setores") || isActive("/painel/categorias") || isActive("/painel/auditoria") || isActive("/painel/sistema") || isActiveSearch("/painel/usuarios", "tab=resets") || isActive("/painel/admin/tipos-os");

  const navCls = (active) =>
    `relative flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
      active
        ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-400"
        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800"
    }`;

  return (
    <>
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-gray-900/95 backdrop-blur-md border-b border-slate-200 dark:border-gray-700">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">

        {/* ── Brand ── */}
        <Link to={isStaff ? "/painel" : "/"} className="flex items-center gap-2 shrink-0 mr-2">
          {/* Logo: substituir img src por /logo.png quando a logo estiver pronta */}
          <LogoMark />
          <span className="hidden md:block text-sm font-semibold text-slate-800 dark:text-gray-100">
            HUB <span className="text-slate-400 dark:text-gray-500 font-normal">GTI</span>
          </span>
        </Link>

        {/* ── Nav ── */}
        <nav className="flex items-center gap-0.5 flex-1 min-w-0">

          {/* USER */}
          {!isStaff && (
            <Link to="/meus-chamados" className={navCls(isActive("/meus-chamados"))}>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold animate-pulse">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
              <Ticket size={15} />
              <span className="hidden sm:inline">Meus chamados</span>
            </Link>
          )}

          {/* Painel — staff completo e chefe de setor */}
          {isStaff && (
            <Link to="/painel" className={navCls(isActive("/painel"))}>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold animate-pulse">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
              <LayoutDashboard size={15} />
              <span className="hidden sm:inline">Painel</span>
            </Link>
          )}

          {/* Relatórios e OS — apenas TECHNICIAN e ADMIN */}
          {isFullStaff && (
            <Link to="/painel/relatorios" className={navCls(isActive("/painel/relatorios"))}>
              <BarChart2 size={15} />
              <span className="hidden sm:inline">Relatórios</span>
            </Link>
          )}

          {isFullStaff && (
            <Link to="/painel/os" className={navCls(loc.pathname.startsWith("/painel/os"))}>
              {osOpenCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold">
                  {osOpenCount > 9 ? "9+" : osOpenCount}
                </span>
              )}
              <ClipboardList size={15} />
              <span className="hidden sm:inline">OS</span>
            </Link>
          )}

          {isFullStaff && (
            <Link to="/painel/ativos" className={navCls(loc.pathname.startsWith("/painel/ativos"))}>
              <Monitor size={15} />
              <span className="hidden sm:inline">Ativos</span>
            </Link>
          )}

          {isFullStaff && (
            <Link to="/painel/inventario" className={navCls(loc.pathname.startsWith("/painel/inventario") || loc.pathname.startsWith("/painel/checklists"))}>
              {pendingChecklists > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold">
                  {pendingChecklists > 9 ? "9+" : pendingChecklists}
                </span>
              )}
              <Package size={15} />
              <span className="hidden sm:inline">Inventário</span>
            </Link>
          )}

          {/* ADMIN only */}
          {isAdmin && (
            <Link to="/painel/usuarios" className={navCls(isActive("/painel/usuarios") && !loc.search.includes("tab=resets"))}>
              <Users size={15} />
              <span className="hidden sm:inline">Usuários</span>
            </Link>
          )}

          {isAdmin && (
            <div className="relative" ref={configRef}>
              <button
                onClick={() => setConfigOpen((o) => !o)}
                className={navCls(configActive)}
              >
                <Settings size={15} />
                <span className="hidden sm:inline">Config</span>
                <ChevronDown size={11} className={`transition-transform duration-200 ${configOpen ? "rotate-180" : ""}`} />
              </button>

              <div className={`absolute left-0 top-full mt-1.5 w-52 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg overflow-hidden z-50 transition-all duration-150 ease-out origin-top-left ${
                configOpen
                  ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
                  : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
              }`}>
                  <Link
                    to="/painel/sistema"
                    onClick={() => setConfigOpen(false)}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition ${
                      isActive("/painel/sistema")
                        ? "bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 font-medium"
                        : "text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <SlidersHorizontal size={15} />
                    Sistema
                  </Link>
                  <div className="h-px bg-slate-100 dark:bg-gray-700/60" />
                  <Link
                    to="/painel/setores"
                    onClick={() => setConfigOpen(false)}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition ${
                      isActive("/painel/setores")
                        ? "bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 font-medium"
                        : "text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <Building2 size={15} />
                    Setores
                  </Link>
                  <Link
                    to="/painel/categorias"
                    onClick={() => setConfigOpen(false)}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition ${
                      isActive("/painel/categorias")
                        ? "bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 font-medium"
                        : "text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <Tag size={15} />
                    Categorias
                  </Link>
                  <Link
                    to="/painel/admin/tipos-os"
                    onClick={() => setConfigOpen(false)}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition ${
                      isActive("/painel/admin/tipos-os")
                        ? "bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 font-medium"
                        : "text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <Settings2 size={15} />
                    Tipos de OS
                  </Link>
                  <div className="h-px bg-slate-100 dark:bg-gray-700/60" />
                  <Link
                    to="/painel/usuarios?tab=resets"
                    onClick={() => setConfigOpen(false)}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition ${
                      isActiveSearch("/painel/usuarios", "tab=resets")
                        ? "bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 font-medium"
                        : "text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <KeyRound size={15} />
                    <span className="flex-1">Redefinições</span>
                    {resetCount > 0 && (
                      <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                        {resetCount > 9 ? "9+" : resetCount}
                      </span>
                    )}
                  </Link>
                  <Link
                    to="/painel/auditoria"
                    onClick={() => setConfigOpen(false)}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition ${
                      isActive("/painel/auditoria")
                        ? "bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 font-medium"
                        : "text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <Shield size={15} />
                    Auditoria
                  </Link>
              </div>
            </div>
          )}
        </nav>

        {/* ── Lado direito ── */}
        <div className="flex items-center gap-2 shrink-0">

          {/* Indicador de conexão em tempo real — apenas staff */}
          {isStaff && (
            <div
              title={socketConnected ? "Atualizações em tempo real ativas" : "Sem conexão em tempo real"}
              aria-label={socketConnected ? "Conectado" : "Desconectado"}
              className="flex items-center gap-1.5 select-none"
            >
              <span className={`h-2 w-2 rounded-full ${socketConnected ? "bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]" : "bg-red-400"}`} />
              <span className="hidden lg:inline text-[11px] text-slate-400 dark:text-gray-500">
                {socketConnected ? "Online" : "Offline"}
              </span>
            </div>
          )}

          {/* Botão de busca — apenas TECHNICIAN / ADMIN */}
          {isFullStaff && (
            <button
              onClick={() => setSearchOpen(true)}
              title="Buscar chamado (Ctrl+K)"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800 transition"
            >
              <Search size={16} />
            </button>
          )}

          {/* Toggle tema */}
          <button
            onClick={toggle}
            title={dark ? "Modo claro" : "Modo escuro"}
            aria-label={dark ? "Ativar modo claro" : "Ativar modo escuro"}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800 transition"
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Dropdown do usuário */}
          <div className="relative" ref={userRef}>
            <button
              onClick={() => setUserOpen((o) => !o)}
              className="hidden sm:flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-gray-800 transition"
            >
              {isAdmin && <Crown size={11} className="text-amber-500 shrink-0" />}
              <div className="text-right leading-tight max-w-[120px]">
                <div className="text-sm font-medium text-slate-800 dark:text-gray-100 truncate">
                  {user?.name?.split(" ")[0]}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-gray-400 truncate">
                  {ROLE_LABEL[user?.role] || user?.role}
                </div>
              </div>
              <ChevronDown size={12} className={`text-slate-400 dark:text-gray-500 transition-transform duration-200 ${userOpen ? "rotate-180" : ""}`} />
            </button>

            <div className={`absolute right-0 top-full mt-1.5 w-44 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg overflow-hidden z-50 transition-all duration-150 ease-out origin-top-right ${
              userOpen
                ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
                : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
            }`}>
              <Link
                to="/perfil"
                onClick={() => setUserOpen(false)}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition ${
                  isActive("/perfil")
                    ? "bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 font-medium"
                    : "text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800"
                }`}
              >
                <UserCircle size={15} />
                Meu perfil
              </Link>
              <div className="h-px bg-slate-100 dark:bg-gray-700/60" />
              <button
                onClick={async () => { setUserOpen(false); await logout(); nav("/login"); }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
              >
                <LogOut size={15} />
                Sair
              </button>
            </div>
          </div>

          {/* Logout mobile (só icone) */}
          <button
            onClick={async () => { await logout(); nav("/login"); }}
            title="Sair"
            aria-label="Sair da conta"
            className="sm:hidden flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>

    {/* ── Modal de busca global ── */}
    {isFullStaff && searchOpen && (
      <div
        className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4"
        onMouseDown={(e) => { if (e.target === e.currentTarget) setSearchOpen(false); }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSearchOpen(false)} />

        {/* Caixa de busca */}
        <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-2xl overflow-hidden">

          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-gray-800">
            <Search size={18} className="text-slate-400 dark:text-gray-500 shrink-0" />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setSearchOpen(false); setSearchQuery(""); } }}
              placeholder="Número, solicitante, setor..."
              className="flex-1 bg-transparent text-sm text-slate-700 dark:text-gray-200 placeholder-slate-400 dark:placeholder-gray-500 outline-none"
            />
            {searchQuery ? (
              <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-300">
                <X size={15} />
              </button>
            ) : (
              <kbd className="hidden sm:inline text-[10px] text-slate-400 dark:text-gray-500 border border-slate-200 dark:border-gray-700 rounded px-1.5 py-0.5 font-mono">Esc</kbd>
            )}
          </div>

          {/* Resultados */}
          {searchQuery.trim().length >= 2 && (
            <div className="max-h-80 overflow-y-auto">
              {searchLoading ? (
                <div className="px-4 py-4 text-sm text-slate-400 dark:text-gray-500 text-center">Buscando...</div>
              ) : searchResults.length === 0 ? (
                <div className="px-4 py-4 text-sm text-slate-400 dark:text-gray-500 text-center">Nenhum chamado encontrado</div>
              ) : (
                <ul className="py-1">
                  {searchResults.map((t) => (
                    <li key={t.id}>
                      <Link
                        to={`/painel/chamado/${t.id}`}
                        onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-gray-800 transition"
                      >
                        <span className="font-mono text-[11px] text-slate-400 dark:text-gray-500 shrink-0 w-28">
                          #{t.ticketNumber}
                        </span>
                        <span className="flex-1 text-sm text-slate-700 dark:text-gray-200 truncate">
                          {t.requesterName || "—"}
                          {t.department && (
                            <span className="text-slate-400 dark:text-gray-500"> · {t.department}</span>
                          )}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                          t.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                          t.status === "CANCELADO" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                          "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400"
                        }`}>
                          {STATUS_LABEL[t.status] || t.status}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Dica quando vazio */}
          {searchQuery.trim().length < 2 && (
            <div className="px-4 py-4 text-xs text-slate-400 dark:text-gray-500 text-center">
              Digite pelo menos 2 caracteres para buscar
            </div>
          )}
        </div>
      </div>
    )}
    </>
  );
}
