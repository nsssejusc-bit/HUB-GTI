-- Suporte a chamados abertos em nome de outra pessoa
ALTER TABLE `Ticket`
  ADD COLUMN `beneficiaryName`      VARCHAR(191) NULL,
  ADD COLUMN `beneficiaryMatricula` VARCHAR(191) NULL,
  ADD COLUMN `beneficiaryEmail`     VARCHAR(191) NULL,
  ADD COLUMN `beneficiaryDept`      VARCHAR(191) NULL;
