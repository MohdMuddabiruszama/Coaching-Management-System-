/**
 * Export Subscriptions — Excel + PDF
 * Server-side export using exceljs and pdfkit (already installed).
 */

const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { formatCurrency, formatDate } = require('./format');

// ─── Excel Export ─────────────────────────────────────────────
async function exportExcel(res, data) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Subscriptions');

    ws.columns = [
        { header: '#', key: 'id', width: 8 },
        { header: 'Institute', key: 'institute', width: 25 },
        { header: 'Email', key: 'email', width: 28 },
        { header: 'Plan', key: 'plan', width: 18 },
        { header: 'Billing', key: 'billing', width: 14 },
        { header: 'Original (₹)', key: 'original', width: 14 },
        { header: 'Discount (₹)', key: 'discount', width: 12 },
        { header: 'GST (₹)', key: 'gst', width: 12 },
        { header: 'Total (₹)', key: 'total', width: 14 },
        { header: 'From', key: 'from', width: 12 },
        { header: 'To', key: 'to', width: 12 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Mode', key: 'mode', width: 10 },
    ];

    // Style header row
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = {
        type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A1628' }
    };

    data.forEach((sub) => {
        const original = parseFloat(sub.original_price || sub.amount_paid || 0);
        const row = ws.addRow({
            id: sub.id,
            institute: sub.Institute?.name || 'Unknown',
            email: sub.Institute?.email || '',
            plan: `${sub.Plan?.name || 'Custom'} (${sub.Plan?.platform_type || 'web'})`,
            billing: sub.billing_cycle || 'monthly',
            original: original,
            discount: parseFloat(sub.discount_amount || 0),
            gst: parseFloat(sub.tax_amount || 0),
            total: parseFloat(sub.amount_paid || 0),
            from: formatDate(sub.start_date),
            to: formatDate(sub.end_date),
            status: (sub.payment_status || '').toUpperCase(),
            mode: sub.is_test ? 'TEST' : 'LIVE',
        });

        // Highlight test rows in yellow
        if (sub.is_test) {
            row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } };
        }
    });

    res.setHeader('Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',
        'attachment; filename="subscriptions.xlsx"');
    await wb.xlsx.write(res);
    res.end();
}

// ─── PDF Export ───────────────────────────────────────────────
function exportPDF(res, data) {
    const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="subscriptions.pdf"');
    doc.pipe(res);

    doc.fontSize(16).font('Helvetica-Bold')
        .text('Subscriptions Report', { align: 'center' });
    doc.fontSize(10).font('Helvetica').fillColor('#888')
        .text(`Generated: ${new Date().toLocaleDateString('en-IN')}  |  Live payments only`,
            { align: 'center' });
    doc.moveDown(1.5);

    data.forEach((sub, i) => {
        const name = sub.Institute?.name || 'Unknown';
        const mode = sub.is_test ? 'TEST' : 'LIVE';
        const status = (sub.payment_status || 'unknown').toUpperCase();

        doc.fillColor(sub.is_test ? '#FF8F00' : '#0A1628').fontSize(11)
            .font('Helvetica-Bold')
            .text(`#${sub.id}  ${name}  [${mode}]  ${status}`);

        doc.fillColor('#444').fontSize(9).font('Helvetica')
            .text(`Plan: ${sub.Plan?.name || 'Custom'} · ` +
                `Total: ${formatCurrency(sub.amount_paid)} · ` +
                `${formatDate(sub.start_date)} to ${formatDate(sub.end_date)}`);
        doc.moveDown(0.5);

        if (i < data.length - 1) {
            doc.moveTo(40, doc.y).lineTo(800, doc.y).strokeColor('#eee').stroke();
        }
        doc.moveDown(0.3);
    });

    doc.end();
}

module.exports = { exportExcel, exportPDF };
