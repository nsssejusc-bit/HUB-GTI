-- Make tombo nullable on Asset (a PC may have no tombamento but must have a hostname)
ALTER TABLE `Asset` MODIFY COLUMN `tombo` VARCHAR(191) NULL;

-- Add problema and solucao fields to WorkOrder
ALTER TABLE `WorkOrder` ADD COLUMN `problema` LONGTEXT NULL;
ALTER TABLE `WorkOrder` ADD COLUMN `solucao` LONGTEXT NULL;
