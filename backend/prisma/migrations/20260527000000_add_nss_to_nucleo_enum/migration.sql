-- Adiciona NSS ao enum Nucleo em todas as tabelas afetadas
-- e cria as colunas nucleoResponsavel em Subcategory e Ticket (que estavam no schema mas sem migration)

-- 1. Atualiza User.nucleoResponsavel de ENUM('NMT','NIR') para ENUM('NMT','NIR','NSS')
ALTER TABLE `User`
  MODIFY COLUMN `nucleoResponsavel` ENUM('NMT','NIR','NSS') NULL;

-- 2. Atualiza InventoryItem.nucleo de ENUM('NMT','NIR') para ENUM('NMT','NIR','NSS')
ALTER TABLE `InventoryItem`
  MODIFY COLUMN `nucleo` ENUM('NMT','NIR','NSS') NULL;

-- 3. Atualiza InventoryChecklist.nucleo de ENUM('NMT','NIR') para ENUM('NMT','NIR','NSS')
ALTER TABLE `InventoryChecklist`
  MODIFY COLUMN `nucleo` ENUM('NMT','NIR','NSS') NOT NULL;

-- 4. Adiciona nucleoResponsavel em Subcategory (IF NOT EXISTS evita erro se coluna já existe)
ALTER TABLE `Subcategory`
  ADD COLUMN IF NOT EXISTS `nucleoResponsavel` ENUM('NMT','NIR','NSS') NULL;

-- 5. Adiciona nucleoResponsavel em Ticket (IF NOT EXISTS evita erro se coluna já existe)
ALTER TABLE `Ticket`
  ADD COLUMN IF NOT EXISTS `nucleoResponsavel` ENUM('NMT','NIR','NSS') NULL;
