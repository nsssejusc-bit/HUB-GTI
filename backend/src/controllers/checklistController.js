import { z } from "zod";
import { prisma } from "../config/prisma.js";
import JSZip from "jszip";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.join(__dirname, "../../templates/timbrado.docx");

const NUCLEO_LABEL = { NMT: "NMT – Núcleo de Manutenção Técnica", NIR: "NIR – Núcleo de Infraestrutura e Redes", NSS: "NSS – Núcleo de Suporte e Sistemas" };

const createSchema = z.object({
  title:   z.string().min(2, "Informe o título/evento").max(191),
  nucleo:  z.enum(["NMT", "NIR", "NSS"]),
  note:    z.string().max(1000).nullable().optional(),
  unitIds: z.array(z.number().int().positive()).min(1, "Selecione ao menos 1 unidade"),
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
          unit: {
            include: {
              item: { select: { id: true, name: true, unitMeasure: true, nucleo: true } },
            },
          },
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

  const { title, nucleo, note, unitIds } = parsed.data;

  // Check units exist and are available
  const units = await prisma.inventoryUnit.findMany({
    where:   { id: { in: unitIds }, status: "DISPONIVEL" },
    include: { item: { select: { id: true, name: true, nucleo: true } } },
  });
  if (units.length !== unitIds.length) {
    return res.status(400).json({ error: "Uma ou mais unidades não encontradas ou indisponíveis" });
  }
  const wrongNucleo = units.find((u) => u.item.nucleo !== nucleo);
  if (wrongNucleo) {
    return res.status(400).json({ error: `A unidade "${wrongNucleo.item.name}" não pertence ao núcleo ${nucleo}` });
  }

  const isResponsavel = req.user.nucleoResponsavel === nucleo;

  const checklist = await prisma.$transaction(async (tx) => {
    const created = await tx.inventoryChecklist.create({
      data: {
        title,
        nucleo,
        note:         note || null,
        status:       isResponsavel ? "APROVADO" : "PENDENTE",
        approvedById: isResponsavel ? req.user.id : null,
        approvedAt:   isResponsavel ? new Date() : null,
        createdById:  req.user.id,
        items: {
          create: unitIds.map((unitId) => ({ unitId })),
        },
      },
    });

    if (isResponsavel) {
      await tx.inventoryUnit.updateMany({
        where: { id: { in: unitIds } },
        data:  { status: "EM_USO" },
      });
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
      details:    JSON.stringify({ title, nucleo, unitCount: unitIds.length, autoApproved: isResponsavel }),
    },
  });

  res.status(201).json(checklist);
}

// POST /api/inventory/checklists/:id/approve
export async function approveChecklist(req, res) {
  const id = Number(req.params.id);
  const checklist = await prisma.inventoryChecklist.findUnique({
    where:   { id },
    include: { items: true },
  });
  if (!checklist) return res.status(404).json({ error: "Checklist não encontrado" });
  if (checklist.status !== "PENDENTE") {
    return res.status(400).json({ error: "Checklist não está pendente" });
  }
  if (req.user.nucleoResponsavel !== checklist.nucleo && req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Apenas o responsável do núcleo pode aprovar" });
  }

  const unitIds = checklist.items.map((ci) => ci.unitId);

  await prisma.$transaction(async (tx) => {
    await tx.inventoryUnit.updateMany({
      where: { id: { in: unitIds } },
      data:  { status: "EM_USO" },
    });
    await tx.inventoryChecklist.update({
      where: { id },
      data:  { status: "APROVADO", approvedById: req.user.id, approvedAt: new Date() },
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

// POST /api/inventory/checklists/:id/return — return units to DISPONIVEL
export async function returnChecklist(req, res) {
  const id = Number(req.params.id);
  const checklist = await prisma.inventoryChecklist.findUnique({
    where:   { id },
    include: { items: true },
  });
  if (!checklist) return res.status(404).json({ error: "Checklist não encontrado" });
  if (checklist.status !== "APROVADO") {
    return res.status(400).json({ error: "Apenas checklists aprovados podem ser devolvidos" });
  }

  const unitIds = checklist.items.map((ci) => ci.unitId);

  await prisma.inventoryUnit.updateMany({
    where: { id: { in: unitIds } },
    data:  { status: "DISPONIVEL" },
  });

  await prisma.auditLog.create({
    data: {
      actorId:    req.user.id,
      actorName:  req.user.name,
      action:     "CHECKLIST_RETURN",
      targetType: "InventoryChecklist",
      targetId:   String(id),
      details:    JSON.stringify({ title: checklist.title, unitCount: unitIds.length }),
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
          unit: {
            include: {
              item: { select: { name: true, unitMeasure: true } },
            },
          },
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
    .replace(/="([\d]+\.[\d]+)"/g, (_, v) => `="${Math.round(parseFloat(v))}"`)
    // Override margins: 20mm sides, 32mm top/bottom (tighter fit within timbrado frame)
    .replace(/w:pgMar[^/]*\/>/,
      'w:pgMar w:top="2268" w:bottom="1134" w:left="737" w:right="737" w:header="709" w:footer="709"/>',
    )
    // Remove header reference — the timbrado is embedded directly in the body as a
    // watermark, so rendering the header image too would duplicate the letterhead.
    .replace(/<w:headerReference[^/]*\/>/g, "");

  // Add a relationship in document.xml.rels so the body can reference image3.png
  // (the full-page SEJUSC letterhead). We embed it directly in the body as a
  // behind-text watermark instead of relying on the header floating image, which
  // Word sometimes fails to render over body content across different view modes.
  const relsFile = zip.file("word/_rels/document.xml.rels");
  if (relsFile) {
    const relsXml = await relsFile.async("string");
    if (!relsXml.includes("rIdSejuscBg")) {
      zip.file(
        "word/_rels/document.xml.rels",
        relsXml.replace(
          "</Relationships>",
          '<Relationship Id="rIdSejuscBg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image3.png"/></Relationships>',
        ),
      );
    }
  }

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
  const { bold = false, center = false, shade = "", noWrap = false } = opts;
  const shading = shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : "";
  const align   = center ? `<w:jc w:val="center"/>` : "";
  const bStart  = bold ? `<w:b/>` : "";
  const noWrapTag = noWrap ? `<w:noWrap/>` : "";
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
        ${noWrapTag}
        <w:tcMar><w:top w:w="80" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>
      </w:tcPr>
      <w:p><w:pPr>${align}<w:spacing w:before="0" w:after="0"/></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${bStart}<w:u w:val="none"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>
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
        <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:u w:val="none"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>
          <w:t>&#x2610;</w:t>
        </w:r>
      </w:p>
    </w:tc>`;
}

// Column widths (sum=10432 = content width for A4 with 13mm side margins)
// Nº:500 | Item:5082 | Código:1700 | Qtd:550 | Un:700 | Saída:950 | Retorno:950
const COLS = [500, 5082, 1700, 550, 700, 950, 950]; // sum=10432

function buildFallbackSectPr() {
  return `<w:sectPr>
    <w:headerReference r:id="rId7" w:type="default"/>
    <w:footerReference r:id="rId8" w:type="default"/>
    <w:pgSz w:h="16838" w:w="11906" w:orient="portrait"/>
    <w:pgMar w:bottom="3099" w:top="2268" w:left="1701" w:right="1701" w:header="709" w:footer="709"/>
  </w:sectPr>`;
}

// Full-page SEJUSC background watermark anchored to page at (0,0), behind all text.
// Uses rIdSejuscBg added to document.xml.rels pointing to word/media/image3.png.
const SEJUSC_BG_WATERMARK = `
  <w:p>
    <w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>
    <w:r>
      <w:drawing>
        <wp:anchor allowOverlap="1" behindDoc="1" distB="0" distT="0" distL="0" distR="0"
                   hidden="0" layoutInCell="1" locked="1" relativeHeight="1" simplePos="0">
          <wp:simplePos x="0" y="0"/>
          <wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH>
          <wp:positionV relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionV>
          <wp:extent cx="7575111" cy="10708323"/>
          <wp:effectExtent b="0" l="0" r="0" t="0"/>
          <wp:wrapNone/>
          <wp:docPr id="9001" name="SejuscBackground"/>
          <wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>
          <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:nvPicPr>
                  <pic:cNvPr id="0" name="SejuscBackground"/>
                  <pic:cNvPicPr preferRelativeResize="0"/>
                </pic:nvPicPr>
                <pic:blipFill>
                  <a:blip r:embed="rIdSejuscBg">
                    <a:alphaModFix amt="100000"/>
                  </a:blip>
                  <a:srcRect b="0" l="0" r="0" t="0"/>
                  <a:stretch><a:fillRect/></a:stretch>
                </pic:blipFill>
                <pic:spPr>
                  <a:xfrm><a:off x="0" y="0"/><a:ext cx="7575111" cy="10708323"/></a:xfrm>
                  <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                  <a:ln/>
                </pic:spPr>
              </pic:pic>
            </a:graphicData>
          </a:graphic>
        </wp:anchor>
      </w:drawing>
    </w:r>
  </w:p>`;

function buildBodyContent(checklist) {
  const date   = new Date(checklist.createdAt).toLocaleDateString("pt-BR");
  const status = checklist.status === "APROVADO" ? "APROVADO" : checklist.status === "REJEITADO" ? "REJEITADO" : "PENDENTE";

  // Header row
  const headerRow = `
  <w:tr>
    <w:trPr><w:trHeight w:val="480"/><w:tblHeader/></w:trPr>
    ${cell("Nº",      COLS[0], { bold: true, center: true, shade: "1B335D", noWrap: true })}
    ${cell("ITEM",    COLS[1], { bold: true, shade: "1B335D" })}
    ${cell("CÓDIGO",  COLS[2], { bold: true, center: true, shade: "1B335D" })}
    ${cell("QTD",     COLS[3], { bold: true, center: true, shade: "1B335D", noWrap: true })}
    ${cell("UN.",     COLS[4], { bold: true, center: true, shade: "1B335D", noWrap: true })}
    ${cell("SAÍDA",   COLS[5], { bold: true, center: true, shade: "1B335D", noWrap: true })}
    ${cell("RETORNO", COLS[6], { bold: true, center: true, shade: "1B335D", noWrap: true })}
  </w:tr>`;

  // Make header row text white
  const headerRowWhite = headerRow.replace(
    /<w:sz w:val="20"\/><w:szCs w:val="20"\/>/g,
    `<w:color w:val="FFFFFF"/><w:sz w:val="20"/><w:szCs w:val="20"/>`,
  );

  // Data rows
  const dataRows = checklist.items.map((ci, i) => {
    const shade = i % 2 === 0 ? "F5F7FA" : "FFFFFF";
    const name  = ci.unit?.item?.name    || ci.item?.name    || "—";
    const tombo = ci.unit?.tombo         || ci.item?.code    || "—";
    const uMed  = ci.unit?.item?.unitMeasure || ci.item?.unitMeasure || "un";
    const qty   = ci.quantity ?? 1;
    return `
  <w:tr>
    <w:trPr><w:trHeight w:val="480"/></w:trPr>
    ${cell(String(i + 1), COLS[0], { center: true, shade, noWrap: true })}
    ${cell(name,          COLS[1], { shade })}
    ${cell(tombo,         COLS[2], { center: true, shade })}
    ${cell(String(qty),   COLS[3], { center: true, shade, noWrap: true })}
    ${cell(uMed,          COLS[4], { center: true, shade, noWrap: true })}
    ${checkboxCell(COLS[5])}
    ${checkboxCell(COLS[6])}
  </w:tr>`;
  }).join("\n");

  const colWidthTags = COLS.map((w) => `<w:col w:w="${w}" w:type="dxa"/>`).join("\n");

  return `
  ${SEJUSC_BG_WATERMARK}
  <w:p>
    <w:pPr><w:jc w:val="center"/><w:spacing w:before="120" w:after="60"/></w:pPr>
    <w:r><w:rPr>
      <w:rFonts w:ascii="Montserrat" w:hAnsi="Montserrat" w:cs="Montserrat"/>
      <w:b/><w:color w:val="000000"/><w:sz w:val="32"/><w:szCs w:val="32"/>
    </w:rPr><w:t>CHECKLIST DE MATERIAIS</w:t></w:r>
  </w:p>
  <w:p>
    <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="100"/></w:pPr>
    <w:r><w:rPr>
      <w:rFonts w:ascii="Montserrat" w:hAnsi="Montserrat" w:cs="Montserrat"/>
      <w:b/><w:color w:val="000000"/><w:sz w:val="26"/><w:szCs w:val="26"/>
    </w:rPr><w:t>${esc(checklist.title)}</w:t></w:r>
  </w:p>
  <w:p>
    <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="40"/></w:pPr>
    <w:r><w:rPr>
      <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
      <w:color w:val="000000"/><w:sz w:val="18"/><w:szCs w:val="18"/>
    </w:rPr><w:t xml:space="preserve">${esc(NUCLEO_LABEL[checklist.nucleo])}    |    Data: ${esc(date)}    |    Status: ${esc(status)}</w:t></w:r>
  </w:p>
  <w:p>
    <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="120"/></w:pPr>
    <w:r><w:rPr>
      <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
      <w:color w:val="000000"/><w:sz w:val="16"/><w:szCs w:val="16"/>
    </w:rPr><w:t xml:space="preserve">Solicitado por: ${esc(checklist.createdBy?.name || "—")}${checklist.approvedBy ? `    |    Autorizado por: ${esc(checklist.approvedBy.name)}` : ""}</w:t></w:r>
  </w:p>
  ${checklist.note ? `<w:p>
    <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="120"/></w:pPr>
    <w:r><w:rPr>
      <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
      <w:i/><w:color w:val="000000"/><w:sz w:val="18"/><w:szCs w:val="18"/>
    </w:rPr><w:t>${esc(checklist.note)}</w:t></w:r>
  </w:p>` : ""}
  <w:tbl>
    <w:tblPr>
      <w:tblW w:w="10432" w:type="dxa"/>
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
  <w:p><w:pPr><w:spacing w:before="280" w:after="0"/></w:pPr></w:p>
  <w:tbl>
    <w:tblPr>
      <w:tblW w:w="10432" w:type="dxa"/>
      <w:jc w:val="center"/>
      <w:tblBorders>
        <w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/>
        <w:insideH w:val="nil"/><w:insideV w:val="nil"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tblGrid>
      <w:gridCol w:w="4897"/><w:gridCol w:w="638"/><w:gridCol w:w="4897"/>
    </w:tblGrid>
    <w:tr>
      <w:tc>
        <w:tcPr><w:tcW w:w="4897" w:type="dxa"/><w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="1B335D"/><w:right w:val="nil"/></w:tcBorders></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="60"/></w:pPr></w:p>
      </w:tc>
      <w:tc><w:tcPr><w:tcW w:w="638" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p></w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="4897" w:type="dxa"/><w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="1B335D"/><w:right w:val="nil"/></w:tcBorders></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="60"/></w:pPr></w:p>
      </w:tc>
    </w:tr>
    <w:tr>
      <w:tc>
        <w:tcPr><w:tcW w:w="4897" w:type="dxa"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="60" w:after="0"/></w:pPr>
          <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="16"/><w:szCs w:val="16"/><w:color w:val="555555"/></w:rPr>
            <w:t>Respons&#225;vel pela entrega</w:t>
          </w:r>
        </w:p>
      </w:tc>
      <w:tc><w:tcPr><w:tcW w:w="638" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p></w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="4897" w:type="dxa"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="60" w:after="0"/></w:pPr>
          <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="16"/><w:szCs w:val="16"/><w:color w:val="555555"/></w:rPr>
            <w:t>Respons&#225;vel pela retirada</w:t>
          </w:r>
        </w:p>
      </w:tc>
    </w:tr>
  </w:tbl>

  <w:p><w:pPr><w:spacing w:before="200" w:after="0"/></w:pPr></w:p>`;
}
