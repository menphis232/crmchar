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

/**
 * Generates a PDF Quote and pipes it to the provided writable stream (e.g., HTTP Response).
 * @param {Object} deal - Deal data (includes contact and auto details if available)
 * @param {Object} quote - Quote data (id, total, items, valid_until, etc)
 * @param {Object} concesionaria - User details of the concesionaria (including pdf_settings)
 * @param {WritableStream} res - Express response stream
 */
export async function generateQuotePdf(deal, quote, concesionaria, res) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  // Pipe its output to the response
  doc.pipe(res);

  // Settings parsing
  const settings = concesionaria?.pdf_settings || {};
  const defaultLayout = ['header', 'title', 'client', 'auto', 'financial', 'items', 'footer'];
  const layout = Array.isArray(settings.layout) && settings.layout.length > 0 ? settings.layout : defaultLayout;

  // Colors
  const GOLD = settings.primaryColor || '#c8a94a';
  const GREEN = '#006847';
  const BLACK = '#111111';
  const GRAY = '#555555';

  const footerText = settings.footerText || 'Esta cotización es de carácter informativo y está sujeta a cambios sin previo aviso. Los cálculos de financiamiento pueden variar dependiendo del historial crediticio del solicitante.';

  // Block definitions
  const blocks = {
    header: async () => {
      let logoLoaded = false;
      try {
        const logoBuffer = await resolvePdfLogoBuffer(concesionaria);
        if (logoBuffer) {
          doc.image(logoBuffer, 50, doc.y, { height: 40 });
          logoLoaded = true;
        }
      } catch (err) {
        console.warn('Could not load PDF logo:', err.message);
      }

      if (!logoLoaded) {
        doc
          .fillColor(GREEN)
          .fontSize(24)
          .text('TRÁMITES', 50, doc.y, { continued: true })
          .fillColor(GOLD)
          .text('VEHICULARES', { continued: true })
          .fillColor(GREEN)
          .text('.mx');
      }

      doc.y = Math.max(doc.y, doc.y + (logoLoaded ? 40 : 10)) + 10;

      doc
        .fillColor(GRAY)
        .fontSize(10)
        .text(concesionaria?.name || 'Concesionaria Autorizada', 50, doc.y)
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
      doc.fillColor(GOLD).fontSize(12).text('VEHÍCULO COTIZADO');
      doc.rect(doc.x, doc.y + 5, 500, 1).fill(GOLD);
      doc.moveDown(1.5);

      doc.fillColor(BLACK).fontSize(11).text(deal.title, { bold: true });
      doc.moveDown(1);
    },

    financial: async () => {
      doc.fillColor(GOLD).fontSize(12).text('DESGLOSE FINANCIERO');
      doc.rect(doc.x, doc.y + 5, 500, 1).fill(GOLD);
      doc.moveDown(1.5);

      const drawRow = (label, value, isTotal = false) => {
        doc.fillColor(isTotal ? BLACK : GRAY)
           .fontSize(isTotal ? 12 : 10)
           .text(label, 50, doc.y, { continued: false });
        doc.text(`$${Number(value).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`, 350, doc.y - (isTotal ? 14 : 12), { width: 150, align: 'right' });
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
        doc.fillColor(GOLD).fontSize(12).text('EXTRAS / ACCESORIOS', 50, doc.y);
        doc.rect(50, doc.y + 5, 500, 1).fill(GOLD);
        doc.moveDown(1.5);
        
        for (let item of items) {
          doc.fillColor(GRAY).fontSize(10).text(item.description, 50, doc.y, { continued: false });
          doc.text(`$${Number(item.price).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`, 350, doc.y - 12, { width: 150, align: 'right' });
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
