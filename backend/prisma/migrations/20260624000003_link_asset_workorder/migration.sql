-- Link WorkOrder → Asset
ALTER TABLE `WorkOrder` ADD COLUMN `assetId` INT NULL;
ALTER TABLE `WorkOrder` ADD INDEX `WorkOrder_assetId_idx`(`assetId`);
ALTER TABLE `WorkOrder` ADD CONSTRAINT `WorkOrder_assetId_fkey`
  FOREIGN KEY (`assetId`) REFERENCES `Asset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Link AssetAllocation → WorkOrder
ALTER TABLE `AssetAllocation` ADD COLUMN `workOrderId` INT NULL;
ALTER TABLE `AssetAllocation` ADD INDEX `AssetAllocation_workOrderId_idx`(`workOrderId`);
ALTER TABLE `AssetAllocation` ADD CONSTRAINT `AssetAllocation_workOrderId_fkey`
  FOREIGN KEY (`workOrderId`) REFERENCES `WorkOrder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
