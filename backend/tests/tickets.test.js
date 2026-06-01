import { describe, it, expect, beforeEach } from "vitest";
import supertest from "supertest";
import { prisma } from "../src/config/prisma.js";
import { getApp, authFor } from "./helpers.js";
import { USERS, dept, unit, category, subcategory, subcategoryApproval } from "./setup.js";

const req = () => supertest(getApp());

async function cleanTickets() {
  await prisma.ticketApproval.deleteMany();
  await prisma.ticketHistory.deleteMany();
  await prisma.ticketComment.deleteMany();
  await prisma.ticketMessage.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.ticketWorkOrder.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.dailyCounter.deleteMany();
}

beforeEach(async () => {
  await cleanTickets();
});

// ── Helpers internos ──────────────────────────────────────────────────────────

async function createTicket(role = "user", extraBody = {}) {
  const headers = await authFor(role);
  return req()
    .post("/api/tickets")
    .set(headers)
    .send({ categoryId: category.id, subcategoryId: subcategory.id, ...extraBody });
}

async function createApprovalTicket() {
  const headers = await authFor("user");
  return req()
    .post("/api/tickets")
    .set(headers)
    .send({ categoryId: category.id, subcategoryId: subcategoryApproval.id });
}

// ── Criação ───────────────────────────────────────────────────────────────────

describe("POST /api/tickets", () => {
  it("cria chamado comum como USER e retorna 201", async () => {
    const res = await createTicket();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ approvalStatus: "NOT_REQUIRED" });
    expect(res.body.ticketNumber).toMatch(/^\d{8}-\d{4}$/);
  });

  it("cria chamado com aprovação pendente quando requiresApproval=true", async () => {
    const res = await createApprovalTicket();
    expect(res.status).toBe(201);
    expect(res.body.approvalStatus).toBe("PENDING");
  });

  it("retorna 401 sem autenticação", async () => {
    const res = await req()
      .post("/api/tickets")
      .send({ categoryId: category.id, subcategoryId: subcategory.id });
    expect(res.status).toBe(401);
  });

  it("retorna 400 com categoryId inválido", async () => {
    const res = await createTicket("user", { categoryId: 999999 });
    expect(res.status).toBe(400);
  });
});

// ── Listagem ──────────────────────────────────────────────────────────────────

describe("GET /api/tickets", () => {
  it("TECHNICIAN vê lista de chamados", async () => {
    await createTicket();
    const headers = await authFor("tech");
    const res = await req().get("/api/tickets").set(headers);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.tickets ?? res.body)).toBe(true);
  });

  it("USER não acessa a listagem geral (403)", async () => {
    const headers = await authFor("user");
    const res = await req().get("/api/tickets").set(headers);
    expect(res.status).toBe(403);
  });

  it("retorna 401 sem token", async () => {
    const res = await req().get("/api/tickets");
    expect(res.status).toBe(401);
  });
});

// ── Transições de status ──────────────────────────────────────────────────────

describe("POST /api/tickets/:id/transition", () => {
  it("TECHNICIAN avança OPEN → VIEWED", async () => {
    await createTicket();
    const ticketId = (await prisma.ticket.findFirst({ orderBy: { id: "desc" } })).id;

    const headers = await authFor("tech");
    const res = await req()
      .post(`/api/tickets/${ticketId}/transition`)
      .set(headers)
      .send({ toStatus: "VIEWED", unitId: unit.id, assignedTechId: USERS.tech.id });

    expect(res.status).toBe(200);
  });

  it("rejeita transição inválida OPEN → COMPLETED (400)", async () => {
    await createTicket();
    const ticketId = (await prisma.ticket.findFirst({ orderBy: { id: "desc" } })).id;

    const headers = await authFor("tech");
    const res = await req()
      .post(`/api/tickets/${ticketId}/transition`)
      .set(headers)
      .send({ toStatus: "COMPLETED" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Transição inválida/);
  });

  it("USER não pode fazer transição (403)", async () => {
    await createTicket();
    const ticketId = (await prisma.ticket.findFirst({ orderBy: { id: "desc" } })).id;

    const headers = await authFor("user");
    const res = await req()
      .post(`/api/tickets/${ticketId}/transition`)
      .set(headers)
      .send({ toStatus: "VIEWED" });

    expect(res.status).toBe(403);
  });

  it("percorre o fluxo completo OPEN → VIEWED → IN_SERVICE → COMPLETED", async () => {
    await createTicket();
    const ticket = await prisma.ticket.findFirst({ orderBy: { id: "desc" } });
    const id = ticket.id;
    const headers = await authFor("tech");

    const transitions = [
      { toStatus: "VIEWED",     unitId: unit.id, assignedTechId: USERS.tech.id },
      { toStatus: "IN_SERVICE" },
      { toStatus: "COMPLETED",  cause: "Causa teste", solution: "Solução teste" },
    ];
    for (const body of transitions) {
      const res = await req()
        .post(`/api/tickets/${id}/transition`)
        .set(headers)
        .send(body);
      expect(res.status).toBe(200);
    }

    const final = await prisma.ticket.findUnique({ where: { id } });
    expect(final.status).toBe("COMPLETED");
  });
});

// ── Aprovação ─────────────────────────────────────────────────────────────────

describe("POST /api/tickets/:id/approve", () => {
  it("CHEFE_SETOR aprova chamado pendente", async () => {
    const created = await createApprovalTicket();
    const ticketId = (await prisma.ticket.findFirst({ orderBy: { id: "desc" } })).id;

    const headers = await authFor("chefe");
    const res = await req()
      .post(`/api/tickets/${ticketId}/approve`)
      .set(headers)
      .send({ status: "APPROVED" });

    expect(res.status).toBe(200);
    expect(res.body.approvalStatus).toBe("APPROVED");
  });

  it("ADMIN pode aprovar chamado pendente", async () => {
    await createApprovalTicket();
    const ticketId = (await prisma.ticket.findFirst({ orderBy: { id: "desc" } })).id;

    const headers = await authFor("admin");
    const res = await req()
      .post(`/api/tickets/${ticketId}/approve`)
      .set(headers)
      .send({ status: "APPROVED" });

    expect(res.status).toBe(200);
  });

  it("USER não pode aprovar (403)", async () => {
    await createApprovalTicket();
    const ticketId = (await prisma.ticket.findFirst({ orderBy: { id: "desc" } })).id;

    const headers = await authFor("user");
    const res = await req()
      .post(`/api/tickets/${ticketId}/approve`)
      .set(headers)
      .send({ status: "APPROVED" });

    expect(res.status).toBe(403);
  });

  it("retorna 400 ao tentar aprovar chamado sem aprovação pendente", async () => {
    await createTicket(); // NOT_REQUIRED
    const ticketId = (await prisma.ticket.findFirst({ orderBy: { id: "desc" } })).id;

    const headers = await authFor("admin");
    const res = await req()
      .post(`/api/tickets/${ticketId}/approve`)
      .set(headers)
      .send({ status: "APPROVED" });

    expect(res.status).toBe(400);
  });

  it("CHEFE_SETOR pode rejeitar chamado", async () => {
    await createApprovalTicket();
    const ticketId = (await prisma.ticket.findFirst({ orderBy: { id: "desc" } })).id;

    const headers = await authFor("chefe");
    const res = await req()
      .post(`/api/tickets/${ticketId}/approve`)
      .set(headers)
      .send({ status: "REJECTED", note: "Não autorizado" });

    expect(res.status).toBe(200);
    expect(res.body.approvalStatus).toBe("REJECTED");
  });
});

// ── Rastreamento público ──────────────────────────────────────────────────────

describe("GET /api/tickets/track/:ticketNumber", () => {
  it("retorna dados do chamado pelo número público sem autenticação", async () => {
    await createTicket();
    const ticket = await prisma.ticket.findFirst({ orderBy: { id: "desc" } });

    const res = await req().get(`/api/tickets/track/${ticket.ticketNumber}`);
    expect(res.status).toBe(200);
    expect(res.body.ticketNumber).toBe(ticket.ticketNumber);
  });

  it("retorna 404 para número inexistente", async () => {
    const res = await req().get("/api/tickets/track/00000000-0000");
    expect(res.status).toBe(404);
  });
});
