CREATE TABLE IF NOT EXISTS `PushSubscription` (
  `id`        INT          NOT NULL AUTO_INCREMENT,
  `userId`    INT          NOT NULL,
  `endpoint`  LONGTEXT     NOT NULL,
  `p256dh`    TEXT         NOT NULL,
  `auth`      TEXT         NOT NULL,
  `updatedAt` DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `PushSubscription_userId_key` (`userId`),
  CONSTRAINT `PushSubscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
