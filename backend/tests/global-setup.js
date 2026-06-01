import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import mysql from "mysql2/promise";

const ROOT     = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rootEnv  = dotenv.config({ path: resolve(ROOT, "../.env") }).parsed ?? {};
const password = rootEnv.MYSQL_ROOT_PASSWORD || "root";
const testDbUrl = `mysql://root:${password}@localhost:3303/helpdesk_test`;

export async function setup() {
  // Recria o banco de teste do zero para garantir estado limpo
  const conn = await mysql.createConnection({ host: "localhost", port: 3303, user: "root", password });
  await conn.execute("DROP DATABASE IF EXISTS helpdesk_test");
  await conn.execute("CREATE DATABASE helpdesk_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
  await conn.end();

  // Aplica todas as migrations do Prisma no banco de teste
  execSync("npx prisma migrate deploy", {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: testDbUrl },
    stdio: "inherit",
  });

  // Garante que o Prisma Client reflete o schema atual
  execSync("npx prisma generate", {
    cwd: ROOT,
    env: { ...process.env },
    stdio: "inherit",
  });
}
