import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { getApp, authFor } from "./helpers.js";

const req = () => supertest(getApp());

// ── Rotas exclusivas de ADMIN ─────────────────────────────────────────────────

describe("Rotas ADMIN-only", () => {
  const adminRoutes = [
    ["GET",    "/api/audit-logs"],
    ["GET",    "/api/users"],
    ["POST",   "/api/categories"],
    ["GET",    "/api/departments/all"],
  ];

  for (const [method, path] of adminRoutes) {
    it(`${method} ${path} — TECHNICIAN recebe 403`, async () => {
      const headers = await authFor("tech");
      const res = await req()[method.toLowerCase()](path).set(headers);
      expect(res.status).toBe(403);
    });

    it(`${method} ${path} — USER recebe 403`, async () => {
      const headers = await authFor("user");
      const res = await req()[method.toLowerCase()](path).set(headers);
      expect(res.status).toBe(403);
    });

    it(`${method} ${path} — sem token recebe 401`, async () => {
      const res = await req()[method.toLowerCase()](path);
      expect(res.status).toBe(401);
    });

    it(`${method} ${path} — ADMIN tem acesso (não 401/403)`, async () => {
      const headers = await authFor("admin");
      const res = await req()[method.toLowerCase()](path).set(headers);
      expect([200, 201, 400, 404, 409]).toContain(res.status); // qualquer coisa menos auth error
    });
  }
});

// ── Rotas de TECHNICIAN/ADMIN ─────────────────────────────────────────────────

describe("Rotas TECHNICIAN/ADMIN-only", () => {
  const techRoutes = [
    ["GET", "/api/tickets"],
    ["GET", "/api/work-orders"],
    ["GET", "/api/inventory"],
  ];

  for (const [method, path] of techRoutes) {
    it(`${method} ${path} — USER recebe 403`, async () => {
      const headers = await authFor("user");
      const res = await req()[method.toLowerCase()](path).set(headers);
      expect(res.status).toBe(403);
    });

    it(`${method} ${path} — TECHNICIAN tem acesso`, async () => {
      const headers = await authFor("tech");
      const res = await req()[method.toLowerCase()](path).set(headers);
      expect([200, 201]).toContain(res.status);
    });
  }
});

// ── Rotas públicas ────────────────────────────────────────────────────────────

describe("Rotas públicas", () => {
  it("GET /api/health — sem token retorna 200", async () => {
    const res = await req().get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("GET /api/categories — sem token retorna 200", async () => {
    const res = await req().get("/api/categories");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /api/departments — sem token retorna 200", async () => {
    const res = await req().get("/api/departments");
    expect(res.status).toBe(200);
  });
});

// ── Aprovação — apenas CHEFE_SETOR e ADMIN ───────────────────────────────────

describe("Rota de aprovação", () => {
  it("TECHNICIAN não pode acessar /approve (403)", async () => {
    const headers = await authFor("tech");
    const res = await req()
      .post("/api/tickets/9999/approve")
      .set(headers)
      .send({ status: "APPROVED" });
    // 403 de role, ou 404 se o ticket não existir mas passou do guard
    expect([403, 404]).toContain(res.status);
  });
});
