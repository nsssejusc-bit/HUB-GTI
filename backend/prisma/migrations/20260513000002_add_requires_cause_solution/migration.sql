-- Adiciona flag que controla se os campos Causa/Solução são obrigatórios ao concluir
ALTER TABLE `Subcategory`
  ADD COLUMN `requiresCauseSolution` TINYINT(1) NOT NULL DEFAULT 1;

ALTER TABLE `Ticket`
  ADD COLUMN `requiresCauseSolution` TINYINT(1) NOT NULL DEFAULT 1;
