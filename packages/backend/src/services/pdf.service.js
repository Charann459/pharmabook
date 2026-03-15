const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { query } = require('../config/db');
const { splitGst } = require('../utils/gst');
const { pdf: pdfCfg } = require('../config/env');

const generate = async (bill_id) => {
  // Fetch bill + shop + items
  const { rows: billRows } = await query(
    `SELECT b.*, s.name AS shop_name, s.address AS shop_address, s.gst_no,
            u.name AS cashier_name
     FROM bills b
     JOIN shops s ON s.id = b.shop_id
     JOIN users u ON u.id = b.cashier_id
     WHERE b.id = $1`,
    [bill_id]
  );
  if (!billRows[0]) throw new Error(`Bill ${bill_id} not found`);
  const bill = billRows[0];

  const { rows: items } = await query(
    `SELECT bi.*, m.name AS medicine_name, m.barcode
     FROM bill_items bi JOIN medicines m ON m.id = bi.medicine_id
     WHERE bi.bill_id = $1`,
    [bill_id]
  );

  const outputPath = path.join(pdfCfg.outputDir, `${bill_id}.pdf`);
  fs.mkdirSync(pdfCfg.outputDir, { recursive: true });

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A5' });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // Header
    doc.fontSize(16).font('Helvetica-Bold').text(bill.shop_name, { align: 'center' });
    doc.fontSize(9).font('Helvetica').text(bill.shop_address || '', { align: 'center' });
    doc.text(`GSTIN: ${bill.gst_no || 'N/A'}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica-Bold').text('TAX INVOICE', { align: 'center' });
    doc.moveDown(0.3);

    // Bill meta
    doc.fontSize(9).font('Helvetica');
    doc.text(`Bill No: #${bill.bill_no}   Date: ${new Date(bill.created_at).toLocaleDateString('en-IN')}`);
    doc.text(`Cashier: ${bill.cashier_name}`);
    doc.moveDown(0.5);

    // Table header
    const cols = { name: 40, qty: 230, rate: 270, gst: 315, total: 360 };
    doc.font('Helvetica-Bold').fontSize(8);
    doc.text('Medicine', cols.name, doc.y);
    doc.text('Qty', cols.qty, doc.y - doc.currentLineHeight());
    doc.text('MRP', cols.rate, doc.y - doc.currentLineHeight());
    doc.text('GST%', cols.gst, doc.y - doc.currentLineHeight());
    doc.text('Total', cols.total, doc.y - doc.currentLineHeight());
    doc.moveDown(0.2);
    doc.moveTo(40, doc.y).lineTo(530, doc.y).stroke();
    doc.moveDown(0.2);

    // Items
    doc.font('Helvetica').fontSize(8);
    for (const item of items) {
      const lineTotal = (item.unit_price * item.qty).toFixed(2);
      const y = doc.y;
      doc.text(item.medicine_name.slice(0, 28), cols.name, y);
      doc.text(String(item.qty),                cols.qty,  y);
      doc.text(`₹${Number(item.unit_price).toFixed(2)}`, cols.rate, y);
      doc.text(`${item.gst_rate}%`,              cols.gst,  y);
      doc.text(`₹${lineTotal}`,                  cols.total, y);
      doc.moveDown(0.8);
    }

    doc.moveTo(40, doc.y).lineTo(530, doc.y).stroke();
    doc.moveDown(0.3);

    // Totals
    const gst = splitGst(Number(bill.gst_amount));
    doc.font('Helvetica').fontSize(9);
    doc.text(`Subtotal:`,         350, doc.y, { continued: true }).text(`₹${Number(bill.subtotal).toFixed(2)}`, { align: 'right' });
    doc.text(`CGST:`,             350, doc.y, { continued: true }).text(`₹${gst.cgst.toFixed(2)}`, { align: 'right' });
    doc.text(`SGST:`,             350, doc.y, { continued: true }).text(`₹${gst.sgst.toFixed(2)}`, { align: 'right' });
    if (Number(bill.discount) > 0) {
      doc.text(`Discount:`,       350, doc.y, { continued: true }).text(`-₹${Number(bill.discount).toFixed(2)}`, { align: 'right' });
    }
    doc.font('Helvetica-Bold');
    doc.text(`Total:`,            350, doc.y, { continued: true }).text(`₹${Number(bill.total).toFixed(2)}`, { align: 'right' });

    doc.moveDown(1);
    doc.font('Helvetica').fontSize(8).text('Thank you for your purchase!', { align: 'center' });

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  // Update bill with pdf path
  await query(`UPDATE bills SET pdf_path = $1 WHERE id = $2`, [outputPath, bill_id]);

  return outputPath;
};

module.exports = { generate };
