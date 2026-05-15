-- Sistema de inventário: itens e movimentações

-- Tabela de itens do inventário
CREATE TABLE `InventoryItem` (
  `id`          INT AUTO_INCREMENT NOT NULL,
  `name`        VARCHAR(191) NOT NULL,
  `code`        VARCHAR(191) NULL,
  `description` TEXT NULL,
  `quantity`    INT NOT NULL DEFAULT 0,
  `unitMeasure` VARCHAR(191) NOT NULL DEFAULT 'un',
  `category`    VARCHAR(191) NULL,
  `status`      ENUM('ATIVO','INATIVO') NOT NULL DEFAULT 'ATIVO',
  `createdAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `createdById` INT NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `InventoryItem_status_idx` (`status`),
  INDEX `InventoryItem_code_idx` (`code`),
  INDEX `InventoryItem_category_idx` (`category`),
  CONSTRAINT `InventoryItem_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User` (`id`) ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Tabela de movimentações do inventário
CREATE TABLE `InventoryMovement` (
  `id`          INT AUTO_INCREMENT NOT NULL,
  `itemId`      INT NOT NULL,
  `type`        ENUM('ENTRADA','SAIDA','AJUSTE') NOT NULL,
  `quantity`    INT NOT NULL,
  `note`        TEXT NULL,
  `createdAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdById` INT NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `InventoryMovement_itemId_idx` (`itemId`),
  INDEX `InventoryMovement_createdAt_idx` (`createdAt`),
  CONSTRAINT `InventoryMovement_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `InventoryItem` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `InventoryMovement_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User` (`id`) ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
