-- Add GTI chief flag to User
ALTER TABLE `User` ADD COLUMN `isGtiChief` BOOLEAN NOT NULL DEFAULT false;

-- Add linked OS type to Subcategory for auto-creation on approval
ALTER TABLE `Subcategory` ADD COLUMN `linkedOsTypeId` INT NULL;
ALTER TABLE `Subcategory` ADD CONSTRAINT `Subcategory_linkedOsTypeId_fkey`
  FOREIGN KEY (`linkedOsTypeId`) REFERENCES `WorkOrderType`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Make chefDeptId nullable in TicketApproval (GTI approvals have no department)
ALTER TABLE `TicketApproval` MODIFY COLUMN `chefDeptId` INT NULL;

-- Flag to distinguish GTI approval records from department-chief records
ALTER TABLE `TicketApproval` ADD COLUMN `isGtiApproval` BOOLEAN NOT NULL DEFAULT false;
