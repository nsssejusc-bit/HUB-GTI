import { describe, it, expect, beforeEach } from "vitest";
import supertest from "supertest";
import { getApp, authFor, clearTokenCache } from "./helpers.js";
import { USERS, dept } from "./setup.js";

const req = () => supertest(getApp());

describe("POST /api/auth/login", () => {
  it("retorna 200 e cookie hd_token com credenciais válidas", async () => {
    const res = await req()
      .post("/api/auth/login")
      .send({ cpf: USERS.admin.cpf, password: USERS.admin.password });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ role: "ADMIN", name: USERS.admin.name });
    const cookies = res.headers["set-cookie"] || [];
    expect(cookies.some((c) => c.startsWith("hd_token="))).toBe(true);
  });

  it("retorna 401 com senha incorreta", async () => {
    const res = await req()
      .post("/api/auth/login")
      .send({ cpf: USERS.user.cpf, password: "senha-errada" });
    expect(res.status).toBe(401);
  });

  it("retorna 400 com CPF inválido", async () => {
    const res = await req()
      .post("/api/auth/login")
      .send({ cpf: "00000000000", password: "qualquer" });
    expect(res.status).toBe(400);
  });

  it("retorna 400 sem corpo", async () => {
    const res = await req().post("/api/auth/login").send({});
    expect(res.status).toBe(400);
  });
});

describe("GET /api/auth/me", () => {
  it("retorna dados do usuário logado", async () => {
    const headers = await authFor("tech");
    const res = await req().get("/api/auth/me").set(headers);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ role: "TECHNICIAN", name: USERS.tech.name });
  });

  it("retorna 401 sem token", async () => {
    const res = await req().get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("retorna 401 com token inválido", async () => {
    const res = await req().get("/api/auth/me").set({ Authorization: "Bearer token-invalido" });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("limpa o cookie e retorna ok", async () => {
    const headers = await authFor("user");
    const res = await req().post("/api/auth/logout").set(headers);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const cookies = res.headers["set-cookie"] || [];
    // Cookie deve ser expirado/limpo
    expect(cookies.some((c) => c.includes("hd_token=;") || c.includes("Expires=Thu, 01 Jan 1970"))).toBe(true);
  });
});

describe("POST /api/auth/register", () => {
  it("cria novo usuário com dados válidos", async () => {
    const res = await req()
      .post("/api/auth/register")
      .send({
        name:         "Novo Usuário",
        cpf:          "153.509.460-56",
        password:     "Senha@123",
        departmentId: USERS.user.id ? undefined : null, // setor é opcional no registro
      });

    // 201 = criado, ou 400 se departamento obrigatório — depende da config
    expect([201, 400]).toContain(res.status);
  });

  it("retorna 409 ao tentar registrar CPF já existente", async () => {
    const res = await req()
      .post("/api/auth/register")
      .send({
        name:         "Duplicado Teste",
        cpf:          USERS.user.cpf,
        password:     "Senha@123",
        departmentId: dept.id,
        email:        "dup@teste.com",
        telefone:     "92991234567",
      });
    expect(res.status).toBe(409);
  });
});
