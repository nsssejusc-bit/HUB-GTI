// Migração única: converte mensagens com imagem base64 no banco para arquivos em disco.
// Rodar dentro do container backend: node scripts/migrate-message-images.js
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";
import { IMG_PREFIX, saveImageFromDataUrl } from "../src/utils/messageImages.js";

const BATCH = 20;

async function run() {
  let migrated = 0;
  let failed = 0;

  for (;;) {
    const msgs = await prisma.ticketMessage.findMany({
      where: { content: { startsWith: "data:image/" } },
      select: { id: true, ticketId: true, content: true },
      take: BATCH,
    });
    if (msgs.length === 0) break;

    for (const msg of msgs) {
      const filename = await saveImageFromDataUrl(msg.content, msg.ticketId);
      if (!filename) {
        // data-URL corrompido — substitui por placeholder para não reprocessar
        await prisma.ticketMessage.update({
          where: { id: msg.id },
          data: { content: "[imagem inválida removida]" },
        });
        failed++;
        continue;
      }
      await prisma.ticketMessage.update({
        where: { id: msg.id },
        data: { content: `${IMG_PREFIX}${filename}` },
      });
      migrated++;
    }
    console.log(`Progresso: ${migrated} migradas, ${failed} inválidas...`);
  }

  console.log(`Concluído. ${migrated} imagens migradas para disco, ${failed} inválidas.`);
  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
