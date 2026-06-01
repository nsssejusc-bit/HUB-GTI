import bcrypt from "bcrypt";
import { prisma } from "../src/config/prisma.js";

// Credenciais fixas para os 4 papéis — CPFs válidos pelo algoritmo brasileiro
export const USERS = {
  admin: { cpf: "52998224725", password: "Admin@test123", name: "Admin Teste",   role: "ADMIN" },
  tech:  { cpf: "71428793860", password: "Tech@test123",  name: "Tech Teste",    role: "TECHNICIAN" },
  user:  { cpf: "87748248800", password: "User@test123",  name: "User Teste",    role: "USER" },
  chefe: { cpf: "11144477735", password: "Chefe@test123", name: "Chefe Teste",   role: "CHEFE_SETOR" },
};

export let dept;
export let unit;
export let category;
export let subcategory;         // requiresApproval: false
export let subcategoryApproval; // requiresApproval: true

async function wipeAll() {
  // Desativa FK para truncar em qualquer ordem
  await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 0`;
  await prisma.inventoryChecklistItem.deleteMany();
  await prisma.inventoryChecklist.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.inventoryUnit.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.ticketWorkOrder.deleteMany();
  await prisma.osTecnico.deleteMany();
  await prisma.osHistory.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.ticketApproval.deleteMany();
  await prisma.ticketHistory.deleteMany();
  await prisma.ticketComment.deleteMany();
  await prisma.ticketMessage.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.dailyCounter.deleteMany();
  await prisma.passwordResetRequest.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.subcategory.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 1`;
}

beforeAll(async () => {
  await wipeAll();

  dept = await prisma.department.create({ data: { name: "TI Teste", active: true } });
  unit = await prisma.unit.create({ data: { name: "GTI Teste" } });

  for (const u of Object.values(USERS)) {
    const hash = await bcrypt.hash(u.password, 10);
    const created = await prisma.user.create({
      data: {
        name:         u.name,
        cpf:          u.cpf,
        role:         u.role,
        passwordHash: hash,
        active:       true,
        departmentId: dept.id,
        isChefe:      u.role === "CHEFE_SETOR",
      },
    });
    u.id = created.id;
  }

  category = await prisma.category.create({
    data: { name: "Hardware", code: "HARDWARE", sortOrder: 0 },
  });

  subcategory = await prisma.subcategory.create({
    data: { name: "Manutenção Geral", categoryId: category.id, requiresApproval: false, sortOrder: 0 },
  });

  subcategoryApproval = await prisma.subcategory.create({
    data: { name: "Troca de Equipamento", categoryId: category.id, requiresApproval: true, sortOrder: 1 },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
