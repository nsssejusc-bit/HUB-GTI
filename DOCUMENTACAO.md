# Documentação Técnica Interna — HelpDesk SEJUSC

**Público:** Equipe de TI da SEJUSC (GTI/NSS/NIR/NMT)
**Sistema:** GTi HUB
**Stack:** Node.js + React + MySQL + Docker

---

## Índice

1. [Arquitetura](#1-arquitetura)
2. [Banco de Dados](#2-banco-de-dados)
3. [Backend — API](#3-backend--api)
4. [Frontend — SPA](#4-frontend--spa)
5. [Autenticação e Autorização](#5-autenticação-e-autorização)
6. [Variáveis de Ambiente](#6-variáveis-de-ambiente)
7. [Implantação com Docker](#7-implantação-com-docker)
8. [Perfis e Permissões](#8-perfis-e-permissões)
9. [Ciclo de Vida do Chamado](#9-ciclo-de-vida-do-chamado)
10. [Módulos do Sistema](#10-módulos-do-sistema)
11. [Referência de Endpoints](#11-referência-de-endpoints)

---

## 1. Arquitetura

### Visão Geral

```
┌──────────────┐        ┌─────────────────────┐        ┌─────────────┐
│   Navegador  │ HTTP/  │  Backend (Express)   │ Prisma │  MySQL 8.0  │
│  React + SPA │◄──WS──►│  Node.js 20-Alpine   │◄──────►│  helpdesk_  │
│  Nginx       │        │  :3333               │        │  sejusc     │
└──────────────┘        └─────────────────────┘        └─────────────┘
     :5173                    WebSocket (Socket.io)
```

### Repositório

```
helpdesk-sejusc/
├── backend/
│   ├── src/
│   │   ├── config/         # Instância do Prisma Client
│   │   ├── constants/      # Constantes globais (enums, labels)
│   │   ├── controllers/    # Lógica de negócio (11 controllers)
│   │   ├── middleware/     # JWT auth, rate limiters
│   │   ├── routes/         # Roteador único (index.js)
│   │   └── utils/          # Helpers (CPF, número de protocolo, state machines)
│   ├── prisma/
│   │   ├── schema.prisma   # Schema do banco
│   │   └── seed.js         # Carga inicial de dados
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/     # Componentes reutilizáveis
│   │   ├── context/        # AuthContext, ThemeContext, ToastContext, SocketContext
│   │   ├── lib/            # Utilitários e helpers
│   │   └── pages/          # 23 páginas React
│   ├── nginx.conf
│   └── Dockerfile
└── docker-compose.yml
```

### Dependências principais

| Camada | Pacote | Versão | Função |
|--------|--------|--------|--------|
| Backend | express | ^4.21 | Framework HTTP |
| Backend | @prisma/client | ^5.22 | ORM (MySQL) |
| Backend | jsonwebtoken | ^9.0 | Autenticação JWT |
| Backend | bcrypt | ^5.1 | Hash de senhas |
| Backend | socket.io | ^4.8 | WebSocket em tempo real |
| Backend | zod | ^3.23 | Validação de entrada |
| Backend | express-rate-limit | ^8.4 | Rate limiting por IP |
| Frontend | react | ^18.3 | Framework UI |
| Frontend | react-router-dom | ^6.28 | Roteamento SPA |
| Frontend | axios | ^1.7 | HTTP client |
| Frontend | recharts | ^2.15 | Gráficos de analytics |
| Frontend | socket.io-client | ^4.8 | WebSocket cliente |
| Frontend | jspdf | ^4.2 | Geração de PDF |

---

## 2. Banco de Dados

**SGBD:** MySQL 8.0
**Banco:** `helpdesk_sejusc`
**Character Set:** utf8mb4 / utf8mb4_unicode_ci
**ORM:** Prisma 5.22

### Enumerações (Enums)

| Enum | Valores |
|------|---------|
| `Role` | `ADMIN`, `TECHNICIAN`, `CHEFE_SETOR`, `USER` |
| `Prefixo` | `GOVERNO`, `TERCEIRIZADO`, `ESTAGIARIO` |
| `TicketStatus` | `OPEN`, `VIEWED`, `EN_ROUTE`, `IN_SERVICE`, `COMPLETED` |
| `ApprovalStatus` | `NOT_REQUIRED`, `PENDING`, `APPROVED`, `REJECTED` |
| `OsStatus` | `ABERTA`, `EM_ANDAMENTO`, `CONCLUIDA`, `CANCELADA` |
| `OsTipo` | `VISITA_TECNICA`, `TROCA_EQUIPAMENTO`, `ENTREGA`, `MANUTENCAO_REDE`, `MANUTENCAO_CAMERA`, `RECOLHIMENTO_EQUIPAMENTO`, `ACAO`, `OUTRO` |
| `InventoryStatus` | `ATIVO`, `INATIVO` |
| `MovementType` | `ENTRADA`, `SAIDA`, `AJUSTE` |
| `Nucleo` | `NMT`, `NIR`, `NSS` |
| `ChecklistStatus` | `PENDENTE`, `APROVADO`, `REJEITADO` |
| `UnitStatus` | `DISPONIVEL`, `EM_USO`, `INATIVO` |
| `Priority` | `LOW`, `MEDIUM`, `HIGH`, `URGENT` |

### Modelos Principais

#### `User`
| Campo | Tipo | Observação |
|-------|------|-----------|
| `id` | Int PK | Auto-incremento |
| `cpf` | String @unique | Identificador de login |
| `name` | String | Nome completo |
| `passwordHash` | String | Hash bcrypt |
| `role` | Role | Default: USER |
| `active` | Boolean | Default: true |
| `unitId` | Int FK | → Unit (setor técnico) |
| `departmentId` | Int FK | → Department (setor do usuário) |
| `matricula` | String? | Matrícula interna |
| `prefixo` | Prefixo? | Tipo de vínculo |
| `mustChangePassword` | Boolean | Força troca na próxima sessão |
| `nucleoResponsavel` | Nucleo? | Núcleo de um técnico |
| `isChefe` | Boolean | É chefe de setor |

#### `Ticket`
| Campo | Tipo | Observação |
|-------|------|-----------|
| `id` | Int PK | |
| `ticketNumber` | String @unique | Formato: `YYYYMMDD-NNNN` |
| `requesterName` | String | Nome do solicitante |
| `requesterCpf` | String | CPF do solicitante |
| `departmentId` | Int FK | → Department |
| `categoryId` | Int FK | → Category |
| `subcategoryId` | Int FK | → Subcategory |
| `status` | TicketStatus | Default: OPEN |
| `approvalStatus` | ApprovalStatus | Default: NOT_REQUIRED |
| `priority` | Priority | Default: MEDIUM |
| `nucleoResponsavel` | Nucleo? | Herdado da subcategoria |
| `assignedTechId` | Int FK? | → User (técnico) |
| `unitId` | Int FK? | → Unit |
| `cause` | Text? | Preenchido ao concluir |
| `solution` | Text? | Preenchido ao concluir |
| `slaDeadline` | DateTime? | Prazo calculado |
| `presential` | Boolean | Herdado da subcategoria |
| `requiresCauseSolution` | Boolean | Herdado da subcategoria |

#### `Subcategory`
| Campo | Tipo | Observação |
|-------|------|-----------|
| `requiresApproval` | Boolean | Requer aprovação do Chefe |
| `dualApproval` | Boolean | Requer 2 aprovações |
| `requiresPresential` | Boolean | Habilita estado EN_ROUTE |
| `requiresCauseSolution` | Boolean | Obriga Causa/Solução na conclusão |
| `nucleoResponsavel` | Nucleo? | Núcleo padrão para a subcategoria |
| `slaHours` | Int? | Sobrescreve SLA da categoria |

#### `WorkOrder` (Ordem de Serviço)
| Campo | Tipo | Observação |
|-------|------|-----------|
| `osNumber` | String @unique | Número da OS |
| `tipo` | OsTipo | Tipo de serviço |
| `status` | OsStatus | ABERTA → EM_ANDAMENTO → CONCLUIDA |
| `checklistId` | Int? FK | Link 1:1 com InventoryChecklist |
| `preVisitaId` | Int? FK | Self-reference para pré-visita |

#### Outros modelos

| Modelo | Função |
|--------|--------|
| `Department` | Setores da secretaria |
| `Unit` | Unidades de TI (GTI, NSS, NIR, NMT) |
| `Category` | Categorias de chamado (HARDWARE, NETWORK, etc.) |
| `TicketApproval` | Aprovações pendentes por Chefe de Setor |
| `TicketHistory` | Auditoria de transições de status |
| `TicketComment` | Comentários internos (staff) |
| `TicketMessage` | Mensagens trocadas com o solicitante |
| `Feedback` | Avaliação 1–5 estrelas após conclusão |
| `OsTecnico` | Junção: WorkOrder ↔ User (técnicos) |
| `TicketWorkOrder` | Junção: Ticket ↔ WorkOrder |
| `InventoryItem` | Item de estoque (ex: "Monitor Dell 24"") |
| `InventoryUnit` | Unidade física com tombo/patrimônio |
| `InventoryMovement` | Movimentações de entrada/saída/ajuste |
| `InventoryChecklist` | Checklist de entrega/devolução de equipamentos |
| `AuditLog` | Registro de ações administrativas |
| `ConfigFlag` | Flags de configuração em runtime (key/value) |
| `DailyCounter` | Contador diário para geração de protocolos |

### Índices Relevantes

- `Ticket`: (status), (approvalStatus), (unitId), (assignedTechId), (status, assignedTechId)
- `User`: (role, active), (departmentId)
- `AuditLog`: (actorId), (action), (createdAt)
- `TicketApproval`: (chefDeptId, status)

---

## 3. Backend — API

**Porta:** 3333
**Prefixo:** `/api`
**Módulo:** ESM (`"type": "module"`)
**Entrypoint:** `src/server.js`

### Estrutura de Controllers

| Controller | Responsabilidade |
|------------|-----------------|
| `authController` | Login, logout, registro, reset de senha |
| `ticketController` | CRUD de chamados, transições, comentários, mensagens |
| `userController` | Gestão de usuários, perfis |
| `departmentController` | Gestão de setores |
| `workOrderController` | Ordens de serviço e suas relações |
| `inventoryController` | Inventário, unidades físicas, checklists |
| `analyticsController` | Relatórios e dados para gráficos |
| `auditController` | Consulta de logs de auditoria |
| `checklistController` | Aprovação/rejeição de checklists |
| `metaController` | Configuração pública, categorias, unidades |

### Utilitários Principais

| Arquivo | Função |
|---------|--------|
| `utils/ticketStateMachine.js` | Valida transições permitidas de status de chamado |
| `utils/osStateMachine.js` | Valida transições de status de OS |
| `utils/ticketNumber.js` | Gera números de protocolo (`YYYYMMDD-NNNN`) usando `DailyCounter` |
| `utils/cpf.js` | Validação de CPF |
| `utils/nextSequence.js` | Sequência diária para protocolos |

### Rate Limiting

| Limiter | Limite | Janela | Aplicado em |
|---------|--------|--------|-------------|
| `generalLimiter` | 300 req | 1 min | Todas as rotas |
| `authLimiter` | 10 req | 15 min | `/auth/login`, `/auth/register` |
| `forgotLimiter` | 5 req | 1 hora | `/auth/forgot-password` |
| `publicTicketLimiter` | 200 req | 5 min | `/tickets/track/*` |

### WebSocket (Socket.io)

O servidor emite eventos em tempo real para o painel do monitor. Os eventos são disparados automaticamente pelos controllers ao criar ou transicionar chamados.

---

## 4. Frontend — SPA

**Porta:** 5173 (dev) / servido por Nginx (produção)
**Framework:** React 18 + Vite 5
**Roteamento:** React Router v6
**Estilização:** TailwindCSS 3

### Páginas

| Rota | Página | Acesso |
|------|--------|--------|
| `/` | HomePage | Público |
| `/login` | LoginPage | Público |
| `/cadastro` | RegisterPage | Público |
| `/esqueci-senha` | ForgotPasswordPage | Público |
| `/acompanhar/:numero` | TrackPage | Público |
| `/novo-chamado` | NewTicketPage | Público (auth opcional) |
| `/painel` | DashboardPage | TECHNICIAN, ADMIN |
| `/painel/analytics` | AnalyticsPage | TECHNICIAN, ADMIN |
| `/painel/equipe` | TeamPage | TECHNICIAN, ADMIN |
| `/painel/usuarios` | UsersPage | ADMIN |
| `/painel/setores` | DepartmentsPage | ADMIN |
| `/painel/categorias` | CategoriesPage | ADMIN |
| `/painel/ordens` | WorkOrdersPage | TECHNICIAN, ADMIN |
| `/painel/ordens/:id` | WorkOrderDetailPage | TECHNICIAN, ADMIN |
| `/painel/inventario` | InventoryPage | TECHNICIAN, ADMIN |
| `/painel/inventario/:id` | InventoryItemDetailPage | TECHNICIAN, ADMIN |
| `/painel/checklists` | ChecklistPage | TECHNICIAN, ADMIN |
| `/painel/checklists/:id` | ChecklistDetailPage | TECHNICIAN, ADMIN |
| `/painel/auditoria` | AuditPage | ADMIN |
| `/painel/n1` | N1Page | TECHNICIAN, ADMIN |
| `/chamado/:id` | TicketDetailPage | TECHNICIAN, ADMIN |
| `/perfil` | ProfilePage | Autenticado |
| `/alterar-senha` | ChangePasswordPage | Autenticado |

### Contextos Globais

| Context | Função |
|---------|--------|
| `AuthContext` | Estado de autenticação, dados do usuário logado |
| `ThemeContext` | Tema claro/escuro |
| `ToastContext` | Sistema de notificações toast |
| `SocketContext` | Conexão WebSocket persistente |

### Build de Produção

O frontend usa build multi-stage no Docker:
1. **Stage builder:** `node:20-alpine` executa `vite build`
2. **Stage final:** `nginx:alpine` serve os arquivos estáticos via `nginx.conf`

---

## 5. Autenticação e Autorização

### Fluxo de Autenticação

1. Cliente envia CPF + senha para `POST /api/auth/login`
2. Backend valida credenciais com `bcrypt.compare`
3. Gera JWT assinado com `JWT_SECRET` (expiração: `JWT_EXPIRES_IN`, padrão 8h)
4. JWT é enviado em cookie HttpOnly `hd_token` E no body da resposta
5. Requisições autenticadas incluem `Authorization: Bearer <token>` ou o cookie

### Middleware `authRequired`

- Aceita token do header `Authorization: Bearer <token>` **ou** cookie `hd_token`
- Valida assinatura e expiração do JWT
- Popula `req.user` com `{ id, role, name, unitId, mustChangePassword, nucleoResponsavel }`
- Retorna 401 se token ausente ou inválido
- Retorna 403 se `mustChangePassword = true` (exceto `/auth/change-password`, `/auth/me`, `/auth/logout`)

### Middleware `requireRole(...roles)`

- Verifica se `req.user.role` está na lista de roles permitidas
- Retorna 403 em caso negativo

### Segurança do Cookie

```
httpOnly: true
secure: process.env.COOKIE_SECURE === "true"  (ativar em produção com HTTPS)
sameSite: "strict"
maxAge: 8 horas
```

### Reset de Senha

Servidores podem solicitar reset via `/esqueci-senha`. A solicitação fica com status `PENDING` e um administrador deve aprová-la em **Painel → Senhas**. Após aprovação, a senha é redefinida para um valor padrão e `mustChangePassword` é marcado como `true`, forçando nova troca no próximo login.

---

## 6. Variáveis de Ambiente

Configuradas no arquivo `.env` na raiz do projeto (gerado a partir de `.env.example`).

| Variável | Obrigatória | Padrão | Descrição |
|----------|-------------|--------|-----------|
| `MYSQL_ROOT_PASSWORD` | Sim | — | Senha root do MySQL |
| `MYSQL_USER` | Sim | — | Usuário do banco |
| `MYSQL_PASSWORD` | Sim | — | Senha do usuário do banco |
| `DATABASE_URL` | Sim | — | `mysql://root:<pwd>@mysql:3306/helpdesk_sejusc` |
| `JWT_SECRET` | Sim | — | Chave de assinatura JWT (mín. 32 chars em produção) |
| `JWT_EXPIRES_IN` | Não | `8h` | Tempo de expiração do token |
| `PORT` | Não | `3333` | Porta do backend |
| `CORS_ORIGIN` | Não | `*` | URL autorizada para CORS (ex: `http://10.0.0.5:5173`) |
| `COOKIE_SECURE` | Não | `false` | `true` apenas com HTTPS ativo |
| `NODE_ENV` | Não | `production` | Ambiente de execução |
| `FEEDBACK_ENABLED` | Não | `true` | Ativa/desativa módulo de avaliação |

---

## 7. Implantação com Docker

### Serviços

| Serviço | Container | Imagem | Porta Host | Porta Interna |
|---------|-----------|--------|-----------|---------------|
| `mysql` | helpdesk-mysql | mysql:8.0 | 3303 | 3306 |
| `backend` | helpdesk-backend | Build local | 3333 | 3333 |
| `frontend` | helpdesk-frontend | Build local | 5173 | 5173 |

### Dependências de Inicialização

`backend` aguarda `mysql` ficar saudável (healthcheck com `mysqladmin ping`) antes de iniciar.
`frontend` aguarda `backend` antes de iniciar.

### Volumes

| Volume | Dados |
|--------|-------|
| `helpdesk_mysql_data` | Dados persistentes do MySQL |
| `helpdesk_backend_modules` | `node_modules` do backend |

### Rede

Todos os serviços operam na rede bridge `helpdesk-net`. O backend acessa o MySQL pelo hostname `mysql` (resolvido internamente pelo Docker).

### Healthcheck da API

`GET /api/health` — retorna 200 quando o backend está pronto. Verificado a cada 15s.

### Migrations e Seed

As migrations do Prisma devem ser executadas manualmente ao subir o ambiente pela primeira vez ou após alterações de schema:

```
docker exec helpdesk-backend npx prisma migrate deploy
docker exec helpdesk-backend node prisma/seed.js
```

O seed carrega as unidades, setores, categorias e subcategorias padrão, além do usuário administrador inicial. As credenciais do administrador inicial estão registradas separadamente em canal seguro da equipe de TI.

### Dados Pré-carregados pelo Seed

**Unidades (Units):**
- GTI — Gerência de Tecnologia da Informação
- NSS — Núcleo de Suporte de Sistemas
- NIR — Núcleo de Infraestrutura de Redes
- NMT — Núcleo de Manutenção Técnica

**Categorias:**

| Código | Nome | Subcategorias | Núcleo Padrão |
|--------|------|---------------|---------------|
| HARDWARE | Hardware | 5 | NMT |
| NETWORK | Rede | 3 | NIR |
| NETSERVER | Sistemas/Servidores | 8 | NSS / NIR |
| SIGED | SIGED | 5 | NSS |
| PRINTER | Impressora | 6 | NMT |
| REMOTE | Suporte Remoto | — | NSS |

---

## 8. Perfis e Permissões

| Role | Descrição | Pode abrir chamado | Painel técnico | Aprovações | Admin |
|------|-----------|--------------------|---------------|------------|-------|
| `USER` | Servidor sem perfil técnico | Sim (login) | Não | Não | Não |
| `TECHNICIAN` | Técnico de TI | Sim | Sim | Não | Não |
| `CHEFE_SETOR` | Chefe de departamento | Sim | Não | Sim (próprio setor) | Não |
| `ADMIN` | Administrador do sistema | Sim | Sim | Sim (todos) | Sim |

### Visibilidade de Chamados

- **ADMIN:** Vê todos os chamados
- **TECHNICIAN:** Vê chamados da própria unidade (`unitId`) **ou** atribuídos diretamente a ele
- **CHEFE_SETOR:** Vê chamados do próprio setor para aprovação
- **USER:** Vê somente seus próprios chamados (via `/users/me/tickets`)

### Transição de Status

Apenas `TECHNICIAN` e `ADMIN` executam transições de status. O `CHEFE_SETOR` aprova/rejeita chamados que requerem aprovação prévia.

---

## 9. Ciclo de Vida do Chamado

```
OPEN ──► VIEWED ──► [EN_ROUTE] ──► IN_SERVICE ──► COMPLETED
```

| Transição | Condição |
|-----------|----------|
| OPEN → VIEWED | Monitor visualiza o chamado |
| VIEWED → EN_ROUTE | Apenas se `presential = true` na subcategoria |
| VIEWED/EN_ROUTE → IN_SERVICE | Técnico inicia atendimento |
| IN_SERVICE → COMPLETED | Campos Causa e Solução obrigatórios se `requiresCauseSolution = true` |

### Fluxo de Aprovação

Algumas subcategorias têm `requiresApproval = true`. Nesse caso:

1. Chamado é criado com `approvalStatus = PENDING`
2. Chefe do setor do solicitante precisa aprovar
3. Apenas após aprovação o chamado fica visível para atendimento
4. Se `dualApproval = true`, são necessárias aprovações de dois setores distintos

### Geração do Número de Protocolo

O protocolo é gerado atomicamente usando o modelo `DailyCounter`. A cada chamado criado no dia, o contador é incrementado. Formato: `YYYYMMDD-NNNN` (ex: `20250526-0042`).

---

## 10. Módulos do Sistema

### Ordens de Serviço (OS)

Permite criar serviços proativos desvinculados de chamados. Tipos disponíveis: visita técnica, troca de equipamento, entrega, manutenção de rede/câmera, recolhimento, ação e outros. Uma OS pode ser vinculada a múltiplos chamados e pode ter técnicos específicos atribuídos.

**Ciclo:** `ABERTA → EM_ANDAMENTO → CONCLUIDA` (ou `CANCELADA`)

Uma OS do tipo `ACAO` possui campos extras: nome do evento, data/hora de início e fim.

### Inventário

Controle de estoque de equipamentos em dois níveis:
- **Item:** Categoria genérica (ex: "Notebook Dell Inspiron 15")
- **Unidade:** Instância física com número de tombo/patrimônio e status (`DISPONIVEL`, `EM_USO`, `INATIVO`)

Movimentações (entrada, saída, ajuste) geram histórico rastreável por item.

### Checklists

Documentos de conferência para entrega/devolução de equipamentos. Após preenchimento, passam por aprovação interna. Suportam exportação em formato DOCX. Um checklist pode ser vinculado a uma OS.

### Analytics

Dados agregados disponíveis para TECHNICIAN e ADMIN:

- Chamados por unidade, técnico, setor, categoria, dia, mês
- Tempo médio de resolução por categoria e por unidade
- Top solicitantes
- Ordens de serviço por status, tipo, unidade, técnico e mês

### Auditoria

Toda ação administrativa relevante (criação/edição de usuários, aprovações, transições de chamado) é registrada no modelo `AuditLog` com ator, tipo de ação, alvo e detalhes. Consultável pelo ADMIN em `/painel/auditoria`.

### Feedback

Controlado pela variável `FEEDBACK_ENABLED`. Quando ativo, o solicitante pode avaliar o atendimento (1–5 estrelas + comentário) após a conclusão do chamado. Cada chamado aceita exatamente uma avaliação.

---

## 11. Referência de Endpoints

**Base URL:** `/api`

### Autenticação

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| POST | `/auth/login` | Público | Login CPF/senha |
| POST | `/auth/logout` | Autenticado | Limpa cookie |
| POST | `/auth/register` | Público | Cadastro de usuário |
| POST | `/auth/forgot-password` | Público | Solicita reset de senha |
| GET | `/auth/me` | Autenticado | Dados do usuário logado |
| POST | `/auth/change-password` | Autenticado | Altera senha |

### Configuração Pública

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| GET | `/config` | Público | Categorias, unidades, setores |
| GET | `/categories` | Público | Lista categorias |
| GET | `/units` | Público | Lista unidades |
| GET | `/departments` | Público | Lista setores ativos |
| GET | `/time` | Público | Timestamp do servidor |
| GET | `/health` | Público | Health check da API |

### Chamados

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| POST | `/tickets` | Autenticado | Criar chamado |
| GET | `/tickets` | TECHNICIAN, ADMIN | Listar chamados |
| GET | `/tickets/:id` | TECHNICIAN, ADMIN | Detalhes do chamado |
| POST | `/tickets/:id/transition` | TECHNICIAN, ADMIN | Transição de status |
| PATCH | `/tickets/:id/assign` | TECHNICIAN, ADMIN | Atribuir técnico |
| POST | `/tickets/:id/approve` | CHEFE_SETOR, ADMIN | Aprovar chamado |
| POST | `/tickets/:id/reopen` | Autenticado | Reabrir chamado |
| DELETE | `/tickets/:id` | ADMIN | Excluir chamado |
| GET | `/tickets/:id/comments` | Autenticado | Comentários internos |
| POST | `/tickets/:id/comments` | Autenticado | Adicionar comentário |
| GET | `/tickets/:id/messages` | TECHNICIAN, ADMIN | Mensagens (staff) |
| POST | `/tickets/:id/messages` | TECHNICIAN, ADMIN | Enviar mensagem (staff) |
| POST | `/tickets/:id/feedback` | Autenticado | Enviar feedback |
| GET | `/tickets/track/:numero` | Público | Rastrear por protocolo |
| POST | `/tickets/track/:numero/feedback` | Público | Avaliar (público) |
| GET | `/tickets/track/:numero/messages` | Público | Mensagens (público) |
| POST | `/tickets/track/:numero/messages` | Público | Enviar mensagem (público) |
| GET | `/users/me/tickets` | Autenticado | Meus chamados |

### Usuários e Senhas

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| GET | `/users` | ADMIN | Listar usuários |
| PATCH | `/users/:id` | ADMIN | Editar usuário |
| DELETE | `/users/:id` | ADMIN | Desativar usuário |
| POST | `/users/:id/reset-password` | ADMIN | Forçar reset |
| GET | `/password-reset-requests` | ADMIN | Pedidos pendentes |
| POST | `/password-reset-requests/:id/resolve` | ADMIN | Aprovar/recusar reset |
| GET | `/technicians` | Autenticado | Lista de técnicos |

### Setores e Categorias

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| GET | `/departments/all` | ADMIN | Todos os setores (inclusive inativos) |
| POST | `/departments` | ADMIN | Criar setor |
| PATCH | `/departments/:id` | ADMIN | Editar setor |
| DELETE | `/departments/:id` | ADMIN | Excluir setor |
| POST | `/categories` | ADMIN | Criar categoria |
| PATCH | `/categories/:id` | ADMIN | Editar categoria |
| DELETE | `/categories/:id` | ADMIN | Excluir categoria |
| PATCH | `/categories/reorder` | ADMIN | Reordenar categorias |
| POST | `/categories/:catId/subcategories` | ADMIN | Criar subcategoria |
| PATCH | `/categories/:catId/subcategories/:subId` | ADMIN | Editar subcategoria |
| DELETE | `/categories/:catId/subcategories/:subId` | ADMIN | Excluir subcategoria |
| PATCH | `/categories/:catId/subcategories/reorder` | ADMIN | Reordenar subcategorias |

### Ordens de Serviço

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| GET | `/work-orders` | TECHNICIAN, ADMIN | Listar OSs |
| POST | `/work-orders` | TECHNICIAN, ADMIN | Criar OS |
| GET | `/work-orders/:id` | TECHNICIAN, ADMIN | Detalhes da OS |
| PATCH | `/work-orders/:id` | TECHNICIAN, ADMIN | Editar OS |
| DELETE | `/work-orders/:id` | ADMIN | Excluir OS |
| POST | `/work-orders/:id/transition` | TECHNICIAN, ADMIN | Transição de status |
| POST | `/work-orders/:id/tecnicos` | TECHNICIAN, ADMIN | Adicionar técnico |
| DELETE | `/work-orders/:id/tecnicos/:userId` | TECHNICIAN, ADMIN | Remover técnico |
| POST | `/work-orders/:id/tickets` | TECHNICIAN, ADMIN | Vincular chamado |
| DELETE | `/work-orders/:id/tickets/:ticketId` | TECHNICIAN, ADMIN | Desvincular chamado |

### Inventário e Checklists

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| GET | `/inventory` | TECHNICIAN, ADMIN | Listar itens |
| POST | `/inventory` | TECHNICIAN, ADMIN | Criar item |
| GET | `/inventory/:id` | TECHNICIAN, ADMIN | Detalhes do item |
| PATCH | `/inventory/:id` | TECHNICIAN, ADMIN | Editar item |
| DELETE | `/inventory/:id` | ADMIN | Excluir item |
| GET | `/inventory/:id/units` | TECHNICIAN, ADMIN | Unidades físicas |
| POST | `/inventory/:id/units` | TECHNICIAN, ADMIN | Criar unidade |
| PATCH | `/inventory/units/:unitId` | TECHNICIAN, ADMIN | Editar unidade |
| DELETE | `/inventory/units/:unitId` | TECHNICIAN, ADMIN | Excluir unidade |
| GET | `/inventory/checklists` | TECHNICIAN, ADMIN | Listar checklists |
| POST | `/inventory/checklists` | TECHNICIAN, ADMIN | Criar checklist |
| GET | `/inventory/checklists/:id` | TECHNICIAN, ADMIN | Detalhes do checklist |
| GET | `/inventory/checklists/:id/docx` | TECHNICIAN, ADMIN | Download DOCX |
| POST | `/inventory/checklists/:id/approve` | TECHNICIAN, ADMIN | Aprovar checklist |
| POST | `/inventory/checklists/:id/reject` | TECHNICIAN, ADMIN | Rejeitar checklist |
| POST | `/inventory/checklists/:id/return` | TECHNICIAN, ADMIN | Devolver para revisão |
| DELETE | `/inventory/checklists/:id` | ADMIN | Excluir checklist |

### Analytics e Auditoria

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| GET | `/analytics/by-unit` | TECHNICIAN, ADMIN | Chamados por unidade |
| GET | `/analytics/by-technician` | TECHNICIAN, ADMIN | Chamados por técnico |
| GET | `/analytics/by-department` | TECHNICIAN, ADMIN | Chamados por setor |
| GET | `/analytics/by-category` | TECHNICIAN, ADMIN | Chamados por categoria |
| GET | `/analytics/avg-resolution` | TECHNICIAN, ADMIN | Tempo médio por categoria |
| GET | `/analytics/avg-resolution-by-unit` | TECHNICIAN, ADMIN | Tempo médio por unidade |
| GET | `/analytics/top-requesters` | TECHNICIAN, ADMIN | Top solicitantes |
| GET | `/analytics/by-day` | TECHNICIAN, ADMIN | Chamados por dia |
| GET | `/analytics/by-month` | TECHNICIAN, ADMIN | Chamados por mês |
| GET | `/analytics/other` | TECHNICIAN, ADMIN | Chamados reclassificados |
| GET | `/analytics/os/by-status` | TECHNICIAN, ADMIN | OSs por status |
| GET | `/analytics/os/by-tipo` | TECHNICIAN, ADMIN | OSs por tipo |
| GET | `/analytics/os/by-unit` | TECHNICIAN, ADMIN | OSs por unidade |
| GET | `/analytics/os/by-tecnico` | TECHNICIAN, ADMIN | OSs por técnico |
| GET | `/analytics/os/by-month` | TECHNICIAN, ADMIN | OSs por mês |
| GET | `/audit-logs` | ADMIN | Logs de auditoria |
