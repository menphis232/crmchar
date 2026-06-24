import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
const TVM_LOGO_PATH = path.join(__dirname, '..', 'assets', 'tvm-logo.png');

async function loadLogoBuffer(logoUrl) {
  if (!logoUrl) return null;
  if (logoUrl.startsWith('/uploads/')) {
    const filePath = path.join(uploadDir, path.basename(logoUrl));
    if (fs.existsSync(filePath)) return fs.readFileSync(filePath);
    return null;
  }
  try {
    const response = await fetch(logoUrl);
    if (response.ok) return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
  return null;
}

async function resolvePdfLogoBuffer(concesionaria) {
  const settings = concesionaria?.pdf_settings || {};
  const candidates = [
    settings.logoUrl,
    concesionaria?.logo_url,
  ].filter(Boolean);

  for (const logoUrl of candidates) {
    const logoBuffer = await loadLogoBuffer(logoUrl);
    if (logoBuffer) return logoBuffer;
  }

  if (fs.existsSync(TVM_LOGO_PATH)) {
    return fs.readFileSync(TVM_LOGO_PATH);
  }

  return null;
}

const CONCESIONARIA_DEFAULT_LAYOUT = ['header', 'title', 'client', 'auto', 'financial', 'items', 'footer'];
const GESTOR_DEFAULT_LAYOUT = ['header', 'title', 'client', 'tramite', 'includes', 'requirements', 'bonus', 'total', 'footer'];

function parseChecklistForPdf(val) {
  if (!val) return [];
  let arr = val;
  if (typeof val === 'string') {
    try { arr = JSON.parse(val); } catch { return []; }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item) => {
      if (typeof item === 'string') return { text: item, checked: true };
      return { text: String(item?.text || '').trim(), checked: item?.checked !== false };
    })
    .filter((item) => item.text && item.checked);
}

function renderChecklistBlock(doc, title, items, GOLD, BLACK) {
  if (!items.length) return;
  doc.fillColor(GOLD).fontSize(12).text(title);
  doc.rect(doc.x, doc.y + 5, 500, 1).fill(GOLD);
  doc.moveDown(1.2);
  for (const item of items) {
    doc.fillColor(BLACK).fontSize(10).text(`✓ ${item.text}`, { lineGap: 4 });
  }
  doc.moveDown(1.5);
}

const CONCESIONARIA_DEFAULT_FOOTER =
  'Esta cotización es de carácter informativo y está sujeta a cambios sin previo aviso. Los cálculos de financiamiento pueden variar dependiendo del historial crediticio del solicitante.';

const GESTOR_DEFAULT_FOOTER =
  'Esta cotización es de carácter informativo y está sujeta a cambios sin previo aviso. Los gastos de operación pueden variar según requisitos adicionales del trámite.';

function isGestorRole(role) {
  return role === 'gestor';
}

function normalizePdfLayout(layout, role) {
  const isGestor = isGestorRole(role);
  const allowed = new Set(isGestor ? GESTOR_DEFAULT_LAYOUT : CONCESIONARIA_DEFAULT_LAYOUT);
  const defaultLayout = isGestor ? GESTOR_DEFAULT_LAYOUT : CONCESIONARIA_DEFAULT_LAYOUT;
  const source = Array.isArray(layout) && layout.length > 0 ? layout : defaultLayout;
  const legacyGestorSkip = new Set(['auto', 'items', 'financial']);
  const filtered = source.filter((id) => {
    if (isGestor && legacyGestorSkip.has(id)) return false;
    return allowed.has(id) && !(isGestor && id === 'auto');
  });
  for (const id of defaultLayout) {
    if (!filtered.includes(id)) filtered.push(id);
  }
  if (isGestor) {
    const totalIdx = filtered.indexOf('total');
    const footerIdx = filtered.indexOf('footer');
    if (totalIdx >= 0 && footerIdx >= 0 && totalIdx > footerIdx) {
      filtered.splice(totalIdx, 1);
      filtered.splice(footerIdx, 0, 'total');
    }
    if (!filtered.includes('total')) {
      const fIdx = filtered.indexOf('footer');
      if (fIdx >= 0) filtered.splice(fIdx, 0, 'total');
      else filtered.push('total');
    }
  }
  return filtered;
}

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`;
}

const PDF_LOGO_BOX_PT = 48;

/** Escala el logo con recorte circular tipo object-fit: cover (como la vista previa). */
function drawPdfLogoCover(doc, logoBuffer, x, y, boxSize = PDF_LOGO_BOX_PT) {
  const img = doc.openImage(logoBuffer);
  const scale = Math.max(boxSize / img.width, boxSize / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const ox = x + (boxSize - w) / 2;
  const oy = y + (boxSize - h) / 2;
  const radius = boxSize / 2;
  doc.save();
  doc.circle(x + radius, y + radius, radius).clip();
  doc.image(logoBuffer, ox, oy, { width: w, height: h });
  doc.restore();
  return boxSize;
}

/**
 * Generates a PDF Quote and pipes it to the provided writable stream (e.g., HTTP Response).
 * @param {Object} deal - Deal data (includes contact and auto details if available)
 * @param {Object} quote - Quote data (id, total, items, valid_until, etc)
 * @param {Object} orgUser - User details of the org (including pdf_settings, role)
 * @param {WritableStream} res - Express response stream
 */
export async function generateQuotePdf(deal, quote, orgUser, res) {
  const concesionaria = orgUser;
  const isGestor = isGestorRole(orgUser?.role);
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  // Pipe its output to the response
  doc.pipe(res);

  // Settings parsing
  const settings = concesionaria?.pdf_settings || {};
  const layout = normalizePdfLayout(settings.layout, orgUser?.role);

  // Colors
  const GOLD = settings.primaryColor || '#c8a94a';
  const GREEN = '#006847';
  const BLACK = '#111111';
  const GRAY = '#555555';

  const footerText = settings.footerText || (isGestor ? GESTOR_DEFAULT_FOOTER : CONCESIONARIA_DEFAULT_FOOTER);

  // Block definitions
  const blocks = {
    header: async () => {
      let logoLoaded = false;
      const headerStartY = doc.y;
      try {
        const logoBuffer = await resolvePdfLogoBuffer(concesionaria);
        if (logoBuffer) {
          drawPdfLogoCover(doc, logoBuffer, 50, headerStartY);
          logoLoaded = true;
        }
      } catch (err) {
        console.warn('Could not load PDF logo:', err.message);
      }

      if (!logoLoaded) {
        doc
          .fillColor(GREEN)
          .fontSize(24)
          .text('TRÁMITES', 50, headerStartY, { continued: true })
          .fillColor(GOLD)
          .text('VEHICULARES', { continued: true })
          .fillColor(GREEN)
          .text('.mx');
      }

      doc.y = logoLoaded ? headerStartY + PDF_LOGO_BOX_PT + 10 : doc.y + 10;

      doc
        .fillColor(GRAY)
        .fontSize(10)
        .text(concesionaria?.name || (isGestor ? 'Gestoría Autorizada' : 'Concesionaria Autorizada'), 50, doc.y)
        .text(concesionaria?.email || 'contacto@tramitesvehiculares.mx');
      
      doc.moveDown(2);
    },

    title: async () => {
      doc.fillColor(BLACK).fontSize(20).text('COTIZACIÓN FORMAL', { align: 'left' });
      
      doc.moveDown(0.5);
      const quoteDate = new Date(quote.created_at).toLocaleDateString('es-MX');
      const validUntil = new Date(quote.valid_until).toLocaleDateString('es-MX');
      
      doc
        .fontSize(10)
        .fillColor(GRAY)
        .text(`Folio: ${quote.id.split('-')[0].toUpperCase()}`)
        .text(`Fecha: ${quoteDate}`)
        .text(`Válida hasta: ${validUntil}`);

      doc.moveDown(2);
    },

    client: async () => {
      doc.fillColor(GOLD).fontSize(12).text('DATOS DEL CLIENTE');
      doc.rect(doc.x, doc.y + 5, 500, 1).fill(GOLD);
      doc.moveDown(1.5);
      
      doc.fillColor(BLACK).fontSize(10)
        .text(`Nombre: ${deal.contact_name || 'N/A'}`)
        .text(`Teléfono: ${deal.contact_phone || deal.contact_whatsapp || 'N/A'}`)
        .text(`Email: ${deal.contact_email || 'N/A'}`);

      doc.moveDown(2);
    },

    auto: async () => {
      if (isGestor) return;

      doc.fillColor(GOLD).fontSize(12).text('VEHÍCULO COTIZADO');
      doc.rect(doc.x, doc.y + 5, 500, 1).fill(GOLD);
      doc.moveDown(1.5);

      doc.fillColor(BLACK).fontSize(11).text(deal.title, { bold: true });
      doc.moveDown(1);
    },

    tramite: async () => {
      if (!isGestor) return;

      doc.fillColor(GOLD).fontSize(12).text('TRÁMITE');
      doc.rect(doc.x, doc.y + 5, 500, 1).fill(GOLD);
      doc.moveDown(1.5);

      doc.fillColor(BLACK).fontSize(11).text(deal.title || 'Trámite vehicular', { bold: true });
      doc.moveDown(1);
    },

    includes: async () => {
      if (!isGestor) return;
      renderChecklistBlock(doc, 'QUÉ INCLUYE', parseChecklistForPdf(quote.includes_list), GOLD, BLACK);
    },

    requirements: async () => {
      if (!isGestor) return;
      renderChecklistBlock(doc, 'REQUISITOS', parseChecklistForPdf(quote.requirements_list), GOLD, BLACK);
    },

    bonus: async () => {
      if (!isGestor) return;
      renderChecklistBlock(doc, 'BONUS', parseChecklistForPdf(quote.bonus_list), GOLD, BLACK);
    },

    total: async () => {
      if (!isGestor) return;

      let items = [];
      try { items = typeof quote?.items === 'string' ? JSON.parse(quote.items) : (quote?.items || []); } catch (e) {}
      const itemsTotal = Array.isArray(items)
        ? items.reduce((sum, item) => sum + Number(item?.price || 0), 0)
        : 0;
      const honorarios = itemsTotal > 0
        ? itemsTotal
        : Number(quote?.total || deal.estimated_value || 0);

      doc.moveDown(0.5);
      doc.fillColor(GOLD).fontSize(12).text('TOTAL DE LA COTIZACIÓN');
      doc.rect(doc.x, doc.y + 5, 500, 1).fill(GOLD);
      doc.moveDown(1.2);
      doc.fillColor(GRAY).fontSize(10).text('Gastos de Operación:', 50, doc.y, { continued: false });
      doc.fillColor(BLACK).fontSize(10).text(formatMoney(honorarios), 350, doc.y - 12, { width: 150, align: 'right' });
      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor(GOLD).lineWidth(1).stroke();
      doc.moveDown(0.8);
      doc.fillColor(BLACK).fontSize(14).text('TOTAL:', 50, doc.y, { continued: false });
      doc.fillColor(BLACK).fontSize(14).text(formatMoney(honorarios), 350, doc.y - 16, { width: 150, align: 'right' });
      doc.moveDown(2);
    },

    financial: async () => {
      if (isGestor) return;

      doc.fillColor(GOLD).fontSize(12).text('DESGLOSE FINANCIERO');
      doc.rect(doc.x, doc.y + 5, 500, 1).fill(GOLD);
      doc.moveDown(1.5);

      const drawRow = (label, value, isTotal = false) => {
        doc.fillColor(isTotal ? BLACK : GRAY)
           .fontSize(isTotal ? 12 : 10)
           .text(label, 50, doc.y, { continued: false });
        doc.text(formatMoney(value), 350, doc.y - (isTotal ? 14 : 12), { width: 150, align: 'right' });
        doc.moveDown(0.5);
      };

      drawRow('Precio del Vehículo:', deal.estimated_value);
      
      if (deal.trade_in_value > 0) {
        drawRow('Auto a cuenta (Toma):', `-${deal.trade_in_value}`);
      }
      
      if (deal.down_payment > 0) {
        drawRow('Enganche:', `-${deal.down_payment}`);
      }

      const montoAFinanciar = Number(deal.estimated_value) - Number(deal.trade_in_value || 0) - Number(deal.down_payment || 0);

      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor(GRAY).lineWidth(0.5).stroke();
      doc.moveDown(1);
      
      drawRow('Monto a Financiar:', montoAFinanciar, true);

      if (deal.term_months > 0) {
        doc.moveDown(0.5);
        doc.fillColor(GREEN).fontSize(11).text(`Plazo Estimado: ${deal.term_months} meses`, 50, doc.y);
      }
      doc.moveDown(2);
    },

    items: async () => {
      let items = [];
      try { items = typeof quote.items === 'string' ? JSON.parse(quote.items) : quote.items; } catch(e){}
      
      if (items && items.length > 0) {
        doc.fillColor(GOLD).fontSize(12).text(isGestor ? 'CONCEPTOS / SERVICIOS' : 'EXTRAS / ACCESORIOS', 50, doc.y);
        doc.rect(50, doc.y + 5, 500, 1).fill(GOLD);
        doc.moveDown(1.5);
        
        for (let item of items) {
          doc.fillColor(GRAY).fontSize(10).text(item.description, 50, doc.y, { continued: false });
          doc.text(formatMoney(item.price), 350, doc.y - 12, { width: 150, align: 'right' });
          doc.moveDown(0.5);
        }
        doc.moveDown(2);
      }
    },

    footer: async () => {
      doc.moveDown(2);
      const footerY = Math.max(doc.y, 700);
      doc.fontSize(8).fillColor(GRAY).text(
        footerText,
        50,
        footerY,
        { align: 'center', width: 500 }
      );
    }
  };

  // Render blocks in user-defined order
  for (const blockName of layout) {
    if (blocks[blockName]) {
      await blocks[blockName]();
    }
  }

  // Finalize PDF file
  doc.end();
}
