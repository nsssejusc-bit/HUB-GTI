import "express-async-errors";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import routes from "./routes/index.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);

  // No-op io — sobrescrito com o Socket.io real em server.js
  app.set("io", { emit: () => {}, to: () => ({ emit: () => {} }) });

  app.use(cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }));
  app.use(cookieParser());
  app.use(express.json({ limit: "5mb" }));

  app.get("/api/health", (_, res) => res.json({ ok: true, service: "helpdesk-sejusc" }));
  app.use("/api", routes);

  app.use((err, req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Erro interno do servidor" });
  });

  return app;
}
