-- Núcleo e checklists de inventário

-- Adiciona núcleo ao item de inventário
ALTER TABLE `InventoryItem`
  ADD COLUMN `nucleo` ENUM('NMT','NIR') NULL,
  ADD INDEX `InventoryItem_nucleo_idx` (`nucleo`);

-- Adiciona responsável de núcleo ao usuário
ALTER TABLE `User`
  ADD COLUMN `nucleoResponsavel` ENUM('NMT','NIR') NULL;

-- Tabela de checklists
CREATE TABLE `InventoryChecklist` (
  `id`           INT AUTO_INCREMENT NOT NULL,
  `title`        VARCHAR(191) NOT NULL,
  `nucleo`       ENUM('NMT','NIR') NOT NULL,
  `note`         TEXT NULL,
  `status`       ENUM('PENDENTE','APROVADO','REJEITADO') NOT NULL DEFAULT 'PENDENTE',
  `approvedById` INT NULL,
  `approvedAt`   DATETIME(3) NULL,
  `rejectedNote` TEXT NULL,
  `createdAt`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdById`  INT NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `InventoryChecklist_status_idx` (`status`),
  INDEX `InventoryChecklist_nucleo_idx` (`nucleo`),
  INDEX `InventoryChecklist_createdAt_idx` (`createdAt`),
  CONSTRAINT `InventoryChecklist_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `InventoryChecklist_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User` (`id`) ON UPDATE CASCADE ON DELETE SET NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Itens do checklist
CREATE TABLE `InventoryChecklistItem` (
  `id`          INT AUTO_INCREMENT NOT NULL,
  `checklistId` INT NOT NULL,
  `itemId`      INT NOT NULL,
  `quantity`    INT NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `InventoryChecklistItem_checklistId_idx` (`checklistId`),
  INDEX `InventoryChecklistItem_itemId_idx` (`itemId`),
  CONSTRAINT `InventoryChecklistItem_checklistId_fkey` FOREIGN KEY (`checklistId`) REFERENCES `InventoryChecklist` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `InventoryChecklistItem_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `InventoryItem` (`id`) ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
