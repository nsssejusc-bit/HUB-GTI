-- Adiciona matrícula e e-mail do solicitante ao ticket (capturados na criação)
ALTER TABLE `Ticket`
  ADD COLUMN `requesterMatricula` VARCHAR(191) NULL,
  ADD COLUMN `requesterEmail`     VARCHAR(191) NULL;
