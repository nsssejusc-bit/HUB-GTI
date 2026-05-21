/**
 * initSeed.js
 * Executa o seed APENAS na primeira vez (banco vazio).
 * Em restarts normais, não toca nos dados existentes.
 */
import { PrismaClient } from "@prisma/client";
import { execSync }     from "child_process";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.user.count();
  if (count === 0) {
    console.log("🌱 Banco vazio — executando seed inicial...");
    execSync("node prisma/seed.js", { stdio: "inherit" });
  } else {
    console.log(`✅ Banco já populado (${count} usuário(s)) — seed ignorado.`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
