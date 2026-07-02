CREATE TABLE `DepartmentChief` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `userId`       INT          NOT NULL,
  `departmentId` INT          NOT NULL,
  `createdAt`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `DepartmentChief_userId_departmentId_key` (`userId`, `departmentId`),
  KEY `DepartmentChief_departmentId_idx` (`departmentId`),
  CONSTRAINT `DepartmentChief_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `DepartmentChief_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Chefes de setor existentes viram chefes do seu setor atual (User.departmentId)
INSERT INTO `DepartmentChief` (`userId`, `departmentId`)
SELECT `id`, `departmentId` FROM `User` WHERE `role` = 'CHEFE_SETOR' AND `departmentId` IS NOT NULL;
