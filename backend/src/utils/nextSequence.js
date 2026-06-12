import { prisma } from "../config/prisma.js";

async function nextSeq(column) {
  // Statement único e atômico: cria a linha do dia já com seq 1 ou incrementa a existente.
  // INSERT IGNORE + UPDATE separados causavam deadlock (1213) sob concorrência
  // (lock S na chave duplicada seguido de lock X na mesma linha).
  // LAST_INSERT_ID(expr) registra o valor na sessão para leitura logo em seguida —
  // a transação interativa fixa uma única conexão do pool entre os dois statements,
  // senão o SELECT poderia ler o valor de outra requisição.
  return prisma.$transaction(async (tx) => {
    if (column === "ticket") {
      await tx.$executeRaw`
        INSERT INTO DailyCounter (\`date\`, ticketCount, osCount)
        VALUES (CURDATE(), LAST_INSERT_ID(1), 0)
        ON DUPLICATE KEY UPDATE ticketCount = LAST_INSERT_ID(ticketCount + 1)
      `;
    } else {
      await tx.$executeRaw`
        INSERT INTO DailyCounter (\`date\`, ticketCount, osCount)
        VALUES (CURDATE(), 0, LAST_INSERT_ID(1))
        ON DUPLICATE KEY UPDATE osCount = LAST_INSERT_ID(osCount + 1)
      `;
    }

    const [{ seq }] = await tx.$queryRaw`SELECT LAST_INSERT_ID() AS seq`;
    return Number(seq);
  });
}

export const nextTicketSeq = () => nextSeq("ticket");
export const nextOsSeq     = () => nextSeq("os");
