// Mensagens com imagem: novas vêm como URL da API; antigas ainda são base64 inline
export const isImageMessage = (content) =>
  content.startsWith("data:image/") ||
  (content.startsWith("/api/") && content.endsWith("/image"));
