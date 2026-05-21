-- AlterTable: add defaultPriority to Category
ALTER TABLE `Category` ADD COLUMN `defaultPriority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM';

-- AlterTable: add defaultPriority to Subcategory
ALTER TABLE `Subcategory` ADD COLUMN `defaultPriority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM';
