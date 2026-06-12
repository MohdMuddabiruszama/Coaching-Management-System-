/**
 * Salary Slip PDF Service
 * Phase 7 — Faculty Salary.md
 *
 * Streams a professional salary slip PDF to the HTTP response.
 * Uses pdfkit — zero temp files on disk (streaming).
 * Called from GET /api/salary/:id/slip
 */

const PDFDocument = require("pdfkit");

/**
 * Generate and stream a salary slip PDF.
 * @param {object} salary   - FacultySalary instance
 * @param {object} faculty  - { name, email } of the faculty
 * @param {object} institute - { name, address, phone } of the institute
 * @param {object} res      - Express response object
 */
async function generateSalarySlipPDF(salary, faculty, institute, res) {
    const doc = new PDFDocument({ size: "A4", margin: 50 });

    const fileName = `salary_slip_${(faculty.name || "faculty").replace(/\s+/g, "_")}_${salary.month_year}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    doc.pipe(res);

    // ── Color scheme ─────────────────────────────────────────────────────────
    const PRIMARY   = "#4f46e5"; // indigo
    const SECONDARY = "#6b7280"; // gray
    const SUCCESS   = "#059669"; // green
    const LIGHT_BG  = "#f9fafb";

    // ── Helper: labeled value row ─────────────────────────────────────────────
    const drawRow = (label, value, bold = false) => {
        doc.fontSize(10)
           .font(bold ? "Helvetica-Bold" : "Helvetica-Bold")
           .fillColor(SECONDARY)
           .text(label, { continued: true, width: 220 });
        doc.font(bold ? "Helvetica-Bold" : "Helvetica")
           .fillColor("#111827")
           .text(String(value || "—"));
        doc.moveDown(0.3);
    };

    // ═══════════════════════════════════════════════════════════════════════
    // HEADER — Institute name + SALARY SLIP title
    // ═══════════════════════════════════════════════════════════════════════
    // Top blue bar
    doc.rect(50, 40, 495, 6).fillAndStroke(PRIMARY, PRIMARY);
    doc.moveDown(0.5);

    doc.fontSize(20).font("Helvetica-Bold").fillColor(PRIMARY)
       .text(institute.name || "Institute", { align: "center" });

    if (institute.address) {
        doc.fontSize(9).font("Helvetica").fillColor(SECONDARY)
           .text(institute.address, { align: "center" });
    }
    if (institute.phone) {
        doc.fontSize(9).font("Helvetica").fillColor(SECONDARY)
           .text(`Phone: ${institute.phone}`, { align: "center" });
    }

    doc.moveDown(0.5);
    doc.fontSize(14).font("Helvetica-Bold").fillColor("#111827")
       .text("SALARY SLIP", { align: "center", underline: false });
    doc.fontSize(10).font("Helvetica").fillColor(SECONDARY)
       .text(`Pay Period: ${salary.month_year}`, { align: "center" });

    doc.moveDown(0.5);
    // Divider
    doc.rect(50, doc.y, 495, 1).fillAndStroke("#e5e7eb", "#e5e7eb");
    doc.moveDown(1);

    // ═══════════════════════════════════════════════════════════════════════
    // EMPLOYEE DETAILS SECTION
    // ═══════════════════════════════════════════════════════════════════════
    doc.fontSize(11).font("Helvetica-Bold").fillColor(PRIMARY)
       .text("EMPLOYEE DETAILS");
    doc.moveDown(0.4);

    drawRow("Employee Name:", faculty.name);
    drawRow("Email:", faculty.email);
    drawRow("Month / Year:", salary.month_year);
    if (salary.payment_date) {
        drawRow("Payment Date:", new Date(salary.payment_date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }));
    }
    drawRow("Payment Method:", (salary.payment_method || "N/A").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()));
    if (salary.transaction_ref) {
        drawRow("Transaction Ref:", salary.transaction_ref);
    }

    doc.moveDown(0.5);
    doc.rect(50, doc.y, 495, 1).fillAndStroke("#e5e7eb", "#e5e7eb");
    doc.moveDown(0.8);

    // ═══════════════════════════════════════════════════════════════════════
    // ATTENDANCE SECTION
    // ═══════════════════════════════════════════════════════════════════════
    doc.fontSize(11).font("Helvetica-Bold").fillColor(PRIMARY)
       .text("ATTENDANCE");
    doc.moveDown(0.4);

    drawRow("Working Days:", `${salary.working_days} days`);
    drawRow("Days Present:", `${salary.present_days} days`);
    const attPct = salary.working_days > 0
        ? ((salary.present_days / salary.working_days) * 100).toFixed(1)
        : "100.0";
    drawRow("Attendance:", `${attPct}%`);

    doc.moveDown(0.5);
    doc.rect(50, doc.y, 495, 1).fillAndStroke("#e5e7eb", "#e5e7eb");
    doc.moveDown(0.8);

    // ═══════════════════════════════════════════════════════════════════════
    // EARNINGS & DEDUCTIONS TABLE
    // ═══════════════════════════════════════════════════════════════════════
    const formatINR = (n) => `₹${parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

    // Two-column layout: Earnings | Deductions
    const leftX  = 50;
    const rightX = 300;
    const tableY = doc.y;

    // Earnings column
    doc.fontSize(11).font("Helvetica-Bold").fillColor(PRIMARY)
       .text("EARNINGS", leftX, tableY);
    doc.moveDown(0.4);

    const basicSalary  = parseFloat(salary.basic_salary || 0);
    const presentDays  = parseFloat(salary.present_days || 0);
    const workingDays  = parseFloat(salary.working_days || 26);
    const factor       = workingDays > 0 ? presentDays / workingDays : 1;
    const earnedBasic  = parseFloat((basicSalary * factor).toFixed(2));
    const allowances   = parseFloat(salary.allowances || 0);

    doc.fontSize(10).font("Helvetica-Bold").fillColor(SECONDARY).text("Basic (Full Month):", leftX, null, { continued: true, width: 170 });
    doc.font("Helvetica").fillColor("#111827").text(formatINR(basicSalary));
    doc.moveDown(0.3);

    if (presentDays < workingDays) {
        doc.fontSize(10).font("Helvetica-Bold").fillColor(SECONDARY).text("Earned Basic (Pro-Rata):", leftX, null, { continued: true, width: 170 });
        doc.font("Helvetica").fillColor(SUCCESS).text(formatINR(earnedBasic));
        doc.moveDown(0.3);
    }

    if (allowances > 0) {
        doc.fontSize(10).font("Helvetica-Bold").fillColor(SECONDARY).text("Allowances:", leftX, null, { continued: true, width: 170 });
        doc.font("Helvetica").fillColor(SUCCESS).text(formatINR(allowances));
        doc.moveDown(0.3);
    }

    const leftEndY = doc.y;

    // Deductions column (right side)
    const deductions  = parseFloat(salary.deductions  || 0);
    const advancePaid = parseFloat(salary.advance_paid || 0);

    doc.fontSize(11).font("Helvetica-Bold").fillColor("#dc2626")
       .text("DEDUCTIONS", rightX, tableY);

    let deductY = tableY + 20;
    if (deductions > 0) {
        doc.fontSize(10).font("Helvetica-Bold").fillColor(SECONDARY)
           .text("Deductions:", rightX, deductY, { continued: true, width: 160 });
        doc.font("Helvetica").fillColor("#dc2626").text(formatINR(deductions));
        deductY += 18;
    }
    if (advancePaid > 0) {
        doc.fontSize(10).font("Helvetica-Bold").fillColor(SECONDARY)
           .text("Advance Paid:", rightX, deductY, { continued: true, width: 160 });
        doc.font("Helvetica").fillColor("#dc2626").text(formatINR(advancePaid));
    }

    doc.y = Math.max(leftEndY, doc.y);

    doc.moveDown(2);

    // ═══════════════════════════════════════════════════════════════════════
    // NET SALARY BAR
    // ═══════════════════════════════════════════════════════════════════════
    const barY = doc.y;
    doc.rect(50, barY, 495, 40).fillAndStroke(PRIMARY, PRIMARY);

    doc.fontSize(14).font("Helvetica-Bold").fillColor("#ffffff")
       .text(`NET SALARY:  ${formatINR(salary.net_salary)}`, 60, barY + 12, {
           align:  "left",
           width:  475,
       });

    doc.moveDown(3);

    // ═══════════════════════════════════════════════════════════════════════
    // FOOTER
    // ═══════════════════════════════════════════════════════════════════════
    if (salary.remarks) {
        doc.fontSize(9).font("Helvetica-Bold").fillColor(SECONDARY).text("Remarks:");
        doc.font("Helvetica").fillColor("#374151").text(salary.remarks);
        doc.moveDown(0.5);
    }

    doc.rect(50, doc.y, 495, 1).fillAndStroke("#e5e7eb", "#e5e7eb");
    doc.moveDown(0.5);

    doc.fontSize(8).font("Helvetica").fillColor(SECONDARY)
       .text("This is a computer-generated salary slip. No signature required.", { align: "center" });
    doc.text(`Generated on: ${new Date().toLocaleDateString("en-IN")}`, { align: "center" });

    // Bottom color bar
    doc.rect(50, doc.page.height - 50, 495, 4).fillAndStroke(PRIMARY, PRIMARY);

    doc.end();
}

module.exports = { generateSalarySlipPDF };
