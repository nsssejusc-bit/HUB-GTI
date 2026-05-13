import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  // ── Setores de TI (únicos pré-criados; demais são criados pelo admin) ────
  const departments = [
    "Núcleo de Suporte de Sistemas (NSS)",
    "Núcleo de Infraestrutura de Redes (NIR)",
    "Núcleo de Manutenção Técnica (NMT)",
  ];
  for (const name of departments) {
    await prisma.department.upsert({
      where: { name },
      create: { name, active: true },
      update: { active: true },
    });
  }

  // ── Unidades ────────────────────────────────────────────────────────────
  const units = [
    { name: "GTI", description: "Gerência de Tecnologia da Informação" },
    { name: "NSS", description: "Tecnologia da Informação" },
    { name: "NIR", description: "Infraestrutura e Redes" },
    { name: "NMT", description: "Manutenção Técnica" },
  ];
  for (const u of units) {
    await prisma.unit.upsert({
      where: { name: u.name },
      create: u,
      update: u,
    });
  }

  // ── Categorias e subcategorias ───────────────────────────────────────────
  // requiresPresential:    true  → exibe etapa "Técnico a caminho"
  // requiresApproval:     true  → requer aprovação do Chefe de Setor antes de atender
  // dualApproval:         true  → requer aprovação dos chefes de DOIS setores
  // requiresCauseSolution: false → dispensa campos Causa/Solução ao concluir (pedidos de serviço)
  const categories = [
    {
      code: "HARDWARE",
      name: "Computador",
      icon: "desktop",
      sortOrder: 1,
      allowsFreeText: false,
      subcategories: [
        { name: "Computador não liga",        code: "HARDWARE_WONT_TURN_ON", requiresPresential: true  },
        { name: "Computador travado",          code: "HARDWARE_FROZEN",       requiresPresential: true  },
        { name: "Monitor sem imagem",          code: "HARDWARE_NO_IMAGE",     requiresPresential: true  },
        { name: "Mouse/Teclado não funciona",  code: "HARDWARE_INPUT",        requiresPresential: true  },
        { name: "Outro",                       code: "HARDWARE_OTHER",        requiresPresential: true  },
      ],
    },
    {
      code: "NETWORK",
      name: "Internet",
      icon: "wifi",
      sortOrder: 2,
      allowsFreeText: false,
      subcategories: [
        { name: "Queda de internet",  code: "INTERNET_QUEDA",         requiresPresential: true },
        { name: "Lentidão",           code: "INTERNET_LENTIDAO",      requiresPresential: true },
        { name: "Intermitência",      code: "INTERNET_INTERMITENCIA", requiresPresential: true },
      ],
    },
    {
      code: "NETSERVER",
      name: "Rede/Servidor",
      icon: "server",
      sortOrder: 3,
      allowsFreeText: false,
      subcategories: [
        { name: "Criação de usuário",    code: "NETSERVER_USER_CREATE",    requiresApproval: true,  requiresPresential: false, requiresCauseSolution: false },
        { name: "Exclusão de usuário",   code: "NETSERVER_USER_DELETE",    requiresPresential: false, requiresCauseSolution: false },
        { name: "Atualização de usuário",code: "NETSERVER_USER_UPDATE",    requiresPresential: false, requiresCauseSolution: false },
        { name: "Reset de senha",        code: "NETSERVER_PASSWORD_RESET", requiresPresential: false, requiresCauseSolution: false },
        { name: "Criação de pasta",      code: "NETSERVER_FOLDER_CREATE",  requiresPresential: false, requiresCauseSolution: false },
        { name: "Mapeamento de pasta",   code: "NETSERVER_FOLDER_MAP",     requiresPresential: false, requiresCauseSolution: false },
        { name: "Falha de confiança",    code: "NETSERVER_TRUST_FAIL",     requiresPresential: true  },
        { name: "VPN",                   code: "NETSERVER_VPN",            requiresPresential: false, requiresCauseSolution: false },
      ],
    },
    {
      code: "SIGED",
      name: "SIGED",
      icon: "file-text",
      sortOrder: 4,
      allowsFreeText: false,
      subcategories: [
        { name: "Cadastro de usuário",  code: "SIGED_USER_CREATE",    requiresPresential: false, requiresCauseSolution: false },
        { name: "Realocação de setor",  code: "SIGED_SECTOR_MOVE",    requiresApproval: true, dualApproval: true, requiresPresential: false, requiresCauseSolution: false },
        { name: "Excluir usuário",      code: "SIGED_USER_DELETE",    requiresPresential: false, requiresCauseSolution: false },
        { name: "Reset de senha",       code: "SIGED_PASSWORD_RESET", requiresPresential: false, requiresCauseSolution: false },
        { name: "Cadastrar Setor",      code: "SIGED_SECTOR_CREATE",  requiresPresential: false, requiresCauseSolution: false },
      ],
    },
    {
      code: "PRINTER",
      name: "Impressora",
      icon: "printer",
      sortOrder: 5,
      allowsFreeText: false,
      subcategories: [
        { name: "Impressora não aparece", code: "PRINTER_NOT_VISIBLE", requiresPresential: true },
        { name: "Impressora offline",     code: "PRINTER_OFFLINE",     requiresPresential: true },
        { name: "Impressão não sai",      code: "PRINTER_NO_PRINT",    requiresPresential: true },
        { name: "Papel enroscado",        code: "PRINTER_PAPER_JAM",   requiresPresential: true },
        { name: "Sem papel",              code: "PRINTER_NO_PAPER",    requiresPresential: true },
        { name: "Troca de toner",         code: "PRINTER_TONER",       requiresPresential: true },
      ],
    },
    {
      code: "REMOTE",
      name: "Suporte Remoto",
      icon: "monitor-smartphone",
      sortOrder: 6,
      allowsFreeText: false,
      subcategories: [],
    },
  ];

  // Remove categorias obsoletas sem chamados vinculados
  await prisma.category.deleteMany({
    where: { code: { in: ["OTHER", "ACCESS"] }, tickets: { none: {} } },
  });

  for (const cat of categories) {
    const created = await prisma.category.upsert({
      where: { code: cat.code },
      create: {
        code: cat.code,
        name: cat.name,
        icon: cat.icon,
        sortOrder: cat.sortOrder,
        allowsFreeText: cat.allowsFreeText,
      },
      update: {
        name: cat.name,
        icon: cat.icon,
        sortOrder: cat.sortOrder,
        allowsFreeText: cat.allowsFreeText,
      },
    });

    const subNames = cat.subcategories.map((s) => s.name);

    // Remove subcategorias obsoletas (sem chamados vinculados)
    await prisma.subcategory.deleteMany({
      where: {
        categoryId: created.id,
        name: { notIn: subNames },
        tickets: { none: {} },
      },
    });

    for (const sub of cat.subcategories) {
      const existing = await prisma.subcategory.findFirst({
        where: { categoryId: created.id, name: sub.name },
      });
      const subData = {
        code:                  sub.code                  ?? null,
        requiresApproval:      sub.requiresApproval      ?? false,
        dualApproval:          sub.dualApproval           ?? false,
        requiresPresential:    sub.requiresPresential     ?? true,
        requiresCauseSolution: sub.requiresCauseSolution  ?? true,
      };
      if (!existing) {
        await prisma.subcategory.create({
          data: { name: sub.name, categoryId: created.id, ...subData },
        });
      } else {
        await prisma.subcategory.update({
          where: { id: existing.id },
          data: subData,
        });
      }
    }
  }

  // ── Usuário ADMIN (único usuário pré-criado) ─────────────────────────────
  const adminCpf  = "48215374867";
  const adminHash = await bcrypt.hash("admin@2025", 10);

  const gti     = await prisma.unit.findUnique({ where: { name: "GTI" } });
  const nssDept = await prisma.department.findFirst({ where: { name: { contains: "NSS" } } });

  await prisma.user.upsert({
    where: { cpf: adminCpf },
    create: {
      cpf: adminCpf,
      name: "Guilherme Oliveira",
      passwordHash: adminHash,
      role: "ADMIN",
      active: true,
      unitId:       gti?.id     || null,
      departmentId: nssDept?.id || null,
    },
    update: {
      name: "Guilherme Oliveira",
      role: "ADMIN",
      active: true,
      unitId:       gti?.id     || null,
      departmentId: nssDept?.id || null,
    },
  });

  // Remove usuários de desenvolvimento antigos (CPFs fictícios do seed anterior)
  await prisma.user.deleteMany({
    where: { cpf: { in: ["52998224725", "11144477735"] } },
  });

  console.log("✅ Seed concluído.");
  console.log("Admin → CPF: 482.153.748-67 | senha: admin@2025");
  console.log("Demais usuários devem se cadastrar via /cadastro e aguardar aprovação.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
