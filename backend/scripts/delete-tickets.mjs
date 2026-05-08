/**
 * Uso:
 *   Listar todos os chamados:
 *     docker compose exec backend node scripts/delete-tickets.mjs
 *
 *   Excluir por número de protocolo (um ou mais):
 *     docker compose exec backend node scripts/delete-tickets.mjs 20260507-0001 20260507-0002
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const args = process.argv.slice(2);

async function main() {
  if (args.length === 0) {
    // Modo listagem
    const tickets = await prisma.ticket.findMany({
      orderBy: { openedAt: "desc" },
      select: {
        id: true,
        ticketNumber: true,
        status: true,
        requesterName: true,
        department: true,
        openedAt: true,
      },
    });

    if (tickets.length === 0) {
      console.log("Nenhum chamado encontrado no banco.");
      return;
    }

    console.log(`\n${"#".padEnd(6)} ${"Protocolo".padEnd(18)} ${"Status".padEnd(12)} ${"Solicitante".padEnd(25)} Setor`);
    console.log("-".repeat(90));
    for (const t of tickets) {
      const date = new Date(t.openedAt).toLocaleDateString("pt-BR");
      console.log(
        `${String(t.id).padEnd(6)} ${t.ticketNumber.padEnd(18)} ${t.status.padEnd(12)} ${t.requesterName.slice(0, 24).padEnd(25)} ${t.department}`
      );
    }
    console.log(`\nTotal: ${tickets.length} chamado(s)`);
    console.log('\nPara excluir: node scripts/delete-tickets.mjs <protocolo1> [protocolo2 ...]');

  } else {
    // Modo exclusão
    let deleted = 0;
    let notFound = 0;

    for (const ticketNumber of args) {
      const ticket = await prisma.ticket.findUnique({ where: { ticketNumber } });
      if (!ticket) {
        console.log(`[NÃO ENCONTRADO] ${ticketNumber}`);
        notFound++;
        continue;
      }
      await prisma.ticket.delete({ where: { ticketNumber } });
      console.log(`[EXCLUÍDO] ${ticketNumber} — ${ticket.requesterName} (${ticket.status})`);
      deleted++;
    }

    console.log(`\nResultado: ${deleted} excluído(s), ${notFound} não encontrado(s).`);
  }
}

main()
  .catch((e) => { console.error("Erro:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
