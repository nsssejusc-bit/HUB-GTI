-- CreateIndex (composite indexes for common filter patterns)
CREATE INDEX `Ticket_status_assignedTechId_idx` ON `Ticket`(`status`, `assignedTechId`);
CREATE INDEX `Ticket_approvalStatus_status_idx` ON `Ticket`(`approvalStatus`, `status`);
CREATE INDEX `Ticket_status_unitId_idx` ON `Ticket`(`status`, `unitId`);
