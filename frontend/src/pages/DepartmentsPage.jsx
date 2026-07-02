import { useEffect, useState } from "react";
import { api } from "../lib/api";
import AppHeader from "../components/AppHeader";
import { Alert, Spinner } from "../components/ui";
import {
  Plus, Pencil, Trash2, Check, X, ToggleLeft, ToggleRight,
  Building2, AlertTriangle, Hash, ChevronDown, Users, ShieldCheck, Crown, Search, Ticket, ChevronRight as ChevronRightIcon, Activity, CheckCircle2,
} from "lucide-react";

const ROLE_LABEL = {
  ADMIN:       "Admin",
  TECHNICIAN:  "Técnico",
  CHEFE_SETOR: "Chefe de Setor",
  USER:        "Usuário",
};

const ROLE_COLORS = {
  ADMIN:       "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-amber-200 dark:ring-amber-700",
  TECHNICIAN:  "bg-slate-50 dark:bg-gray-800 text-slate-600 dark:text-gray-300 ring-slate-200 dark:ring-gray-700",
  CHEFE_SETOR: "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 ring-purple-200 dark:ring-purple-700",
  USER:        "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-emerald-200 dark:ring-emerald-800",
};

function RoleBadge({ role }) {
  const icon = role === "ADMIN"       ? <Crown size={9} />
             : role === "CHEFE_SETOR" ? <ShieldCheck size={9} />
             : null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium ring-1 ${ROLE_COLORS[role] || ROLE_COLORS.USER}`}>
      {icon} {ROLE_LABEL[role] || role}
    </span>
  );
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [users,       setUsers]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [err,         setErr]         = useState("");

  const [newName,  setNewName]  = useState("");
  const [adding,   setAdding]   = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editName,  setEditName]  = useState("");

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting,      setDeleting]      = useState(false);
  const [filterQuery,   setFilterQuery]   = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [deptRes, userRes] = await Promise.all([
        api.get("/departments/all"),
        api.get("/users"),
      ]);
      setDepartments(deptRes.data);
      setUsers(userRes.data);
    } catch (e) {
      setErr(e.response?.data?.error || "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  // Agrupa usuários por departmentId
  const usersByDept = users.reduce((acc, u) => {
    const key = u.department?.id ?? "__sem_setor__";
    if (!acc[key]) acc[key] = [];
    acc[key].push(u);
    return acc;
  }, {});

  // Agrupa chefes de setor por departmento sob chefia (um chefe pode responder por mais de um)
  const chiefsByDept = users.reduce((acc, u) => {
    for (const d of u.chiefDepartments ?? []) {
      if (!acc[d.id]) acc[d.id] = [];
      acc[d.id].push(u);
    }
    return acc;
  }, {});

  async function handleAdd(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    setErr("");
    try {
      await api.post("/departments", { name: newName.trim() });
      setNewName("");
      load();
    } catch (e) {
      setErr(e.response?.data?.error || "Erro ao criar setor");
    } finally {
      setAdding(false);
    }
  }

  async function handleSaveEdit(id) {
    if (!editName.trim()) return;
    setErr("");
    try {
      await api.patch(`/departments/${id}`, { name: editName.trim() });
      setEditingId(null);
      load();
    } catch (e) {
      setErr(e.response?.data?.error || "Erro ao renomear");
    }
  }

  async function handleToggle(dept) {
    setErr("");
    try {
      await api.patch(`/departments/${dept.id}`, { active: !dept.active });
      load();
    } catch (e) {
      setErr(e.response?.data?.error || "Erro ao alterar status");
    }
  }

  async function handleDelete(id) {
    setDeleting(true);
    setErr("");
    try {
      await api.delete(`/departments/${id}`);
      setConfirmDelete(null);
      load();
    } catch (e) {
      setErr(e.response?.data?.error || "Erro ao excluir");
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  const filteredDepts = filterQuery.trim()
    ? departments.filter((d) => d.name.toLowerCase().includes(filterQuery.toLowerCase()))
    : departments;
  const active   = filteredDepts.filter((d) => d.active);
  const inactive = filteredDepts.filter((d) => !d.active);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <AppHeader />

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="card w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
                <AlertTriangle size={20} />
              </span>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-gray-100">Excluir setor</h3>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Esta ação não pode ser desfeita</p>
              </div>
            </div>
            <p className="text-sm text-slate-700 dark:text-gray-300">
              Tem certeza que deseja excluir <strong>{confirmDelete.name}</strong>?
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary text-sm py-2 px-4">Cancelar</button>
              <button
                onClick={() => handleDelete(confirmDelete.id)}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm font-semibold transition disabled:opacity-60"
              >
                {deleting ? <Spinner className="h-4 w-4" /> : <Trash2 size={14} />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-gray-100">Setores / Departamentos</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">
            Gerencie a lista de setores e veja os usuários atribuídos a cada um
          </p>
        </div>

        <Alert message={err} />

        <div className="card p-4 space-y-3">
          <form onSubmit={handleAdd} className="flex gap-2">
            <div className="relative flex-1">
              <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500" />
              <input
                className="field-input pl-9"
                placeholder="Nome do novo setor..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={100}
              />
            </div>
            <button
              type="submit"
              disabled={!newName.trim() || adding}
              className="btn-primary shrink-0"
            >
              {adding ? <Spinner className="h-4 w-4" /> : <Plus size={16} />}
              Adicionar
            </button>
          </form>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filtrar setores..."
              className="field-input pl-8 py-1.5 text-xs w-full"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="h-8 w-8" />
          </div>
        ) : departments.length === 0 ? (
          <div className="card p-12 text-center">
            <Building2 size={32} className="mx-auto text-slate-300 dark:text-gray-600 mb-3" />
            <div className="font-medium text-slate-600 dark:text-gray-400">Nenhum setor cadastrado</div>
            <p className="text-sm text-slate-400 dark:text-gray-500 mt-1">
              Adicione o primeiro setor usando o formulário acima
            </p>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">
                  Ativos ({active.length})
                </h2>
                <div className="card divide-y divide-slate-100 dark:divide-gray-700/60">
                  {active.map((dept) => (
                    <DeptRow
                      key={dept.id}
                      dept={dept}
                      deptUsers={usersByDept[dept.id] ?? []}
                      chiefUsers={chiefsByDept[dept.id] ?? []}
                      editingId={editingId}
                      editName={editName}
                      setEditingId={setEditingId}
                      setEditName={setEditName}
                      onSaveEdit={handleSaveEdit}
                      onToggle={handleToggle}
                      onDelete={setConfirmDelete}
                    />
                  ))}
                </div>
              </section>
            )}

            {inactive.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">
                  Inativos ({inactive.length})
                </h2>
                <div className="card divide-y divide-slate-100 dark:divide-gray-700/60 opacity-70">
                  {inactive.map((dept) => (
                    <DeptRow
                      key={dept.id}
                      dept={dept}
                      deptUsers={usersByDept[dept.id] ?? []}
                      chiefUsers={chiefsByDept[dept.id] ?? []}
                      editingId={editingId}
                      editName={editName}
                      setEditingId={setEditingId}
                      setEditName={setEditName}
                      onSaveEdit={handleSaveEdit}
                      onToggle={handleToggle}
                      onDelete={setConfirmDelete}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {departments.length > 0 && (
          <p className="text-xs text-slate-400 dark:text-gray-500 text-center pb-2">
            <Hash size={11} className="inline mr-1" />
            {active.length} ativo{active.length !== 1 ? "s" : ""} · {inactive.length} inativo{inactive.length !== 1 ? "s" : ""}
          </p>
        )}
      </main>
    </div>
  );
}

const TICKET_STATUS_LABEL = {
  OPEN: "Aberto", VIEWED: "Visualizado", EN_ROUTE: "A Caminho",
  IN_SERVICE: "Em Atendimento", COMPLETED: "Concluído",
};
const TICKET_STATUS_COLOR = {
  OPEN:       "bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-400",
  VIEWED:     "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  EN_ROUTE:   "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  IN_SERVICE: "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400",
  COMPLETED:  "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
};

function DeptRow({ dept, deptUsers, chiefUsers, editingId, editName, setEditingId, setEditName, onSaveEdit, onToggle, onDelete }) {
  const isEditing = editingId === dept.id;
  const [expanded, setExpanded] = useState(false);
  const [ticketsOpen, setTicketsOpen] = useState(false);
  const [deptTickets, setDeptTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  // Chefe(s) que respondem pela aprovação deste setor (podem ser chefes de outro setor "principal")
  const chefes = chiefUsers ?? [];
  const chefe = chefes[0] ?? deptUsers.find((u) => u.isChefe && u.role !== "USER");
  const chefeDeclarado = deptUsers.find((u) => u.isChefe && u.role === "USER");
  const totalUsers = deptUsers.length;

  async function loadTickets() {
    setTicketsLoading(true);
    try {
      const { data } = await api.get("/tickets", { params: { department: dept.name, limit: 200 } });
      setDeptTickets(data.tickets ?? []);
    } catch {}
    finally { setTicketsLoading(false); }
  }

  function toggleTickets() {
    const next = !ticketsOpen;
    setTicketsOpen(next);
    if (next && deptTickets.length === 0) loadTickets();
  }

  function startEdit() {
    setEditingId(dept.id);
    setEditName(dept.name);
    setExpanded(false);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  return (
    <div>
      {/* Linha principal */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Building2 size={15} className="text-slate-400 dark:text-gray-500 shrink-0" />

        {isEditing ? (
          <input
            autoFocus
            className="field-input flex-1 py-1.5 text-sm"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveEdit(dept.id);
              if (e.key === "Escape") cancelEdit();
            }}
            maxLength={100}
          />
        ) : (
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-medium ${dept.active ? "text-slate-800 dark:text-gray-100" : "text-slate-400 dark:text-gray-500 line-through"}`}>
                {dept.name}
              </span>
              {/* Badge chefe confirmado */}
              {chefe && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 ring-1 ring-purple-200 dark:ring-purple-700 px-1.5 py-0.5 text-[11px] font-medium"
                  title={chefes.length > 1 ? chefes.map((c) => c.name).join(", ") : undefined}
                >
                  <ShieldCheck size={9} /> {chefe.name.split(" ")[0]}
                  {chefes.length > 1 && ` +${chefes.length - 1}`}
                </span>
              )}
              {/* Badge chefe auto-declarado (ainda USER) */}
              {!chefe && chefeDeclarado && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-700 px-1.5 py-0.5 text-[11px] font-medium">
                  <ShieldCheck size={9} /> {chefeDeclarado.name.split(" ")[0]}*
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {dept._count?.tickets > 0 && (
                <span className="text-xs text-slate-400 dark:text-gray-500">
                  {dept._count.tickets} chamado{dept._count.tickets !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0">
          {/* Botão expandir usuários */}
          {!isEditing && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className={`flex items-center gap-1 h-7 px-2 rounded-lg text-xs font-medium transition ${
                expanded
                  ? "bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400"
                  : "text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800"
              }`}
              title="Ver usuários do setor"
            >
              <Users size={12} />
              {totalUsers}
              <ChevronDown size={11} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
          )}
          {/* Botão ver chamados */}
          {!isEditing && (
            <button
              onClick={toggleTickets}
              className={`flex items-center gap-1 h-7 px-2 rounded-lg text-xs font-medium transition ${
                ticketsOpen
                  ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                  : "text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800"
              }`}
              title="Ver chamados do setor"
            >
              <Ticket size={12} />
              {dept._count?.tickets ?? ""}
              <ChevronDown size={11} className={`transition-transform ${ticketsOpen ? "rotate-180" : ""}`} />
            </button>
          )}

          {isEditing ? (
            <>
              <button
                onClick={() => onSaveEdit(dept.id)}
                disabled={!editName.trim()}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition disabled:opacity-40"
                title="Salvar"
              >
                <Check size={15} />
              </button>
              <button
                onClick={cancelEdit}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-800 transition"
                title="Cancelar"
              >
                <X size={15} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onToggle(dept)}
                className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
                  dept.active
                    ? "text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                    : "text-slate-400 dark:text-gray-600 hover:bg-slate-100 dark:hover:bg-gray-800"
                }`}
                title={dept.active ? "Desativar" : "Ativar"}
              >
                {dept.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
              </button>

              <button
                onClick={startEdit}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-800 transition"
                title="Renomear"
              >
                <Pencil size={14} />
              </button>

              <button
                onClick={() => onDelete(dept)}
                disabled={dept._count?.tickets > 0}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
                title={dept._count?.tickets > 0 ? "Possui chamados vinculados" : "Excluir"}
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Lista expandida de usuários */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-gray-700/60 bg-slate-50/60 dark:bg-gray-800/30 px-4 py-3">
          {totalUsers === 0 ? (
            <p className="text-xs text-slate-400 dark:text-gray-500 py-1">Nenhum usuário atribuído a este setor.</p>
          ) : (
            <ul className="space-y-1.5">
              {deptUsers
                .sort((a, b) => {
                  // Chefe de Setor primeiro, depois por nome
                  const aScore = a.role === "CHEFE_SETOR" ? 0 : a.isChefe ? 1 : 2;
                  const bScore = b.role === "CHEFE_SETOR" ? 0 : b.isChefe ? 1 : 2;
                  return aScore !== bScore ? aScore - bScore : a.name.localeCompare(b.name);
                })
                .map((u) => (
                  <li key={u.id} className="flex items-center gap-2.5">
                    {/* Avatar miniatura */}
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                      u.role === "CHEFE_SETOR" ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400"
                      : u.role === "ADMIN"     ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
                      : "bg-slate-200 dark:bg-gray-700 text-slate-600 dark:text-gray-300"
                    }`}>
                      {u.name.charAt(0)}
                    </div>
                    <span className={`text-sm flex-1 ${u.active ? "text-slate-700 dark:text-gray-300" : "text-slate-400 dark:text-gray-500 line-through"}`}>
                      {u.name}
                    </span>
                    <RoleBadge role={u.role} />
                    {/* Badge auto-declarado chefe (ainda USER) */}
                    {u.isChefe && u.role === "USER" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-700 px-1.5 py-0.5 text-[11px] font-medium">
                        <ShieldCheck size={9} /> Chefe*
                      </span>
                    )}
                    {!u.active && (
                      <span className="text-[11px] text-red-500 dark:text-red-400">Inativo</span>
                    )}
                  </li>
                ))}
            </ul>
          )}
          {chefeDeclarado && !chefe && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2">
              * Auto-declarado — aguardando validação pelo admin
            </p>
          )}
        </div>
      )}

      {/* Lista de chamados do setor */}
      {ticketsOpen && (
        <div className="border-t border-slate-100 dark:border-gray-700/60 bg-slate-50/60 dark:bg-gray-800/30 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
              <Ticket size={11} /> Chamados do setor
            </span>
            <button onClick={loadTickets} className="text-[10px] text-brand-600 dark:text-brand-400 hover:underline">
              Atualizar
            </button>
          </div>
          {ticketsLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            </div>
          ) : deptTickets.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-gray-500 py-1">Nenhum chamado encontrado para este setor.</p>
          ) : (
            <>
              {/* Resumo por status */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {Object.entries(
                  deptTickets.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {})
                ).map(([status, count]) => (
                  <span key={status} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TICKET_STATUS_COLOR[status]}`}>
                    {count} {TICKET_STATUS_LABEL[status]}
                  </span>
                ))}
              </div>
              {/* Lista compact */}
              <ul className="space-y-1 max-h-48 overflow-y-auto">
                {deptTickets.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-slate-400 dark:text-gray-500 shrink-0">{t.ticketNumber}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium shrink-0 ${TICKET_STATUS_COLOR[t.status]}`}>
                      {TICKET_STATUS_LABEL[t.status]}
                    </span>
                    <span className="text-slate-600 dark:text-gray-300 truncate flex-1">{t.requesterName}</span>
                    <span className="text-slate-400 dark:text-gray-500 shrink-0">{t.category?.name}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
