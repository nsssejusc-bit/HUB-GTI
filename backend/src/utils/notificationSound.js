import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";

// Em produção (Docker) aponta para o volume helpdesk_uploads montado em /app/uploads
const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.resolve("uploads");
const SOUND_DIR = path.join(UPLOAD_ROOT, "notification-sounds");

const EXT_BY_MIME = {
  "audio/mpeg": "mp3",
  "audio/mp3":  "mp3",
  "audio/wav":  "wav",
  "audio/x-wav": "wav",
  "audio/ogg":  "ogg",
  "audio/mp4":  "m4a",
  "audio/x-m4a": "m4a",
};

const MIME_BY_EXT = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
};

const DATA_URL_RE = /^data:(audio\/[a-z0-9-]+);base64,([A-Za-z0-9+/=\s]+)$/i;

export const MAX_AUDIO_B64 = 3 * 1024 * 1024; // 3 MB base64 ≈ 2.2 MB de arquivo

// Decodifica um data-URL de áudio e persiste como arquivo. Retorna o nome do arquivo ou null se inválido.
export async function saveNotificationSound(dataUrl, userId) {
  const match = dataUrl.match(DATA_URL_RE);
  if (!match || !EXT_BY_MIME[match[1].toLowerCase()]) return null;

  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (buffer.length === 0) return null;

  const dir = path.join(SOUND_DIR, String(userId));
  await fs.mkdir(dir, { recursive: true });

  // Cada usuário tem apenas um áudio customizado — remove o anterior antes de salvar
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}.${EXT_BY_MIME[match[1].toLowerCase()]}`;
  await fs.writeFile(path.join(dir, filename), buffer);
  return filename;
}

// Resolve o caminho absoluto do áudio customizado do usuário, recusando nomes com path traversal
export function resolveNotificationSoundPath(userId, filename) {
  if (!/^[A-Za-z0-9-]+\.(mp3|wav|ogg|m4a)$/.test(filename)) return null;
  return path.join(SOUND_DIR, String(userId), filename);
}

export async function deleteNotificationSoundFile(userId) {
  await fs.rm(path.join(SOUND_DIR, String(userId)), { recursive: true, force: true });
}

export function mimeForSoundFilename(filename) {
  const ext = filename.split(".").pop();
  return MIME_BY_EXT[ext] || "application/octet-stream";
}
