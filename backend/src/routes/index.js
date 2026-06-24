import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, me, logout, forgotPassword, listResetRequests, resolveResetRequest } from "../controllers/authController.js";
import {
  register, listUsers, updateUser, deleteUser,
  resetPassword, changePassword, myTickets,
} from "../controllers/userController.js";
import {
  createTicket, getTicketPublic, listTickets, getTicket,
  transitionTicket, approveTicket, deleteTicket, submitFeedback,
  reopenTicket, assignTicket, listComments, addComment, submitFeedbackAuth,
  listMessages, sendMessage, listMessagesPublic, sendMessagePublic,
  getMessageImage, getMessageImagePublic, cancelTicket,
} from "../controllers/ticketController.js";
import {
  listCategories, listUnits, listTechnicians, getPublicConfig,
  updateCategory, createCategory, deleteCategory, reorderCategories,
  createSubcategory, updateSubcategory, deleteSubcategory, reorderSubcategories,
} from "../controllers/metaController.js";
import {
  listDepartments, listAllDepartments, createDepartment,
  updateDepartment, deleteDepartment,
} from "../controllers/departmentController.js";
import { listAuditLogs } from "../controllers/auditController.js";
import { subscribePush, unsubscribePush } from "../controllers/pushController.js";
import {
  listWorkOrderTypes, createWorkOrderType, updateWorkOrderType,
  deleteWorkOrderType, reorderWorkOrderTypes,
} from "../controllers/workOrderTypeController.js";
import { getAdminFlags, setAdminFlags } from "../controllers/configController.js";
import {
  ticketsByUnit, ticketsByTechnician, ticketsByDepartment,
  ticketsByCategory, avgResolutionByCategory, avgResolutionByUnit, otherReclassified,
  topRequesters, ticketsByDay, ticketsByMonth,
  osByStatus, osByTipo, osByUnit, osByTecnico, osByMonth,
  feedbackSummary, feedbackByTechnician, feedbackByCategory, feedbackByDepartment, feedbackByMonth,
} from "../controllers/analyticsController.js";
import {
  createWorkOrder, listWorkOrders, getWorkOrder, updateWorkOrder,
  transitionWorkOrder, addTecnico, removeTecnico, linkTicket, unlinkTicket,
  deleteWorkOrder,
} from "../controllers/workOrderController.js";
import {
  listAssets, getAsset, createAsset, updateAsset, deleteAsset, allocateAsset,
} from "../controllers/assetController.js";
import {
  listInventory, getInventoryItem, createInventoryItem, updateInventoryItem,
  deleteInventoryItem, listInventoryCategories,
  listUnits as listInventoryUnits,
  createUnit, updateUnit, deleteUnit,
} from "../controllers/inventoryController.js";
import {
  listChecklists, getChecklist, createChecklist, approveChecklist,
  rejectChecklist, returnChecklist, deleteChecklist, downloadChecklistDocx,
} from "../controllers/checklistController.js";
import { authRequired, optionalAuth, requireRole } from "../middleware/auth.js";

const isTest = () => process.env.NODE_ENV === "test";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skip: isTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Tente novamente em 15 minutos." },
});

const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  skip: isTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas solicitações. Tente novamente em 1 hora." },
});

const publicTicketLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 200,
  skip: isTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas consultas. Tente novamente em alguns minutos." },
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  skip: isTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Tente novamente em breve." },
});

const router = Router();
router.use(generalLimiter);

// ── Público ──────────────────────────────────────────────────────────────────
router.get("/time",            (req, res) => res.json({ now: Date.now() }));
router.get("/config",          getPublicConfig);
router.get("/categories",                    listCategories);
router.post("/categories",                   authRequired, requireRole("ADMIN"), createCategory);
router.patch("/categories/reorder",          authRequired, requireRole("ADMIN"), reorderCategories);
router.patch("/categories/:id",              authRequired, requireRole("ADMIN"), updateCategory);
router.delete("/categories/:id",             authRequired, requireRole("ADMIN"), deleteCategory);

router.post("/categories/:catId/subcategories",              authRequired, requireRole("ADMIN"), createSubcategory);
router.patch("/categories/:catId/subcategories/reorder",     authRequired, requireRole("ADMIN"), reorderSubcategories);
router.patch("/categories/:catId/subcategories/:subId",      authRequired, requireRole("ADMIN"), updateSubcategory);
router.delete("/categories/:catId/subcategories/:subId",     authRequired, requireRole("ADMIN"), deleteSubcategory);
router.get("/units",           listUnits);
router.get("/departments", listDepartments);
router.post("/tickets",  authRequired, createTicket);
router.get("/tickets/track/:ticketNumber",                  publicTicketLimiter, getTicketPublic);
router.post("/tickets/track/:ticketNumber/feedback",        publicTicketLimiter, submitFeedback);
router.get("/tickets/track/:ticketNumber/messages",         publicTicketLimiter, listMessagesPublic);
router.post("/tickets/track/:ticketNumber/messages",        publicTicketLimiter, sendMessagePublic);
router.get("/tickets/track/:ticketNumber/messages/:msgId/image", publicTicketLimiter, getMessageImagePublic);

// ── Autenticação ──────────────────────────────────────────────────────────────
router.post("/auth/login",           authLimiter, login);
router.post("/auth/logout",          logout);
router.post("/auth/register",        authLimiter, register);
router.post("/auth/forgot-password", forgotLimiter, forgotPassword);
router.get("/auth/me",               authRequired, me);
router.post("/auth/change-password", authRequired, changePassword);

// ── Solicitações de reset de senha ────────────────────────────────────────────
router.get("/password-reset-requests",              authRequired, requireRole("ADMIN"), listResetRequests);
router.post("/password-reset-requests/:id/resolve", authRequired, requireRole("ADMIN"), resolveResetRequest);

// ── Perfil do usuário logado ───────────────────────────────────────────────────
router.get("/users/me/tickets", authRequired, myTickets);

// ── Gestão de setores (ADMIN) ──────────────────────────────────────────────────
router.get("/departments/all",  authRequired, requireRole("ADMIN"), listAllDepartments);
router.post("/departments",     authRequired, requireRole("ADMIN"), createDepartment);
router.patch("/departments/:id", authRequired, requireRole("ADMIN"), updateDepartment);
router.delete("/departments/:id", authRequired, requireRole("ADMIN"), deleteDepartment);

// ── Gestão de usuários (ADMIN) ─────────────────────────────────────────────────
router.get("/users",             authRequired, requireRole("ADMIN"), listUsers);
router.patch("/users/:id",       authRequired, requireRole("ADMIN"), updateUser);
router.delete("/users/:id",      authRequired, requireRole("ADMIN"), deleteUser);
router.post("/users/:id/reset-password", authRequired, requireRole("ADMIN"), resetPassword);

// ── Área técnica ───────────────────────────────────────────────────────────────
router.get("/technicians", authRequired, listTechnicians);
router.get("/tickets",     authRequired, requireRole("TECHNICIAN", "ADMIN", "CHEFE_SETOR"), listTickets);
router.get("/tickets/:id", authRequired, requireRole("TECHNICIAN", "ADMIN", "CHEFE_SETOR"), getTicket);
router.post("/tickets/:id/transition", authRequired, requireRole("TECHNICIAN", "ADMIN"), transitionTicket);
router.post("/tickets/:id/approve",    authRequired, requireRole("CHEFE_SETOR", "ADMIN"), approveTicket);
router.post("/tickets/:id/reopen",     authRequired, reopenTicket);
router.post("/tickets/:id/cancel",     authRequired, requireRole("TECHNICIAN", "ADMIN"), cancelTicket);
router.patch("/tickets/:id/assign",    authRequired, requireRole("TECHNICIAN", "ADMIN"), assignTicket);
router.get("/tickets/:id/comments",   authRequired, listComments);
router.post("/tickets/:id/comments",  authRequired, addComment);
router.get("/tickets/:id/messages",   authRequired, requireRole("TECHNICIAN", "ADMIN"), listMessages);
router.get("/tickets/:id/messages/:msgId/image", authRequired, requireRole("TECHNICIAN", "ADMIN"), getMessageImage);
router.post("/tickets/:id/messages",  authRequired, requireRole("TECHNICIAN", "ADMIN"), sendMessage);
router.post("/tickets/:id/feedback",  authRequired, submitFeedbackAuth);
router.delete("/tickets/:id", authRequired, requireRole("ADMIN"), deleteTicket);

// ── Tipos de OS (configuráveis pelo ADMIN) ─────────────────────────────────────
router.get("/work-order-types",                   authRequired, listWorkOrderTypes);
router.post("/work-order-types",                  authRequired, requireRole("ADMIN"), createWorkOrderType);
router.patch("/work-order-types/reorder",         authRequired, requireRole("ADMIN"), reorderWorkOrderTypes);
router.patch("/work-order-types/:id",             authRequired, requireRole("ADMIN"), updateWorkOrderType);
router.delete("/work-order-types/:id",            authRequired, requireRole("ADMIN"), deleteWorkOrderType);

// ── Ordens de Serviço ──────────────────────────────────────────────────────────
const staffAccess = [authRequired, requireRole("TECHNICIAN", "ADMIN")];
const adminOnly   = [authRequired, requireRole("ADMIN")];
router.get("/work-orders",                          ...staffAccess, listWorkOrders);
router.post("/work-orders",                         ...staffAccess, createWorkOrder);
router.get("/work-orders/:id",                      ...staffAccess, getWorkOrder);
router.patch("/work-orders/:id",                    ...staffAccess, updateWorkOrder);
router.delete("/work-orders/:id",                   ...adminOnly,   deleteWorkOrder);
router.post("/work-orders/:id/transition",          ...staffAccess, transitionWorkOrder);
router.post("/work-orders/:id/tecnicos",            ...staffAccess, addTecnico);
router.delete("/work-orders/:id/tecnicos/:userId",  ...staffAccess, removeTecnico);
router.post("/work-orders/:id/tickets",             ...staffAccess, linkTicket);
router.delete("/work-orders/:id/tickets/:ticketId", ...staffAccess, unlinkTicket);

// ── Ativos ─────────────────────────────────────────────────────────────────────
router.get("/assets",                   ...staffAccess, listAssets);
router.post("/assets",                  ...staffAccess, createAsset);
router.get("/assets/:id",               ...staffAccess, getAsset);
router.patch("/assets/:id",             ...staffAccess, updateAsset);
router.delete("/assets/:id",            ...adminOnly,   deleteAsset);
router.post("/assets/:id/allocate",     ...staffAccess, allocateAsset);

// ── Inventário ─────────────────────────────────────────────────────────────────
router.get("/inventory/categories",                       ...staffAccess, listInventoryCategories);
router.get("/inventory/checklists",                       ...staffAccess, listChecklists);
router.post("/inventory/checklists",                      ...staffAccess, createChecklist);
router.get("/inventory/checklists/:id",                   ...staffAccess, getChecklist);
router.get("/inventory/checklists/:id/docx",              ...staffAccess, downloadChecklistDocx);
router.post("/inventory/checklists/:id/approve",          ...staffAccess, approveChecklist);
router.post("/inventory/checklists/:id/reject",           ...staffAccess, rejectChecklist);
router.post("/inventory/checklists/:id/return",           ...staffAccess, returnChecklist);
router.delete("/inventory/checklists/:id",                ...adminOnly,   deleteChecklist);
router.get("/inventory",                                  ...staffAccess, listInventory);
router.post("/inventory",                                 ...staffAccess, createInventoryItem);
router.get("/inventory/:id",                              ...staffAccess, getInventoryItem);
router.patch("/inventory/:id",                            ...staffAccess, updateInventoryItem);
router.delete("/inventory/:id",                           ...adminOnly,   deleteInventoryItem);
router.get("/inventory/:id/units",                        ...staffAccess, listInventoryUnits);
router.post("/inventory/:id/units",                       ...staffAccess, createUnit);
router.patch("/inventory/units/:unitId",                  ...staffAccess, updateUnit);
router.delete("/inventory/units/:unitId",                 ...staffAccess, deleteUnit);

// ── Push notifications ─────────────────────────────────────────────────────────
router.post("/push/subscribe",   authRequired, subscribePush);
router.delete("/push/subscribe", authRequired, unsubscribePush);

// ── Auditoria ──────────────────────────────────────────────────────────────────
router.get("/audit-logs", authRequired, requireRole("ADMIN"), listAuditLogs);

// ── Configurações do sistema (ADMIN) ───────────────────────────────────────────
router.get("/admin/config-flags", authRequired, requireRole("ADMIN"), getAdminFlags);
router.put("/admin/config-flags", authRequired, requireRole("ADMIN"), setAdminFlags);

// ── Analytics ──────────────────────────────────────────────────────────────────
const analyticsAccess = [authRequired, requireRole("TECHNICIAN", "ADMIN")];
router.get("/analytics/by-unit",        ...analyticsAccess, ticketsByUnit);
router.get("/analytics/by-technician",  ...analyticsAccess, ticketsByTechnician);
router.get("/analytics/by-department",  ...analyticsAccess, ticketsByDepartment);
router.get("/analytics/by-category",    ...analyticsAccess, ticketsByCategory);
router.get("/analytics/avg-resolution",          ...analyticsAccess, avgResolutionByCategory);
router.get("/analytics/avg-resolution-by-unit",  ...analyticsAccess, avgResolutionByUnit);
router.get("/analytics/other",          ...analyticsAccess, otherReclassified);
router.get("/analytics/top-requesters", ...analyticsAccess, topRequesters);
router.get("/analytics/by-day",         ...analyticsAccess, ticketsByDay);
router.get("/analytics/by-month",       ...analyticsAccess, ticketsByMonth);
// OS analytics
router.get("/analytics/os/by-status",  ...analyticsAccess, osByStatus);
router.get("/analytics/os/by-tipo",    ...analyticsAccess, osByTipo);
router.get("/analytics/os/by-unit",    ...analyticsAccess, osByUnit);
router.get("/analytics/os/by-tecnico", ...analyticsAccess, osByTecnico);
router.get("/analytics/os/by-month",   ...analyticsAccess, osByMonth);

// ── Feedback analytics (ADMIN only) ────────────────────────────────────────────
const feedbackAccess = [authRequired, requireRole("ADMIN")];
router.get("/analytics/feedback/summary",       ...feedbackAccess, feedbackSummary);
router.get("/analytics/feedback/by-technician", ...feedbackAccess, feedbackByTechnician);
router.get("/analytics/feedback/by-category",   ...feedbackAccess, feedbackByCategory);
router.get("/analytics/feedback/by-department", ...feedbackAccess, feedbackByDepartment);
router.get("/analytics/feedback/by-month",      ...feedbackAccess, feedbackByMonth);

export default router;
