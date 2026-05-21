CREATE TABLE `TicketMessage` (
  `id`        INT           NOT NULL AUTO_INCREMENT,
  `ticketId`  INT           NOT NULL,
  `authorId`  INT           NULL,
  `fromUser`  BOOLEAN       NOT NULL DEFAULT false,
  `content`   TEXT          NOT NULL,
  `createdAt` DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `TicketMessage_ticketId_idx` (`ticketId`),
  CONSTRAINT `TicketMessage_ticketId_fkey`
    FOREIGN KEY (`ticketId`) REFERENCES `Ticket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `TicketMessage_authorId_fkey`
    FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
