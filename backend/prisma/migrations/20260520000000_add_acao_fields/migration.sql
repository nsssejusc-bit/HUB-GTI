-- AlterTable WorkOrder: add Ação-specific fields
ALTER TABLE `WorkOrder`
  ADD COLUMN `nomeEvento`     TEXT         NULL,
  ADD COLUMN `startDateTime`  DATETIME(3)  NULL,
  ADD COLUMN `endDateTime`    DATETIME(3)  NULL,
  ADD COLUMN `checklistId`    INT          NULL,
  ADD COLUMN `preVisitaId`    INT          NULL;

-- Unique constraint for checklist (1:1 with WorkOrder)
CREATE UNIQUE INDEX `WorkOrder_checklistId_key` ON `WorkOrder`(`checklistId`);

-- Index for pre-visit lookup
CREATE INDEX `WorkOrder_preVisitaId_idx` ON `WorkOrder`(`preVisitaId`);

-- Foreign key: WorkOrder → InventoryChecklist
ALTER TABLE `WorkOrder`
  ADD CONSTRAINT `WorkOrder_checklistId_fkey`
  FOREIGN KEY (`checklistId`) REFERENCES `InventoryChecklist`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign key: WorkOrder → WorkOrder (self-reference for pre-visit)
ALTER TABLE `WorkOrder`
  ADD CONSTRAINT `WorkOrder_preVisitaId_fkey`
  FOREIGN KEY (`preVisitaId`) REFERENCES `WorkOrder`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
