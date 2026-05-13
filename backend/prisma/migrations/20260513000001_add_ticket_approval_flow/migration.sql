-- Subcategoria: novos campos para controle de fluxo
ALTER TABLE `Subcategory`
  ADD COLUMN `code`               VARCHAR(191) NULL,
  ADD COLUMN `requiresApproval`   TINYINT(1)   NOT NULL DEFAULT 0,
  ADD COLUMN `dualApproval`       TINYINT(1)   NOT NULL DEFAULT 0,
  ADD COLUMN `requiresPresential` TINYINT(1)   NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX `Subcategory_code_key` ON `Subcategory`(`code`);

-- Ticket: status de aprovação, dados extras e flag presencial
ALTER TABLE `Ticket`
  ADD COLUMN `extraData`      JSON NULL,
  ADD COLUMN `approvalStatus` ENUM('NOT_REQUIRED','PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN `approvalNote`   TEXT NULL,
  ADD COLUMN `presential`     TINYINT(1) NOT NULL DEFAULT 1;

CREATE INDEX `Ticket_approvalStatus_idx` ON `Ticket`(`approvalStatus`);

-- Tabela de aprovações por departamento
CREATE TABLE `TicketApproval` (
  `id`         INT          NOT NULL AUTO_INCREMENT,
  `ticketId`   INT          NOT NULL,
  `chefDeptId` INT          NOT NULL,
  `chefUserId` INT          NULL,
  `status`     ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `note`       TEXT         NULL,
  `decidedAt`  DATETIME(3)  NULL,
  `createdAt`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `TicketApproval_ticketId_idx`          (`ticketId`),
  INDEX `TicketApproval_chefDeptId_status_idx` (`chefDeptId`, `status`),
  CONSTRAINT `TicketApproval_ticketId_fkey`   FOREIGN KEY (`ticketId`)   REFERENCES `Ticket`(`id`)     ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT `TicketApproval_chefDeptId_fkey` FOREIGN KEY (`chefDeptId`) REFERENCES `Department`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `TicketApproval_chefUserId_fkey` FOREIGN KEY (`chefUserId`) REFERENCES `User`(`id`)       ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
