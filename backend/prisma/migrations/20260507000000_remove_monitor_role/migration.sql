-- Converte todos os usuários MONITOR para TECHNICIAN
UPDATE `User` SET `role` = 'TECHNICIAN' WHERE `role` = 'MONITOR';

-- Remove MONITOR do enum
ALTER TABLE `User` MODIFY COLUMN `role` ENUM('ADMIN', 'TECHNICIAN', 'USER') NOT NULL DEFAULT 'USER';
