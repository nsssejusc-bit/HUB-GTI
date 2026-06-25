CREATE TABLE `WorkOrderImage` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `workOrderId`  INT          NOT NULL,
  `filename`     VARCHAR(255) NOT NULL,
  `originalName` VARCHAR(255) NOT NULL,
  `size`         INT          NOT NULL,
  `createdById`  INT          NULL,
  `createdAt`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `WorkOrderImage_workOrderId_idx`(`workOrderId`),
  CONSTRAINT `WorkOrderImage_workOrderId_fkey`
    FOREIGN KEY (`workOrderId`) REFERENCES `WorkOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `WorkOrderImage_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
);
