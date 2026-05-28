-- Aumenta o limite da coluna content de TEXT (64 KB) para LONGTEXT (4 GB)
-- necessário para armazenar imagens em base64 (~3 MB por screenshot)
ALTER TABLE `TicketMessage`
  MODIFY COLUMN `content` LONGTEXT NOT NULL;
