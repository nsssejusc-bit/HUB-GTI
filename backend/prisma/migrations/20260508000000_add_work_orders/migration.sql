-- CreateTable
CREATE TABLE `WorkOrder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `osNumber` VARCHAR(191) NOT NULL,
    `tipo` ENUM('VISITA_TECNICA', 'TROCA_EQUIPAMENTO', 'ENTREGA', 'MANUTENCAO_REDE', 'MANUTENCAO_CAMERA', 'OUTRO') NOT NULL,
    `status` ENUM('ABERTA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA') NOT NULL DEFAULT 'ABERTA',
    `local` VARCHAR(191) NOT NULL,
    `problema` TEXT NULL,
    `materiais` TEXT NULL,
    `prazo` DATETIME(3) NULL,
    `relatorio` TEXT NULL,
    `unitId` INTEGER NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `startedAt` DATETIME(3) NULL,
    `concludedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,

    UNIQUE INDEX `WorkOrder_osNumber_key`(`osNumber`),
    INDEX `WorkOrder_status_idx`(`status`),
    INDEX `WorkOrder_unitId_idx`(`unitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OsTecnico` (
    `osId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,

    PRIMARY KEY (`osId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketWorkOrder` (
    `ticketId` INTEGER NOT NULL,
    `workOrderId` INTEGER NOT NULL,

    PRIMARY KEY (`ticketId`, `workOrderId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OsHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `osId` INTEGER NOT NULL,
    `actorId` INTEGER NULL,
    `fromStatus` ENUM('ABERTA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA') NULL,
    `toStatus` ENUM('ABERTA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA') NOT NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OsHistory_osId_idx`(`osId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WorkOrder` ADD CONSTRAINT `WorkOrder_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkOrder` ADD CONSTRAINT `WorkOrder_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OsTecnico` ADD CONSTRAINT `OsTecnico_osId_fkey` FOREIGN KEY (`osId`) REFERENCES `WorkOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OsTecnico` ADD CONSTRAINT `OsTecnico_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketWorkOrder` ADD CONSTRAINT `TicketWorkOrder_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `Ticket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketWorkOrder` ADD CONSTRAINT `TicketWorkOrder_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `WorkOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OsHistory` ADD CONSTRAINT `OsHistory_osId_fkey` FOREIGN KEY (`osId`) REFERENCES `WorkOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OsHistory` ADD CONSTRAINT `OsHistory_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
