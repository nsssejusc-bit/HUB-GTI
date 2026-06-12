import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";

// Em produção (Docker) aponta para o volume helpdesk_uploads montado em /app/uploads
const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.resolve("uploads");

// Prefixo gravado em TicketMessage.content quando o conteúdo é uma imagem em arquivo
export const IMG_PREFIX = "img:";

const EXT_BY_MIME = {
  "image/png":  "png",
  "image/jpeg": "jpg",
  "image/gif":  "gif",
  "image/webp": "webp",
};

const MIME_BY_EXT = Object.fromEntries(
  Object.entries(EXT_BY_MIME).map(([mime, ext]) => [ext, mime])
);

const DATA_URL_RE = /^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/=\s]+)$/;

// Decodifica um data-URL e persiste como arquivo. Retorna o nome do arquivo ou null se inválido.
export async function saveImageFromDataUrl(dataUrl, ticketId) {
  const match = dataUrl.match(DATA_URL_RE);
  if (!match) return null;

  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (buffer.length === 0) return null;

  const dir = path.join(UPLOAD_ROOT, "tickets", String(ticketId));
  await fs.mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}.${EXT_BY_MIME[match[1]]}`;
  await fs.writeFile(path.join(dir, filename), buffer);
  return filename;
}

// Resolve o caminho absoluto de uma imagem, recusando nomes com path traversal
export function resolveImagePath(ticketId, filename) {
  if (!/^[A-Za-z0-9-]+\.(png|jpg|gif|webp)$/.test(filename)) return null;
  return path.join(UPLOAD_ROOT, "tickets", String(ticketId), filename);
}

// Remove o diretório de imagens de um chamado (usado na exclusão do ticket)
export async function deleteTicketImages(ticketId) {
  const dir = path.join(UPLOAD_ROOT, "tickets", String(ticketId));
  await fs.rm(dir, { recursive: true, force: true });
}

export function mimeForFilename(filename) {
  const ext = filename.split(".").pop();
  return MIME_BY_EXT[ext] || "application/octet-stream";
}
