-- CreateTable Asset
CREATE TABLE `Asset` (
  `id`              INT NOT NULL AUTO_INCREMENT,
  `tombo`           VARCHAR(191) NOT NULL,
  `hostname`        VARCHAR(191) NOT NULL,
  `cpu`             VARCHAR(191) NOT NULL,
  `ram`             VARCHAR(191) NOT NULL,
  `storage`         VARCHAR(191) NOT NULL,
  `operatingSystem` VARCHAR(191) NOT NULL,
  `status`          ENUM('ATIVO','INATIVO','MANUTENCAO','RECOLHIDO') NOT NULL DEFAULT 'ATIVO',
  `setor`           VARCHAR(191) NULL,
  `responsavel`     VARCHAR(191) NULL,
  `notes`           TEXT NULL,
  `createdAt`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `createdById`     INT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `Asset_tombo_key`(`tombo`),
  INDEX `Asset_status_idx`(`status`),
  INDEX `Asset_createdById_idx`(`createdById`),
  CONSTRAINT `Asset_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable AssetAllocation
CREATE TABLE `AssetAllocation` (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `assetId`     INT NOT NULL,
  `setor`       VARCHAR(191) NULL,
  `responsavel` VARCHAR(191) NULL,
  `notes`       TEXT NULL,
  `startedAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `endedAt`     DATETIME(3) NULL,
  `createdById` INT NULL,
  PRIMARY KEY (`id`),
  INDEX `AssetAllocation_assetId_idx`(`assetId`),
  INDEX `AssetAllocation_endedAt_idx`(`endedAt`),
  INDEX `AssetAllocation_createdById_idx`(`createdById`),
  CONSTRAINT `AssetAllocation_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Asset`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `AssetAllocation_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
