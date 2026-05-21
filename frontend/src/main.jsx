import React, { useEffect, useState } from "react";
import { fetchServerOffset } from "./lib/serverTime";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { SocketProvider } from "./context/SocketContext";
import { ToastProvider } from "./context/ToastContext";
import HomePage from "./pages/HomePage";
import NewTicketPage from "./pages/NewTicketPage";
import TrackPage from "./pages/TrackPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import TicketDetailPage from "./pages/TicketDetailPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import WorkOrdersPage from "./pages/WorkOrdersPage";
import WorkOrderDetailPage from "./pages/WorkOrderDetailPage";
import UsersPage from "./pages/UsersPage";
import DepartmentsPage from "./pages/DepartmentsPage";
import CategoriesPage from "./pages/CategoriesPage";
import AuditPage from "./pages/AuditPage";
import ProfilePage from "./pages/ProfilePage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import InventoryPage from "./pages/InventoryPage";
import InventoryItemDetailPage from "./pages/InventoryItemDetailPage";
import ChecklistDetailPage from "./pages/ChecklistDetailPage";
import TeamPage from "./pages/TeamPage";
import Footer from "./components/Footer";
import "./index.css";

// Hierarquia: ADMIN > TECHNICIAN > CHEFE_SETOR > USER
const STAFF_ROLES     = ["TECHNICIAN", "ADMIN", "CHEFE_SETOR"];
const FULL_STAFF_ROLES = ["TECHNICIAN", "ADMIN"]; // exclui CHEFE_SETOR

function Protected({ children, adminOnly = false, staffOnly = false, fullStaffOnly = false }) {
  const { user, loading, refreshUser } = useAuth();
  const loc = useLocation();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed,  setRefreshed]  = useState(false);

  // Se o usuário está logado mas o role não satisfaz a rota,
  // tenta um refresh do /auth/me antes de redirecionar
  // (garante que mudanças de role feitas pelo admin sejam reconhecidas sem re-login)
  const roleOk = !user ? false
    : adminOnly    ? user.role === "ADMIN"
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

  const spinner = (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-950">
      <div className="animate-spin h-8 w-8 rounded-full border-4 border-brand-600 border-t-transparent" />
    </div>
  );

  if (loading || refreshing) return spinner;

  if (!user) return <Navigate to={`/login${loc.pathname !== "/" ? `?next=${encodeURIComponent(loc.pathname)}` : ""}`} replace />;

  if (user.mustChangePassword && loc.pathname !== "/trocar-senha") {
    return <Navigate to="/trocar-senha" replace />;
  }

  if (adminOnly && user.role !== "ADMIN") return <Navigate to="/painel" replace />;

  if (fullStaffOnly && !FULL_STAFF_ROLES.includes(user.role)) {
    return <Navigate to="/painel" replace />;
  }

  if (staffOnly && !STAFF_ROLES.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// Busca offset do horário do servidor logo na inicialização
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
              <Routes>
                {/* Público */}
                <Route path="/" element={<HomePage />} />
                <Route path="/novo-chamado" element={<Protected><NewTicketPage /></Protected>} />
                <Route path="/acompanhar/:ticketNumber" element={<TrackPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/cadastro" element={<RegisterPage />} />
                <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />

                {/* Qualquer usuário logado */}
                <Route path="/perfil" element={<Protected><ProfilePage /></Protected>} />
                <Route path="/trocar-senha" element={<Protected><ChangePasswordPage /></Protected>} />

                {/* Staff (TECHNICIAN, ADMIN, CHEFE_SETOR) */}
                <Route path="/painel" element={<Protected staffOnly><DashboardPage /></Protected>} />

                {/* Staff completo — CHEFE_SETOR é redirecionado para /painel */}
                <Route path="/painel/chamado/:id" element={<Protected fullStaffOnly><TicketDetailPage /></Protected>} />
                <Route path="/painel/relatorios" element={<Protected fullStaffOnly><AnalyticsPage /></Protected>} />
                <Route path="/painel/os" element={<Protected fullStaffOnly><WorkOrdersPage /></Protected>} />
                <Route path="/painel/os/:id" element={<Protected fullStaffOnly><WorkOrderDetailPage /></Protected>} />

                {/* Inventário — TECHNICIAN e ADMIN */}
                <Route path="/painel/inventario" element={<Protected fullStaffOnly><InventoryPage /></Protected>} />
                <Route path="/painel/inventario/:id" element={<Protected fullStaffOnly><InventoryItemDetailPage /></Protected>} />
                <Route path="/painel/checklists/:id" element={<Protected fullStaffOnly><ChecklistDetailPage /></Protected>} />

                {/* Admin only */}
                <Route path="/painel/usuarios" element={<Protected adminOnly><UsersPage /></Protected>} />
                <Route path="/painel/setores" element={<Protected adminOnly><DepartmentsPage /></Protected>} />
                <Route path="/painel/categorias" element={<Protected adminOnly><CategoriesPage /></Protected>} />
                <Route path="/painel/auditoria" element={<Protected adminOnly><AuditPage /></Protected>} />

                <Route path="/equipe" element={<TeamPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
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
