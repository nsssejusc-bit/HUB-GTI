# helpdesk-sejusc — Contexto do Projeto

Sistema de helpdesk interno da SEJUSC (Secretaria de Justiça, Cidadania e Direitos Humanos do Amazonas), atendendo três núcleos: **NMT**, **NIR** e **NSS**.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + Vite + TailwindCSS + React Router v6 |
| Backend | Node.js (ESM) + Express + Prisma ORM |
| Banco | MySQL 8 |
| Realtime | Socket.io (server ↔ client) |
| Infra | Docker Compose (3 serviços) |
| Auth | JWT em cookie HTTP-only (`hd_token`) |
| PDF/Export | jsPDF + jspdf-autotable, docx no backend |
| Gráficos | Recharts |

---

## Estrutura de Diretórios

```
helpdesk-sejusc/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # fonte da verdade do banco
│   │   └── migrations/            # migrations SQL (manuais ou geradas)
│   └── src/
│       ├── server.js              # bootstrap Express + Socket.io
│       ├── routes/index.js        # todas as rotas em um único arquivo
│       ├── controllers/           # handlers por domínio
│       ├── middleware/auth.js     # authRequired / optionalAuth / requireRole
│       ├── utils/                 # state machines, ticketNumber, CPF, etc.
│       └── constants/index.js     # CATEGORY_CODE, SUBCATEGORY_NAME, RESET_STATUS
├── frontend/
│   └── src/
│       ├── pages/                 # um arquivo por tela
│       ├── components/            # componentes reutilizáveis (ui.jsx, AppHeader, etc.)
│       ├── context/               # AuthContext, ThemeContext, ToastContext, SocketContext
│       └── lib/
│           ├── api.js             # cliente Axios (todas as chamadas à API)
│           ├── statuses.js        # labels/cores de status de tickets e OSs
│           └── osConstants.js     # constantes de Ordens de Serviço
└── docker-compose.yml
```

---

## Domínio Principal

### Roles
`ADMIN` · `TECHNICIAN` · `CHEFE_SETOR` · `USER`

### Fluxo de Tickets
```
OPEN → VIEWED → EN_ROUTE → IN_SERVICE → COMPLETED
```
- Tickets podem exigir aprovação do `CHEFE_SETOR` (simples ou dupla — campo `requiresApproval` / `dualApproval` na Subcategory)
- `ApprovalStatus`: `NOT_REQUIRED | PENDING | APPROVED | REJECTED`
- Tickets com `requiresApproval=true` ficam em `PENDING` até aprovação antes de avançar

### Fluxo de Ordens de Serviço (WorkOrder / OS)
```
ABERTA → EM_ANDAMENTO → CONCLUIDA | CANCELADA
```
Tipos (`OsTipo`): `VISITA_TECNICA | TROCA_EQUIPAMENTO | ENTREGA | MANUTENCAO_REDE | MANUTENCAO_CAMERA | RECOLHIMENTO_EQUIPAMENTO | ACAO | OUTRO`

### Inventário
`InventoryItem` → `InventoryUnit` (unidades físicas com `tombo`) → `InventoryMovement`
`InventoryChecklist` vincula a uma `WorkOrder` (1:1)

### Núcleos
`NMT | NIR | NSS` — usado em usuários (`nucleoResponsavel`), subcategorias e itens de inventário

### Categorias
Códigos padrão: `REMOTE | HARDWARE | NETWORK | ACCESS | PRINTER | OTHER`

### Transições de Estado — Tickets
```
OPEN → VIEWED
VIEWED → EN_ROUTE | IN_SERVICE
EN_ROUTE → IN_SERVICE
IN_SERVICE → COMPLETED
COMPLETED → (reabrir volta para OPEN — rota POST /tickets/:id/reopen)
```

### Transições de Estado — Ordens de Serviço
```
ABERTA → EM_ANDAMENTO | CANCELADA
EM_ANDAMENTO → CONCLUIDA | CANCELADA
```

### Formato do Número de Chamado
`YYYYMMDD-XXXX` — ex: `20260528-0042`  
Gerado em `backend/src/utils/ticketNumber.js` via `DailyCounter` no banco.

---

## Portas (Docker)

| Serviço | Host | Container |
|---|---|---|
| Frontend (nginx) | 5173 | 5173 |
| Backend (Express) | 3333 | 3333 |
| MySQL | 3303 | 3306 |

---

## Socket.io — Eventos

| Evento | Direção | Payload | Quem recebe |
|---|---|---|---|
| `ticket:created` | server → client | `{ ticketNumber, department, category, subcategory, nucleoResponsavel }` | TECHNICIAN/ADMIN filtrado por núcleo |

Emitido no `ticketController.js` via `req.app.get("io").emit(...)`.  
Frontend: `useSocket()`, `useSocketConnected()`, `useUnreadCount()` — importados de `SocketContext.jsx`.  
Badge de não lidos aparece no título da aba quando a janela não está em foco.

---

## Componentes UI Reutilizáveis (`frontend/src/components/ui.jsx`)

| Componente | Uso |
|---|---|
| `<Spinner>` | Loading indicator |
| `<StatusBadge status="...">` | Badge colorido para status de ticket |
| `<Field label error>` | Wrapper de campo de formulário com label e erro |
| `<Alert message>` | Alerta de erro inline |
| `<Divider label>` | Divisor horizontal com texto |

`STATUS_LABEL` exportado de `ui.jsx` — mapa de status → label em PT-BR.

---

## Convenções de Código

- **Backend é ESM** — usar `import`/`export`, nunca `require()`
- **Prisma**: client importado de `src/config/prisma.js`
- **Migrations manuais**: usar `ADD COLUMN IF NOT EXISTS` para evitar P3009 (`MODIFY COLUMN` é seguro — só `ADD COLUMN` precisa do `IF NOT EXISTS`)
- **Corrigir P3009 manualmente** (migration parcialmente aplicada, backend em restart loop):
  ```sql
  -- No MySQL interativo do container:
  UPDATE _prisma_migrations
  SET finished_at = NOW(), rolled_back_at = NULL, applied_steps_count = <N>
  WHERE migration_name = '<nome_da_migration>';
  ```
  `<N>` = número de statements SQL da migration. Depois: `docker restart helpdesk-backend`
- **Rate limiting**: `authLimiter` (login/register), `forgotLimiter`, `publicTicketLimiter`, `generalLimiter`
- **Socket.io**: `app.set("io", io)` — controllers emitem eventos via `req.app.get("io")`
- **Frontend**: chamadas à API centralizadas em `src/lib/api.js` (Axios com `withCredentials: true`)
- Sem comentários óbvios no código — apenas WHY não-óbvios

---

## Fluxo de Desenvolvimento

1. Editar código (frontend ou backend)
2. **Sempre rebuildar os containers** após qualquer mudança (no servidor, após `git pull`):
   ```bash
   docker compose build --no-cache frontend backend
   docker compose up -d
   ```
3. Para migrations novas: gerar SQL com `prisma migrate dev` ou escrever manualmente usando `ADD COLUMN IF NOT EXISTS`

---

## Variáveis de Ambiente Relevantes (backend)

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Conexão MySQL |
| `JWT_SECRET` | Segredo do JWT (mín. 32 chars) |
| `JWT_EXPIRES_IN` | Expiração do token (padrão `8h`) |
| `CORS_ORIGIN` | Origem permitida pelo CORS |
| `FEEDBACK_ENABLED` | Liga/desliga módulo de feedback |
| `COOKIE_SECURE` | `true` em produção (HTTPS) |

---

## Páginas do Frontend

`LoginPage` · `RegisterPage` · `DashboardPage` · `NewTicketPage` · `TicketDetailPage` · `TrackPage` · `WorkOrdersPage` · `WorkOrderDetailPage` · `InventoryPage` · `InventoryItemDetailPage` · `ChecklistPage` · `ChecklistDetailPage` · `AnalyticsPage` · `AuditPage` · `UsersPage` · `DepartmentsPage` · `CategoriesPage` · `TeamPage` · `ProfilePage` · `N1Page` · `ChangePasswordPage` · `ForgotPasswordPage`
