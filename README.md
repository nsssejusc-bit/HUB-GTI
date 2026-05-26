# HelpDesk SEJUSC

Sistema interno de chamados de TI da Secretaria de Estado de Justiça, Cidadania e Direitos Humanos (SEJUSC).

## Visão Geral

Plataforma web para abertura, acompanhamento e resolução de chamados técnicos de TI. Permite que servidores registrem problemas, que monitores de plantão gerenciem a fila de atendimento e que técnicos acompanhem os chamados atribuídos à sua unidade.

## Arquitetura

```
helpdesk-sejusc/
├── backend/        # API REST — Node.js + Express + Prisma (MySQL)
├── frontend/       # SPA — React + Vite + TailwindCSS
└── docker-compose.yml
```

| Camada    | Tecnologias principais                                      |
|-----------|-------------------------------------------------------------|
| Backend   | Node.js, Express, Prisma ORM, MySQL, JWT, bcrypt, Socket.io |
| Frontend  | React, Vite, TailwindCSS, React Router, Recharts            |

## Módulos

### Abertura de chamado (público)
Servidores acessam `/novo-chamado`, selecionam categoria e subcategoria e registram o problema. Ao concluir, recebem um número de protocolo no formato `YYYYMMDD-NNNN` para acompanhamento.

### Acompanhamento (público)
A rota `/acompanhar/:numero` exibe o status atual do chamado sem exigir login. Após a conclusão, o servidor pode avaliar o atendimento com uma nota de 1 a 5 estrelas.

### Painel do monitor de plantão (`MONITOR`)
- Rota `/painel` com todos os chamados do dia agrupados por unidade
- Controla as transições de estado e atribui técnicos responsáveis
- Ao concluir um chamado, os campos **Causa** e **Solução** são obrigatórios
- Aba **Senhas** para aprovar ou recusar solicitações de redefinição de senha
- Relatórios consolidados em `/painel/relatorios`

### Painel do técnico (`TECHNICIAN`)
- Visualiza chamados da própria unidade ou atribuídos diretamente a ele
- Não realiza transições de estado — esse controle é exclusivo do monitor de plantão

### Administração (`ADMIN`)
- Gerenciamento de usuários, departamentos, categorias e subcategorias
- Definição do núcleo responsável por cada subcategoria

## Ciclo de vida do chamado

```
OPEN → VIEWED → (EN_ROUTE) → IN_SERVICE → COMPLETED
```

As transições são validadas no backend. O frontend renderiza apenas as ações permitidas para o perfil e o estado atual do chamado.

## Módulo de Feedback

Controlado pela variável de ambiente `FEEDBACK_ENABLED`. Quando desativado, o formulário de avaliação não é exibido e o endpoint retorna 404.

## Comunicação em tempo real

Socket.io é utilizado para notificar o painel do monitor em tempo real sempre que um novo chamado é aberto ou um estado é alterado, sem necessidade de atualizar a página.

## Perfis de acesso

| Perfil      | Descrição                                                  |
|-------------|-------------------------------------------------------------|
| `ADMIN`     | Administração completa do sistema                           |
| `MONITOR`   | Gerenciamento da fila de chamados e atribuição de técnicos  |
| `TECHNICIAN`| Visualização de chamados da unidade                         |
