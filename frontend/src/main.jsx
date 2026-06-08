import React, { lazy, Suspense, useEffect, useState } from "react";
import { fetchServerOffset } from "./lib/serverTime";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { SocketProvider } from "./context/SocketContext";
import { ToastProvider } from "./context/ToastContext";
import Footer from "./components/Footer";
import "./index.css";

// ── Lazy imports — cada página vira chunk separado ────────────────────────────
// Rotas públicas / leves
const HomePage           = lazy(() => import("./pages/HomePage"));
const TrackPage          = lazy(() => import("./pages/TrackPage"));
const RegisterPage       = lazy(() => import("./pages/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const TeamPage           = lazy(() => import("./pages/TeamPage"));
const ManualPage         = lazy(() => import("./pages/ManualPage"));

// Usuário logado
const NewTicketPage      = lazy(() => import("./pages/NewTicketPage"));
const ProfilePage        = lazy(() => import("./pages/ProfilePage"));
const ChangePasswordPage = lazy(() => import("./pages/ChangePasswordPage"));

// Staff geral
const DashboardPage      = lazy(() => import("./pages/DashboardPage"));

// Staff completo (TECHNICIAN / ADMIN)
const TicketDetailPage        = lazy(() => import("./pages/TicketDetailPage"));
const WorkOrdersPage          = lazy(() => import("./pages/WorkOrdersPage"));
const WorkOrderDetailPage     = lazy(() => import("./pages/WorkOrderDetailPage"));
const InventoryPage           = lazy(() => import("./pages/InventoryPage"));
const InventoryItemDetailPage = lazy(() => import("./pages/InventoryItemDetailPage"));
const ChecklistDetailPage     = lazy(() => import("./pages/ChecklistDetailPage"));

// Chunk mais pesado — recharts + jspdf, carregado só ao acessar /relatorios
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));

// Admin only
const UsersPage       = lazy(() => import("./pages/UsersPage"));
const DepartmentsPage = lazy(() => import("./pages/DepartmentsPage"));
const CategoriesPage  = lazy(() => import("./pages/CategoriesPage"));
const AuditPage       = lazy(() => import("./pages/AuditPage"));

// ── Hierarquia de roles ───────────────────────────────────────────────────────
const STAFF_ROLES      = ["TECHNICIAN", "ADMIN", "CHEFE_SETOR"];
const FULL_STAFF_ROLES = ["TECHNICIAN", "ADMIN"];

// ── Spinner compartilhado ─────────────────────────────────────────────────────
function PageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-950">
      <div className="animate-spin h-8 w-8 rounded-full border-4 border-brand-600 border-t-transparent" />
    </div>
  );
}

// ── Guard de rota ─────────────────────────────────────────────────────────────
function Protected({ children, adminOnly = false, staffOnly = false, fullStaffOnly = false }) {
  const { user, loading, refreshUser } = useAuth();
  const loc = useLocation();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed,  setRefreshed]  = useState(false);

  // Tenta refresh do /auth/me antes de redirecionar por role insuficiente
  // (garante que mudanças de role feitas pelo admin sejam reconhecidas sem re-login)
  const roleOk = !user ? false
    : adminOnly     ? user.role === "ADMIN"
    : fullStaffOnly ? FULL_STAFF_ROLES.includes(user.role)
    : staffOnly     ? STAFF_ROLES.includes(user.role)
    : true;

  useEffect(() => {
    if (user && !loading && !roleOk && !refreshed && !refreshing) {
      setRefreshing(true);
      refreshUser().finally(() => {
        setRefreshing(false);
        setRefreshed(true);
      });
    }
  }, [user, loading, roleOk, refreshed, refreshing]);

  if (loading || refreshing) return <PageSpinner />;

  if (!user) return <Navigate to={`/${loc.pathname !== "/" ? `?next=${encodeURIComponent(loc.pathname)}` : ""}`} replace />;

  if (user.mustChangePassword && loc.pathname !== "/trocar-senha") {
    return <Navigate to="/trocar-senha" replace />;
  }

  if (adminOnly    && user.role !== "ADMIN")                    return <Navigate to="/painel" replace />;
  if (fullStaffOnly && !FULL_STAFF_ROLES.includes(user.role))   return <Navigate to="/painel" replace />;
  if (staffOnly    && !STAFF_ROLES.includes(user.role))         return <Navigate to="/" replace />;

  return children;
}

// ── Inicialização ─────────────────────────────────────────────────────────────
fetchServerOffset();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <SocketProvider>
            <ToastProvider>
              <div className="flex flex-col min-h-screen">
                <div className="flex-1">
                  <Suspense fallback={<PageSpinner />}>
                    <Routes>
                      {/* Público */}
                      <Route path="/"              element={<HomePage />} />
                      <Route path="/novo-chamado"  element={<Protected><NewTicketPage /></Protected>} />
                      <Route path="/acompanhar/:ticketNumber" element={<TrackPage />} />
                      <Route path="/login"         element={<Navigate to="/" replace />} />
                      <Route path="/cadastro"      element={<RegisterPage />} />
                      <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />

                      {/* Qualquer usuário logado */}
                      <Route path="/perfil"       element={<Protected><ProfilePage /></Protected>} />
                      <Route path="/trocar-senha" element={<Protected><ChangePasswordPage /></Protected>} />

                      {/* Staff (TECHNICIAN, ADMIN, CHEFE_SETOR) */}
                      <Route path="/painel" element={<Protected staffOnly><DashboardPage /></Protected>} />

                      {/* Staff completo — CHEFE_SETOR é redirecionado para /painel */}
                      <Route path="/painel/chamado/:id" element={<Protected fullStaffOnly><TicketDetailPage /></Protected>} />
                      <Route path="/painel/relatorios"  element={<Protected fullStaffOnly><AnalyticsPage /></Protected>} />
                      <Route path="/painel/os"          element={<Protected fullStaffOnly><WorkOrdersPage /></Protected>} />
                      <Route path="/painel/os/:id"      element={<Protected fullStaffOnly><WorkOrderDetailPage /></Protected>} />

                      {/* Inventário */}
                      <Route path="/painel/inventario"     element={<Protected fullStaffOnly><InventoryPage /></Protected>} />
                      <Route path="/painel/inventario/:id" element={<Protected fullStaffOnly><InventoryItemDetailPage /></Protected>} />
                      <Route path="/painel/checklists/:id" element={<Protected fullStaffOnly><ChecklistDetailPage /></Protected>} />

                      {/* Admin only */}
                      <Route path="/painel/usuarios"   element={<Protected adminOnly><UsersPage /></Protected>} />
                      <Route path="/painel/setores"    element={<Protected adminOnly><DepartmentsPage /></Protected>} />
                      <Route path="/painel/categorias" element={<Protected adminOnly><CategoriesPage /></Protected>} />
                      <Route path="/painel/auditoria"  element={<Protected adminOnly><AuditPage /></Protected>} />

                      <Route path="/manual"  element={<ManualPage />} />
                      <Route path="/equipe" element={<TeamPage />} />
                      <Route path="*"       element={<Navigate to="/" replace />} />
                    </Routes>
                  </Suspense>
                </div>
                <Footer />
              </div>
            </ToastProvider>
          </SocketProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
