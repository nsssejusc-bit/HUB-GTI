import "dotenv/config";
import http from "http";
import jwt from "jsonwebtoken";
import { Server as SocketServer } from "socket.io";
import { createApp } from "./app.js";

if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET não está definido. Encerrando.");
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.warn("AVISO: JWT_SECRET muito curto — recomendado mínimo de 32 caracteres.");
}

const allowedOrigin = process.env.CORS_ORIGIN;
if (!allowedOrigin) {
  console.warn("AVISO: CORS_ORIGIN não definido — aceitando qualquer origem (somente dev)");
}

const app    = createApp();
const server = http.createServer(app);
const io     = new SocketServer(server, {
  cors: { origin: allowedOrigin || "*", credentials: true, methods: ["GET", "POST"] },
});

io.use((socket, next) => {
  const cookie = socket.handshake.headers.cookie || "";
  const match  = cookie.match(/hd_token=([^;]+)/);
  const token  = match?.[1];
  if (!token) return next(new Error("auth_required"));
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new Error("auth_invalid"));
  }
});

app.set("io", io);

const PORT = Number(process.env.PORT || 3333);
server.listen(PORT, () => {
  console.log(`HelpDesk API rodando em http://localhost:${PORT}`);
});
