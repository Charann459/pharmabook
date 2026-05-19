const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { query } = require('../config/db');
const { splitGst } = require('../utils/gst');
const { pdf: pdfCfg } = require('../config/env');

const formatCurrency = (value) => {
  return `Rs. ${Number(value || 0).toFixed(2)}`;
};

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
     FROM bill_items bi
     JOIN medicines m ON m.id = bi.medicine_id
     WHERE bi.bill_id = $1`,
    [bill_id]
  );

  const outputPath = path.join(pdfCfg.outputDir, `${bill_id}.pdf`);
  fs.mkdirSync(pdfCfg.outputDir, { recursive: true });

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 32,
      size: 'A5',
      bufferPages: true,
    });

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    const pageLeft = doc.page.margins.left;
    const pageRight = doc.page.width - doc.page.margins.right;
    const pageWidth = pageRight - pageLeft;

    const drawLine = () => {
      doc.moveTo(pageLeft, doc.y).lineTo(pageRight, doc.y).stroke();
    };

    // Header
    doc.fontSize(16).font('Helvetica-Bold').text(bill.shop_name || 'PharmaBook', {
      align: 'center',
    });

    doc.fontSize(9).font('Helvetica').text(bill.shop_address || '', {
      align: 'center',
    });

    doc.text(`GSTIN: ${bill.gst_no || 'N/A'}`, {
      align: 'center',
    });

    doc.moveDown(0.5);

    doc.fontSize(12).font('Helvetica-Bold').text('TAX INVOICE', {
      align: 'center',
    });

    doc.moveDown(0.5);

    // Bill meta
    doc.fontSize(9).font('Helvetica');

    const billDate = new Date(bill.created_at).toLocaleDateString('en-IN');

    doc.text(`Bill No: #${bill.bill_no}`, pageLeft, doc.y, {
      width: pageWidth / 2,
      align: 'left',
    });

    doc.text(`Date: ${billDate}`, pageLeft + pageWidth / 2, doc.y - doc.currentLineHeight(), {
      width: pageWidth / 2,
      align: 'right',
    });

    doc.text(`Cashier: ${bill.cashier_name || 'N/A'}`);

    doc.moveDown(0.6);

    // Table columns for A5 width
    const cols = {
      name: pageLeft,
      qty: pageLeft + 190,
      mrp: pageLeft + 225,
      gst: pageLeft + 275,
      total: pageLeft + 320,
    };

    doc.font('Helvetica-Bold').fontSize(8);

    const headerY = doc.y;

    doc.text('Medicine', cols.name, headerY, { width: 180 });
    doc.text('Qty', cols.qty, headerY, { width: 30, align: 'right' });
    doc.text('MRP', cols.mrp, headerY, { width: 45, align: 'right' });
    doc.text('GST%', cols.gst, headerY, { width: 40, align: 'right' });
    doc.text('Total', cols.total, headerY, { width: pageRight - cols.total, align: 'right' });

    doc.y = headerY + 16;
    drawLine();
    doc.moveDown(0.4);

    // Items
    doc.font('Helvetica').fontSize(8);

    for (const item of items) {
      const y = doc.y;
      const qty = Number(item.qty || 0);
      const unitPrice = Number(item.unit_price || 0);
      const lineTotal = unitPrice * qty;

      doc.text(String(item.medicine_name || '').slice(0, 34), cols.name, y, {
        width: 180,
      });

      doc.text(String(qty), cols.qty, y, {
        width: 30,
        align: 'right',
      });

      doc.text(formatCurrency(unitPrice), cols.mrp, y, {
        width: 45,
        align: 'right',
      });

      doc.text(`${Number(item.gst_rate || 0).toFixed(2)}%`, cols.gst, y, {
        width: 40,
        align: 'right',
      });

      doc.text(formatCurrency(lineTotal), cols.total, y, {
        width: pageRight - cols.total,
        align: 'right',
      });

      doc.y = y + 18;
    }

    doc.moveDown(0.2);
    drawLine();
    doc.moveDown(0.6);

    // Totals
    const gst = splitGst(Number(bill.gst_amount || 0));

    const summaryLabelX = pageLeft + 210;
    const summaryValueX = pageLeft + 295;
    const summaryLabelWidth = 80;
    const summaryValueWidth = pageRight - summaryValueX;

    const summaryRow = (label, value, bold = false) => {
      const y = doc.y;

      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);

      doc.text(label, summaryLabelX, y, {
        width: summaryLabelWidth,
        align: 'left',
      });

      doc.text(value, summaryValueX, y, {
        width: summaryValueWidth,
        align: 'right',
      });

      doc.y = y + 16;
    };

    summaryRow('Subtotal:', formatCurrency(bill.subtotal));
    summaryRow('CGST:', formatCurrency(gst.cgst));
    summaryRow('SGST:', formatCurrency(gst.sgst));

    if (Number(bill.discount || 0) > 0) {
      summaryRow('Discount:', `- ${formatCurrency(bill.discount)}`);
    }

    summaryRow('Total:', formatCurrency(bill.total), true);

    doc.moveDown(1.2);

    doc.font('Helvetica').fontSize(8).text('Thank you for your purchase!', pageLeft, doc.y, {
      width: pageWidth,
      align: 'center',
    });

    doc.end();

    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  // Update bill with pdf path
  await query(`UPDATE bills SET pdf_path = $1 WHERE id = $2`, [outputPath, bill_id]);

  return outputPath;
};

module.exports = { generate };