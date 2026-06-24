import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
const invoicesDir = path.join(uploadDir, 'invoices');

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

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`;
}

function paymentMethodLabel(method) {
  const map = {
    mercadopago: 'Mercado Pago',
    stripe: 'Tarjeta (Stripe)',
    manual: 'Manual',
    efectivo: 'Efectivo',
    transferencia: 'Transferencia bancaria',
    tarjeta: 'Tarjeta',
    otro: 'Otro',
  };
  return map[method] || method;
}

/**
 * Genera PDF de factura/recibo y lo guarda en uploads/invoices/
 * @returns {Promise<{ filePath: string, pdfUrl: string }>}
 */
export async function generateInvoicePdfFile({ deal, orgUser, amount, invoiceNumber, paymentMethod, mpOrderId }) {
  if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir, { recursive: true });

  const safeName = invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeName}.pdf`;
  const filePath = path.join(invoicesDir, filename);
  const pdfUrl = `/uploads/invoices/${filename}`;

  const settings = orgUser?.pdf_settings || {};
  const primary = settings.primaryColor || '#009ee3';
  const footerText = settings.footerText || 'Comprobante de pago emitido electrónicamente.';

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const logoBuffer = await loadLogoBuffer(settings.logoUrl || orgUser?.logo_url);
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, 50, 45, { width: 48, height: 48, fit: [48, 48] });
    } catch {
      /* ignore bad logo */
    }
  }

  doc.fontSize(10).fillColor('#666').text(orgUser?.name || 'Gestoría', 110, 48);
  doc.fontSize(8).fillColor('#888').text(orgUser?.email || '', 110, 64);

  doc.fontSize(22).fillColor(primary).text('COMPROBANTE DE PAGO', 50, 110, { align: 'right' });
  doc.fontSize(10).fillColor('#333').text(`Folio: ${invoiceNumber}`, 50, 138, { align: 'right' });
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-MX')}`, { align: 'right' });

  doc.moveDown(2);
  doc.fontSize(12).fillColor('#111').text('Datos del cliente', 50, 180);
  doc.fontSize(10).fillColor('#444');
  doc.text(`Nombre: ${deal.contact_name || 'Cliente'}`);
  doc.text(`Email: ${deal.contact_email || '—'}`);
  if (deal.contact_phone) doc.text(`Teléfono: ${deal.contact_phone}`);

  doc.moveDown();
  doc.fontSize(12).fillColor('#111').text('Detalle del trámite');
  doc.fontSize(10).fillColor('#444');
  doc.text(`Concepto: ${deal.title || 'Trámite vehicular'}`);
  if (deal.tracking_code) doc.text(`Código de seguimiento: ${deal.tracking_code}`);
  doc.text(`Método de pago: ${paymentMethodLabel(paymentMethod)}`);
  if (mpOrderId) doc.text(`Referencia MP: ${mpOrderId}`);

  const tableTop = doc.y + 20;
  doc.rect(50, tableTop, 495, 28).fill(primary);
  doc.fillColor('#fff').fontSize(10).text('Concepto', 58, tableTop + 9);
  doc.text('Importe', 450, tableTop + 9, { width: 80, align: 'right' });

  doc.fillColor('#333').rect(50, tableTop + 28, 495, 32).stroke('#ddd');
  doc.text(deal.title || 'Trámite vehicular', 58, tableTop + 38, { width: 360 });
  doc.text(formatMoney(amount), 450, tableTop + 38, { width: 80, align: 'right' });

  doc.fontSize(14).fillColor(primary).text(`Total pagado: ${formatMoney(amount)}`, 50, tableTop + 80, { align: 'right' });

  doc.fontSize(8).fillColor('#888').text(footerText, 50, 720, { align: 'center', width: 495 });

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return { filePath, pdfUrl };
}
