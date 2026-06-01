import { defineConfig } from "vitest/config";
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Usa as credenciais do .env raiz, trocando apenas o banco para helpdesk_test
const rootEnv = dotenv.config({ path: resolve(__dirname, "../.env") }).parsed ?? {};
const rootPassword = rootEnv.MYSQL_ROOT_PASSWORD || "root";
const testDbUrl = `mysql://root:${rootPassword}@localhost:3303/helpdesk_test`;

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.js"],
    globalSetup: ["./tests/global-setup.js"],
    testTimeout: 20000,
    env: {
      DATABASE_URL: testDbUrl,
      JWT_SECRET: rootEnv.JWT_SECRET || "test-secret-for-vitest-needs-32-chars-min!",
      NODE_ENV: "test",
    },
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
