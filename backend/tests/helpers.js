import supertest from "supertest";
import { createApp } from "../src/app.js";
import { USERS } from "./setup.js";

// Instância única do app para todos os testes
let _app;
export function getApp() {
  if (!_app) _app = createApp();
  return _app;
}

// Cache de tokens por papel — cada papel faz login uma única vez por suite
const _tokenCache = {};

export async function getToken(role) {
  if (_tokenCache[role]) return _tokenCache[role];

  const creds = USERS[role];
  const res = await supertest(getApp())
    .post("/api/auth/login")
    .send({ cpf: creds.cpf, password: creds.password });

  if (res.status !== 200) {
    throw new Error(`Login falhou para role ${role}: ${JSON.stringify(res.body)}`);
  }

  // Extrai o token do cookie hd_token
  const cookie = (res.headers["set-cookie"] || []).find((c) => c.startsWith("hd_token=")) || "";
  const token  = cookie.match(/hd_token=([^;]+)/)?.[1];
  if (!token) throw new Error(`Token não encontrado na resposta de login para ${role}`);

  _tokenCache[role] = token;
  return token;
}

// Retorna header Authorization: Bearer <token>
export async function authFor(role) {
  const token = await getToken(role);
  return { Authorization: `Bearer ${token}` };
}

// Limpa o cache (use se precisar forçar novo login entre testes)
export function clearTokenCache() {
  Object.keys(_tokenCache).forEach((k) => delete _tokenCache[k]);
}
