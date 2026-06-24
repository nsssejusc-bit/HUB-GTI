-- Phase 1: Configurable OS types
-- Replaces the OsTipo enum with a fully editable WorkOrderType table.
-- All existing WorkOrder field data is migrated into formData JSON.

-- Step 1: Create WorkOrderType table
CREATE TABLE `WorkOrderType` (
  `id`        INT           NOT NULL AUTO_INCREMENT,
  `name`      VARCHAR(191)  NOT NULL,
  `color`     VARCHAR(191)  NOT NULL DEFAULT '#6366f1',
  `active`    TINYINT(1)    NOT NULL DEFAULT 1,
  `sortOrder` INT           NOT NULL DEFAULT 0,
  `nucleos`   JSON          NULL,
  `fields`    JSON          NOT NULL,
  `createdAt` DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `WorkOrderType_active_sortOrder_idx` (`active`, `sortOrder`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Step 2: Insert default types matching previous OsTipo enum values
INSERT INTO `WorkOrderType` (`name`, `color`, `sortOrder`, `fields`) VALUES
('Visita Técnica',            '#3b82f6', 1,
 '[{"key":"local","label":"Local / Destino","type":"text","required":true},{"key":"problema","label":"Problema / Descrição","type":"textarea","required":false},{"key":"materiais","label":"Materiais Utilizados","type":"textarea","required":false},{"key":"prazo","label":"Prazo","type":"date","required":false}]'),
('Troca de Equipamento',      '#f59e0b', 2,
 '[{"key":"local","label":"Local / Destino","type":"text","required":true},{"key":"problema","label":"Problema / Descrição","type":"textarea","required":false},{"key":"materiais","label":"Materiais Utilizados","type":"textarea","required":false},{"key":"prazo","label":"Prazo","type":"date","required":false}]'),
('Entrega',                   '#10b981', 3,
 '[{"key":"local","label":"Local / Destino","type":"text","required":true},{"key":"problema","label":"Descrição","type":"textarea","required":false},{"key":"materiais","label":"Itens Entregues","type":"textarea","required":false},{"key":"prazo","label":"Prazo","type":"date","required":false}]'),
('Manutenção de Rede',        '#8b5cf6', 4,
 '[{"key":"local","label":"Local / Destino","type":"text","required":true},{"key":"problema","label":"Problema / Descrição","type":"textarea","required":false},{"key":"materiais","label":"Materiais Utilizados","type":"textarea","required":false},{"key":"prazo","label":"Prazo","type":"date","required":false}]'),
('Manutenção de Câmera',      '#ec4899', 5,
 '[{"key":"local","label":"Local / Destino","type":"text","required":true},{"key":"problema","label":"Problema / Descrição","type":"textarea","required":false},{"key":"materiais","label":"Materiais Utilizados","type":"textarea","required":false},{"key":"prazo","label":"Prazo","type":"date","required":false}]'),
('Recolhimento de Equipamento','#f97316', 6,
 '[{"key":"local","label":"Local de Recolhimento","type":"text","required":true},{"key":"problema","label":"Motivo / Estado do Equipamento","type":"textarea","required":false},{"key":"materiais","label":"Itens Recolhidos","type":"textarea","required":false},{"key":"prazo","label":"Prazo","type":"date","required":false}]'),
('Ação',                      '#7c3aed', 7,
 '[{"key":"nomeEvento","label":"Nome do Evento","type":"text","required":true},{"key":"startDateTime","label":"Data/Hora de Início","type":"datetime","required":true},{"key":"endDateTime","label":"Data/Hora de Término","type":"datetime","required":true},{"key":"local","label":"Local","type":"text","required":true},{"key":"problema","label":"Descrição","type":"textarea","required":false},{"key":"materiais","label":"Materiais","type":"textarea","required":false}]'),
('Outro',                     '#6b7280', 8,
 '[{"key":"local","label":"Local / Destino","type":"text","required":true},{"key":"problema","label":"Descrição","type":"textarea","required":false},{"key":"materiais","label":"Materiais Utilizados","type":"textarea","required":false},{"key":"prazo","label":"Prazo","type":"date","required":false}]');

-- Step 3: Add new columns to WorkOrder
ALTER TABLE `WorkOrder` ADD COLUMN `tipoId`   INT  NULL;
ALTER TABLE `WorkOrder` ADD COLUMN `formData` JSON NULL;

-- Step 4: Map existing OsTipo enum values → tipoId FK
UPDATE `WorkOrder` SET `tipoId` = 1 WHERE `tipo` = 'VISITA_TECNICA';
UPDATE `WorkOrder` SET `tipoId` = 2 WHERE `tipo` = 'TROCA_EQUIPAMENTO';
UPDATE `WorkOrder` SET `tipoId` = 3 WHERE `tipo` = 'ENTREGA';
UPDATE `WorkOrder` SET `tipoId` = 4 WHERE `tipo` = 'MANUTENCAO_REDE';
UPDATE `WorkOrder` SET `tipoId` = 5 WHERE `tipo` = 'MANUTENCAO_CAMERA';
UPDATE `WorkOrder` SET `tipoId` = 6 WHERE `tipo` = 'RECOLHIMENTO_EQUIPAMENTO';
UPDATE `WorkOrder` SET `tipoId` = 7 WHERE `tipo` = 'ACAO';
UPDATE `WorkOrder` SET `tipoId` = 8 WHERE `tipo` = 'OUTRO';
-- Fallback for any unmapped row
UPDATE `WorkOrder` SET `tipoId` = 8 WHERE `tipoId` IS NULL;

-- Step 5: Migrate existing field values into formData JSON
UPDATE `WorkOrder` SET `formData` = JSON_OBJECT(
  'local',         IFNULL(`local`, ''),
  'problema',      IFNULL(`problema`, ''),
  'materiais',     IFNULL(`materiais`, ''),
  'prazo',         IF(`prazo` IS NOT NULL, DATE_FORMAT(`prazo`, '%Y-%m-%d'), NULL),
  'nomeEvento',    `nomeEvento`,
  'startDateTime', IF(`startDateTime` IS NOT NULL, DATE_FORMAT(`startDateTime`, '%Y-%m-%dT%H:%i'), NULL),
  'endDateTime',   IF(`endDateTime`   IS NOT NULL, DATE_FORMAT(`endDateTime`,   '%Y-%m-%dT%H:%i'), NULL)
);

-- Step 6: Make tipoId NOT NULL and add FK + index
ALTER TABLE `WorkOrder` MODIFY COLUMN `tipoId` INT NOT NULL;
ALTER TABLE `WorkOrder` ADD CONSTRAINT `WorkOrder_tipoId_fkey`
  FOREIGN KEY (`tipoId`) REFERENCES `WorkOrderType` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `WorkOrder` ADD INDEX `WorkOrder_tipoId_idx` (`tipoId`);

-- Step 7: Drop superseded columns (data is now in formData)
ALTER TABLE `WorkOrder` DROP COLUMN `tipo`;
ALTER TABLE `WorkOrder` DROP COLUMN `local`;
ALTER TABLE `WorkOrder` DROP COLUMN `problema`;
ALTER TABLE `WorkOrder` DROP COLUMN `materiais`;
ALTER TABLE `WorkOrder` DROP COLUMN `prazo`;
ALTER TABLE `WorkOrder` DROP COLUMN `nomeEvento`;
ALTER TABLE `WorkOrder` DROP COLUMN `startDateTime`;
ALTER TABLE `WorkOrder` DROP COLUMN `endDateTime`;
