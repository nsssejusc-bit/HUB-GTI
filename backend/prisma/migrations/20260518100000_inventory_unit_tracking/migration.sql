-- Migração: modelo de inventário por unidade individual (tombo/SN)

-- 1. Criar tabela InventoryUnit
CREATE TABLE `InventoryUnit` (
  `id`          INT AUTO_INCREMENT NOT NULL,
  `itemId`      INT NOT NULL,
  `tombo`       VARCHAR(191) NULL,
  `status`      ENUM('DISPONIVEL','EM_USO','INATIVO') NOT NULL DEFAULT 'DISPONIVEL',
  `note`        TEXT NULL,
  `createdAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `createdById` INT NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `InventoryUnit_itemId_idx` (`itemId`),
  INDEX `InventoryUnit_status_idx` (`status`),
  INDEX `InventoryUnit_tombo_idx` (`tombo`),
  CONSTRAINT `InventoryUnit_itemId_fkey`
    FOREIGN KEY (`itemId`) REFERENCES `InventoryItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `InventoryUnit_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Migrar itens existentes: criar uma unidade por item com quantity > 0
--    usando o code como tombo se disponível
INSERT INTO `InventoryUnit` (`itemId`, `tombo`, `status`, `createdAt`, `updatedAt`, `createdById`)
SELECT `id`, `code`, 'DISPONIVEL', NOW(3), NOW(3), `createdById`
FROM `InventoryItem`
WHERE `quantity` > 0;

-- 3. Limpar itens de checklist existentes (migração destrutiva — dado legado incompatível)
DELETE FROM `InventoryChecklistItem`;

-- 4. Adicionar coluna unitId em InventoryChecklistItem
ALTER TABLE `InventoryChecklistItem`
  ADD COLUMN `unitId` INT NOT NULL DEFAULT 0;

-- 5. Remover colunas antigas de InventoryChecklistItem
ALTER TABLE `InventoryChecklistItem`
  DROP FOREIGN KEY `InventoryChecklistItem_itemId_fkey`,
  DROP INDEX `InventoryChecklistItem_itemId_idx`,
  DROP COLUMN `itemId`,
  DROP COLUMN `quantity`;

-- 6. Remover DEFAULT temporário e adicionar FK em unitId
ALTER TABLE `InventoryChecklistItem`
  ALTER COLUMN `unitId` DROP DEFAULT;

ALTER TABLE `InventoryChecklistItem`
  ADD INDEX `InventoryChecklistItem_unitId_idx` (`unitId`),
  ADD CONSTRAINT `InventoryChecklistItem_unitId_fkey`
    FOREIGN KEY (`unitId`) REFERENCES `InventoryUnit`(`id`) ON UPDATE CASCADE;

-- 7. Remover colunas quantity e code de InventoryItem
ALTER TABLE `InventoryItem`
  DROP COLUMN `quantity`,
  DROP COLUMN `code`;

-- 8. O índice InventoryItem_code_idx é removido automaticamente ao dropar a coluna code acima
