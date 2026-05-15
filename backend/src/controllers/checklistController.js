import { z } from "zod";
import { prisma } from "../config/prisma.js";
import JSZip from "jszip";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.join(__dirname, "../../templates/timbrado.docx");

const NUCLEO_LABEL = { NMT: "NMT – Núcleo de Mídias e Tecnologia", NIR: "NIR – Núcleo de Infraestrutura e Redes" };

const createSchema = z.object({
  title:  z.string().min(2, "Informe o título/evento").max(191),
  nucleo: z.enum(["NMT", "NIR"]),
  note:   z.string().max(1000).nullable().optional(),
  items:  z.array(z.object({
    itemId:   z.number().int().positive(),
    quantity: z.number().int().min(1, "Quantidade mínima é 1"),
  })).min(1, "Selecione ao menos 1 item"),
});

// GET /api/inventory/checklists
export async function listChecklists(req, res) {
  const { nucleo, status } = req.query;
  const where = {};
  if (nucleo) where.nucleo = nucleo;
  if (status) where.status = status;

  const checklists = await prisma.inventoryChecklist.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      createdBy:  { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      _count:     { select: { items: true } },
    },
  });
  res.json(checklists);
}

// GET /api/inventory/checklists/:id
export async function getChecklist(req, res) {
  const id = Number(req.params.id);
  const checklist = await prisma.inventoryChecklist.findUnique({
    where:   { id },
    include: {
      createdBy:  { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      items: {
        include: {
          item: { select: { id: true, name: true, code: true, unitMeasure: true, quantity: true, nucleo: true } },
        },
      },
    },
  });
  if (!checklist) return res.status(404).json({ error: "Checklist não encontrado" });
  res.json(checklist);
}

// POST /api/inventory/checklists
export async function createChecklist(req, res) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { title, nucleo, note, items } = parsed.data;

  // Check if items exist
  const itemIds = items.map((i) => i.itemId);
  const dbItems = await prisma.inventoryItem.findMany({
    where: { id: { in: itemIds }, status: "ATIVO" },
    select: { id: true, name: true },
  });
  if (dbItems.length !== itemIds.length) {
    return res.status(400).json({ error: "Um ou mais itens não encontrados ou inativos" });
  }

  // Is creator the nucleus responsible?
  const isResponsavel = req.user.nucleoResponsavel === nucleo;

  const checklist = await prisma.$transaction(async (tx) => {
    const created = await tx.inventoryChecklist.create({
      data: {
        title,
        nucleo,
        note: note || null,
        status:      isResponsavel ? "APROVADO" : "PENDENTE",
        approvedById: isResponsavel ? req.user.id : null,
        approvedAt:   isResponsavel ? new Date() : null,
        createdById:  req.user.id,
        items: {
          create: items.map((i) => ({ itemId: i.itemId, quantity: i.quantity })),
        },
      },
    });

    // If auto-approved, deduct stock immediately
    if (isResponsavel) {
      for (const item of items) {
        const dbItem = await tx.inventoryItem.findUnique({ where: { id: item.itemId } });
        const newQty = dbItem.quantity - item.quantity;
        if (newQty < 0) throw new Error(`Estoque insuficiente para "${dbItem.name}"`);
        await tx.inventoryItem.update({
          where: { id: item.itemId },
          data:  { quantity: newQty },
        });
        await tx.inventoryMovement.create({
          data: {
            itemId:      item.itemId,
            type:        "SAIDA",
            quantity:    item.quantity,
            note:        `Checklist #${created.id} – ${title}`,
            createdById: req.user.id,
          },
        });
      }
    }

    return created;
  });

  await prisma.auditLog.create({
    data: {
      actorId:    req.user.id,
      actorName:  req.user.name,
      action:     "CHECKLIST_CREATE",
      targetType: "InventoryChecklist",
      targetId:   String(checklist.id),
      details:    JSON.stringify({ title, nucleo, itemCount: items.length, autoApproved: isResponsavel }),
    },
  });

  res.status(201).json(checklist);
}

// POST /api/inventory/checklists/:id/approve
export async function approveChecklist(req, res) {
  const id = Number(req.params.id);
  const checklist = await prisma.inventoryChecklist.findUnique({
    where:   { id },
    include: { items: { include: { item: true } } },
  });
  if (!checklist) return res.status(404).json({ error: "Checklist não encontrado" });
  if (checklist.status !== "PENDENTE") {
    return res.status(400).json({ error: "Checklist não está pendente" });
  }
  if (req.user.nucleoResponsavel !== checklist.nucleo && req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Apenas o responsável do núcleo pode aprovar" });
  }

  await prisma.$transaction(async (tx) => {
    // Deduct stock
    for (const ci of checklist.items) {
      const newQty = ci.item.quantity - ci.quantity;
      if (newQty < 0) throw new Error(`Estoque insuficiente para "${ci.item.name}"`);
      await tx.inventoryItem.update({ where: { id: ci.itemId }, data: { quantity: newQty } });
      await tx.inventoryMovement.create({
        data: {
          itemId:      ci.itemId,
          type:        "SAIDA",
          quantity:    ci.quantity,
          note:        `Checklist #${id} – ${checklist.title}`,
          createdById: req.user.id,
        },
      });
    }
    await tx.inventoryChecklist.update({
      where: { id },
      data: { status: "APROVADO", approvedById: req.user.id, approvedAt: new Date() },
    });
  });

  await prisma.auditLog.create({
    data: {
      actorId:    req.user.id,
      actorName:  req.user.name,
      action:     "CHECKLIST_APPROVE",
      targetType: "InventoryChecklist",
      targetId:   String(id),
    },
  });

  res.json({ ok: true });
}

// POST /api/inventory/checklists/:id/reject
export async function rejectChecklist(req, res) {
  const id = Number(req.params.id);
  const { note } = req.body || {};

  const checklist = await prisma.inventoryChecklist.findUnique({ where: { id } });
  if (!checklist) return res.status(404).json({ error: "Checklist não encontrado" });
  if (checklist.status !== "PENDENTE") {
    return res.status(400).json({ error: "Checklist não está pendente" });
  }
  if (req.user.nucleoResponsavel !== checklist.nucleo && req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Apenas o responsável do núcleo pode rejeitar" });
  }

  await prisma.inventoryChecklist.update({
    where: { id },
    data: {
      status:       "REJEITADO",
      approvedById: req.user.id,
      approvedAt:   new Date(),
      rejectedNote: note || null,
    },
  });

  res.json({ ok: true });
}

// DELETE /api/inventory/checklists/:id — admin only, only PENDENTE
export async function deleteChecklist(req, res) {
  const id = Number(req.params.id);
  const checklist = await prisma.inventoryChecklist.findUnique({ where: { id } });
  if (!checklist) return res.status(404).json({ error: "Checklist não encontrado" });
  if (checklist.status === "APROVADO") {
    return res.status(400).json({ error: "Não é possível excluir um checklist aprovado" });
  }
  await prisma.inventoryChecklist.delete({ where: { id } });
  res.json({ ok: true });
}

// GET /api/inventory/checklists/:id/docx
export async function downloadChecklistDocx(req, res) {
  const id = Number(req.params.id);
  const checklist = await prisma.inventoryChecklist.findUnique({
    where:   { id },
    include: {
      createdBy:  { select: { name: true } },
      approvedBy: { select: { name: true } },
      items: {
        include: {
          item: { select: { name: true, code: true, unitMeasure: true } },
        },
      },
    },
  });
  if (!checklist) return res.status(404).json({ error: "Checklist não encontrado" });

  const templateBuffer = fs.readFileSync(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuffer);

  // Read the original document.xml so we preserve its exact namespace declarations
  // and sectPr (which references the header/footer relationship IDs).
  const origDocXml = await zip.file("word/document.xml").async("string");

  // Extract the opening <w:document ...> tag with all its namespace declarations.
  // Use [\s\S]*? (dotall, non-greedy) so the match works whether the tag is a single
  // long line or spread across multiple lines.
  const docOpenMatch = origDocXml.match(/^(<\?xml[\s\S]*?\?>\s*)?(<w:document[\s\S]*?>)/);
  const xmlDecl  = docOpenMatch?.[1] ?? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
  const docOpen  = docOpenMatch?.[2] ?? `<w:document xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">`;

  // Extract the original <w:sectPr>...</w:sectPr> block and sanitize any
  // floating-point attribute values (e.g. pgMar from Python conversions)
  // to integers so Word doesn't reject the sectPr and lose header/footer refs.
  const sectPrMatch = origDocXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
  const origSectPr  = (sectPrMatch?.[0] ?? buildFallbackSectPr())
    .replace(/="([\d]+\.[\d]+)"/g, (_, v) => `="${Math.round(parseFloat(v))}"`);

  const bodyContent = buildBodyContent(checklist);
  const newDocXml   = `${xmlDecl}${docOpen}\n<w:body>\n${bodyContent}\n${origSectPr}\n</w:body>\n</w:document>`;
  zip.file("word/document.xml", newDocXml);

  const docxBuffer = await zip.generateAsync({
    type:        "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const safeName = checklist.title.replace(/[^a-zA-Z0-9\-_À-ɏ]/g, "_").slice(0, 50);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename="Checklist_${safeName}_${id}.docx"`);
  res.send(docxBuffer);
}

// ── DOCX body builder ─────────────────────────────────────────────────────────

function esc(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cell(text, widthDxa, opts = {}) {
  const { bold = false, center = false, shade = "" } = opts;
  const shading = shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : "";
  const align   = center ? `<w:jc w:val="center"/>` : "";
  const bStart  = bold ? `<w:b/>` : "";
  return `
    <w:tc>
      <w:tcPr>
        <w:tcW w:w="${widthDxa}" w:type="dxa"/>
        <w:tcBorders>
          <w:top    w:val="single" w:sz="4" w:space="0" w:color="C0C0C0"/>
          <w:left   w:val="single" w:sz="4" w:space="0" w:color="C0C0C0"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="C0C0C0"/>
          <w:right  w:val="single" w:sz="4" w:space="0" w:color="C0C0C0"/>
        </w:tcBorders>
        ${shading}
        <w:tcMar><w:top w:w="80" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>
      </w:tcPr>
      <w:p><w:pPr>${align}<w:spacing w:before="0" w:after="0"/></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${bStart}<w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>
          <w:t xml:space="preserve">${esc(text)}</w:t>
        </w:r>
      </w:p>
    </w:tc>`;
}

function checkboxCell(widthDxa) {
  return `
    <w:tc>
      <w:tcPr>
        <w:tcW w:w="${widthDxa}" w:type="dxa"/>
        <w:tcBorders>
          <w:top    w:val="single" w:sz="4" w:space="0" w:color="C0C0C0"/>
          <w:left   w:val="single" w:sz="4" w:space="0" w:color="C0C0C0"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="C0C0C0"/>
          <w:right  w:val="single" w:sz="4" w:space="0" w:color="C0C0C0"/>
        </w:tcBorders>
        <w:tcMar><w:top w:w="80" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>
      </w:tcPr>
      <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>
          <w:t>&#x2610;</w:t>
        </w:r>
      </w:p>
    </w:tc>`;
}

// Column widths (must sum to 8504 = content width for A4 with 3cm margins)
// Nº:400 | Item:3104 | Código:1500 | Qtd:500 | Un:400 | Saída:800 | Retorno:800 → total=7504
// Recalc: 8504 - 400 - 1500 - 500 - 400 - 850 - 850 = 4004 → Item=4004
const COLS = [400, 4004, 1500, 500, 400, 850, 850]; // sum=8504

function buildFallbackSectPr() {
  return `<w:sectPr>
    <w:headerReference r:id="rId7" w:type="default"/>
    <w:footerReference r:id="rId8" w:type="default"/>
    <w:pgSz w:h="16838" w:w="11906" w:orient="portrait"/>
    <w:pgMar w:bottom="3099" w:top="2268" w:left="1701" w:right="1701" w:header="709" w:footer="709"/>
  </w:sectPr>`;
}

function buildBodyContent(checklist) {
  const date   = new Date(checklist.createdAt).toLocaleDateString("pt-BR");
  const status = checklist.status === "APROVADO" ? "APROVADO" : checklist.status === "REJEITADO" ? "REJEITADO" : "PENDENTE";

  // Header row
  const headerRow = `
  <w:tr>
    <w:trPr><w:trHeight w:val="480"/><w:tblHeader/></w:trPr>
    ${cell("Nº",      COLS[0], { bold: true, center: true, shade: "1B335D" })}
    ${cell("ITEM",    COLS[1], { bold: true, shade: "1B335D" })}
    ${cell("CÓDIGO",  COLS[2], { bold: true, center: true, shade: "1B335D" })}
    ${cell("QTD",     COLS[3], { bold: true, center: true, shade: "1B335D" })}
    ${cell("UN.",     COLS[4], { bold: true, center: true, shade: "1B335D" })}
    ${cell("SAÍDA",   COLS[5], { bold: true, center: true, shade: "1B335D" })}
    ${cell("RETORNO", COLS[6], { bold: true, center: true, shade: "1B335D" })}
  </w:tr>`;

  // Make header row text white
  const headerRowWhite = headerRow.replace(
    /<w:sz w:val="20"\/><w:szCs w:val="20"\/>/g,
    `<w:color w:val="FFFFFF"/><w:sz w:val="20"/><w:szCs w:val="20"/>`,
  );

  // Data rows
  const dataRows = checklist.items.map((ci, i) => {
    const shade = i % 2 === 0 ? "F5F7FA" : "FFFFFF";
    return `
  <w:tr>
    <w:trPr><w:trHeight w:val="480"/></w:trPr>
    ${cell(String(i + 1),             COLS[0], { center: true, shade })}
    ${cell(ci.item.name,              COLS[1], { shade })}
    ${cell(ci.item.code || "—",       COLS[2], { center: true, shade })}
    ${cell(String(ci.quantity),       COLS[3], { center: true, shade })}
    ${cell(ci.item.unitMeasure,       COLS[4], { center: true, shade })}
    ${checkboxCell(COLS[5])}
    ${checkboxCell(COLS[6])}
  </w:tr>`;
  }).join("\n");

  const colWidthTags = COLS.map((w) => `<w:col w:w="${w}" w:type="dxa"/>`).join("\n");

  return `
  <w:p>
    <w:pPr><w:jc w:val="center"/><w:spacing w:before="240" w:after="80"/></w:pPr>
    <w:r><w:rPr>
      <w:rFonts w:ascii="Montserrat" w:hAnsi="Montserrat" w:cs="Montserrat"/>
      <w:b/><w:color w:val="1B335D"/><w:sz w:val="32"/><w:szCs w:val="32"/>
    </w:rPr><w:t>CHECKLIST DE MATERIAIS</w:t></w:r>
  </w:p>
  <w:p>
    <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="160"/></w:pPr>
    <w:r><w:rPr>
      <w:rFonts w:ascii="Montserrat" w:hAnsi="Montserrat" w:cs="Montserrat"/>
      <w:b/><w:color w:val="4472C4"/><w:sz w:val="26"/><w:szCs w:val="26"/>
    </w:rPr><w:t>${esc(checklist.title)}</w:t></w:r>
  </w:p>
  <w:p>
    <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="40"/></w:pPr>
    <w:r><w:rPr>
      <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
      <w:color w:val="293258"/><w:sz w:val="18"/><w:szCs w:val="18"/>
    </w:rPr><w:t xml:space="preserve">${esc(NUCLEO_LABEL[checklist.nucleo])}    |    Data: ${esc(date)}    |    Status: ${esc(status)}</w:t></w:r>
  </w:p>
  <w:p>
    <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="200"/></w:pPr>
    <w:r><w:rPr>
      <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
      <w:color w:val="555555"/><w:sz w:val="16"/><w:szCs w:val="16"/>
    </w:rPr><w:t xml:space="preserve">Solicitado por: ${esc(checklist.createdBy?.name || "—")}${checklist.approvedBy ? `    |    Autorizado por: ${esc(checklist.approvedBy.name)}` : ""}</w:t></w:r>
  </w:p>
  ${checklist.note ? `<w:p>
    <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="200"/></w:pPr>
    <w:r><w:rPr>
      <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
      <w:i/><w:color w:val="666666"/><w:sz w:val="18"/><w:szCs w:val="18"/>
    </w:rPr><w:t>${esc(checklist.note)}</w:t></w:r>
  </w:p>` : ""}
  <w:tbl>
    <w:tblPr>
      <w:tblW w:w="8504" w:type="dxa"/>
      <w:jc w:val="center"/>
      <w:tblBorders>
        <w:top    w:val="single" w:sz="4" w:space="0" w:color="C0C0C0"/>
        <w:left   w:val="single" w:sz="4" w:space="0" w:color="C0C0C0"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="C0C0C0"/>
        <w:right  w:val="single" w:sz="4" w:space="0" w:color="C0C0C0"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="C0C0C0"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="C0C0C0"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tblGrid>
      ${colWidthTags}
    </w:tblGrid>
    ${headerRowWhite}
    ${dataRows}
  </w:tbl>
  <w:p><w:pPr><w:spacing w:before="600" w:after="0"/></w:pPr></w:p>
  <w:tbl>
    <w:tblPr>
      <w:tblW w:w="8504" w:type="dxa"/>
      <w:jc w:val="center"/>
      <w:tblBorders>
        <w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/>
        <w:insideH w:val="nil"/><w:insideV w:val="nil"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tblGrid>
      <w:gridCol w:w="4000"/><w:gridCol w:w="504"/><w:gridCol w:w="4000"/>
    </w:tblGrid>
    <w:tr>
      <w:tc>
        <w:tcPr><w:tcW w:w="4000" w:type="dxa"/><w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="1B335D"/><w:right w:val="nil"/></w:tcBorders></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="60"/></w:pPr></w:p>
      </w:tc>
      <w:tc><w:tcPr><w:tcW w:w="504" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p></w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="4000" w:type="dxa"/><w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="1B335D"/><w:right w:val="nil"/></w:tcBorders></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="60"/></w:pPr></w:p>
      </w:tc>
    </w:tr>
    <w:tr>
      <w:tc>
        <w:tcPr><w:tcW w:w="4000" w:type="dxa"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="60" w:after="0"/></w:pPr>
          <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="16"/><w:szCs w:val="16"/><w:color w:val="555555"/></w:rPr>
            <w:t>Assinatura do solicitante</w:t>
          </w:r>
        </w:p>
      </w:tc>
      <w:tc><w:tcPr><w:tcW w:w="504" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p></w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="4000" w:type="dxa"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="60" w:after="0"/></w:pPr>
          <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="16"/><w:szCs w:val="16"/><w:color w:val="555555"/></w:rPr>
            <w:t>Assinatura do responsável do núcleo</w:t>
          </w:r>
        </w:p>
      </w:tc>
    </w:tr>
  </w:tbl>

  <w:p><w:pPr><w:spacing w:before="200" w:after="0"/></w:pPr></w:p>`;
}
