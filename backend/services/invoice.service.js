const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

exports.generateInvoice = async ({
    institute,
    plan,
    subscription,
}) => {

    const invoiceNumber = `INV-${new Date().getFullYear()}-${institute.id}-${String(Date.now()).slice(-4)}`;
    const fileName = `${invoiceNumber}.pdf`;
    const invoicesDir = path.join(__dirname, "../uploads/invoices");
    if (!fs.existsSync(invoicesDir)) {
        fs.mkdirSync(invoicesDir, { recursive: true });
    }
    const filePath = path.join(invoicesDir, fileName);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(fs.createWriteStream(filePath));

    // Colors
    const primaryColor = "#4f46e5";
    const textColor = "#333333";
    const lightText = "#666666";

    // Header
    doc
        .fontSize(24)
        .fillColor(primaryColor)
        .font('Helvetica-Bold')
        .text("ZenithFlows", 50, 50)
        .fontSize(10)
        .fillColor(lightText)
        .font('Helvetica')
        .text("123 Tech Park, Innovation Hub", 50, 80)
        .text("Bangalore, Karnataka 560001", 50, 95)
        .text("GSTIN: 29XXXXX1234X1Z5", 50, 110);

    // INVOICE text
    doc
        .fontSize(28)
        .fillColor(primaryColor)
        .font('Helvetica-Bold')
        .text("INVOICE", 50, 50, { align: "right" })
        .fontSize(10)
        .fillColor(textColor)
        .font('Helvetica-Bold')
        .text(`Invoice Number: ${invoiceNumber}`, 50, 80, { align: "right" })
        .font('Helvetica')
        .text(`Date: ${new Date().toLocaleDateString()}`, 50, 95, { align: "right" })
        .text(`Payment Status: PAID`, 50, 110, { align: "right" });

    // Payment Stamp
    doc
        .fontSize(20)
        .fillColor("#10b981")
        .font('Helvetica-Bold')
        .text("PAID", 440, 150, { align: "right", angle: -15 })
        .rect(500, 130, 0, 0) // reset position

    doc.moveDown(4);

    // Bill To Section
    const customerY = 170;
    doc
        .fontSize(12)
        .fillColor(primaryColor)
        .font('Helvetica-Bold')
        .text("Bill To:", 50, customerY)
        .fillColor(textColor)
        .fontSize(11)
        .text(`${institute.name}`, 50, customerY + 20)
        .font('Helvetica')
        .text(`Email: ${institute.email}`, 50, customerY + 35)
        .text(`Contact: ${institute.phone || 'N/A'}`, 50, customerY + 50)
        .text(`Address: ${institute.address || 'N/A'}`, 50, customerY + 65);

    // Sub Details
    doc
        .fontSize(12)
        .fillColor(primaryColor)
        .font('Helvetica-Bold')
        .text("Subscription Details:", 300, customerY)
        .fillColor(textColor)
        .font('Helvetica')
        .fontSize(10)
        .text(`Plan: ${plan.name}`, 300, customerY + 20)
        .text(`Period: ${new Date(subscription.start_date).toLocaleDateString()} to ${new Date(subscription.end_date).toLocaleDateString()}`, 300, customerY + 35)
        .text(`Billing Cycle: ${subscription.billing_cycle || 'Monthly'}`, 300, customerY + 50)
        .text(`Payment Ref: ${subscription.razorpay_payment_id || 'N/A'}`, 300, customerY + 65);

    // Table Header
    const tableTop = 280;
    doc
        .fillColor(primaryColor)
        .rect(50, tableTop, 500, 30)
        .fill()
        .fillColor("#ffffff")
        .font('Helvetica-Bold')
        .fontSize(10)
        .text("Description", 60, tableTop + 10)
        .text("Amount", 400, tableTop + 10, { width: 140, align: "right" });

    // Table Row
    const rowY = tableTop + 40;
    const price = subscription.amount ? (subscription.amount - (subscription.tax_amount || 0)) : plan.price;
    const tax = subscription.tax_amount || Math.round(price * 0.18);
    const total = subscription.amount || (price + tax);

    doc
        .fillColor(textColor)
        .font('Helvetica')
        .text(`Subscription to ${plan.name} (${subscription.billing_cycle})`, 60, rowY)
        .text(`₹${parseFloat(price).toFixed(2)}`, 400, rowY, { width: 140, align: "right" });

    // Draw Line
    doc
        .strokeColor("#dddddd")
        .lineWidth(1)
        .moveTo(50, rowY + 30)
        .lineTo(550, rowY + 30)
        .stroke();

    // Summary Section
    const summaryX = 350;
    let summaryY = rowY + 50;

    doc
        .font('Helvetica')
        .text("Subtotal:", summaryX, summaryY)
        .text(`₹${parseFloat(price).toFixed(2)}`, 400, summaryY, { width: 140, align: "right" });
    
    summaryY += 20;
    const cgst = tax / 2;
    doc
        .text("CGST (9%):", summaryX, summaryY)
        .text(`₹${parseFloat(cgst).toFixed(2)}`, 400, summaryY, { width: 140, align: "right" });
    
    summaryY += 20;
    doc
        .text("SGST (9%):", summaryX, summaryY)
        .text(`₹${parseFloat(cgst).toFixed(2)}`, 400, summaryY, { width: 140, align: "right" });

    summaryY += 25;
    
    // Total Line
    doc
        .strokeColor(primaryColor)
        .lineWidth(2)
        .moveTo(summaryX, summaryY - 10)
        .lineTo(550, summaryY - 10)
        .stroke();

    doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor(primaryColor)
        .text("Total Paid:", summaryX, summaryY)
        .text(`₹${parseFloat(total).toFixed(2)}`, 400, summaryY, { width: 140, align: "right" });

    // Footer message
    doc
        .fillColor(lightText)
        .fontSize(10)
        .font('Helvetica')
        .text("Thank you for choosing ZenithFlows!", 50, 700, { align: "center", width: 500 })
        .text("This is an electronically generated invoice and requires no signature.", 50, 715, { align: "center", width: 500 });
    
    doc.end();

    return {
        invoiceNumber,
        filePath,
        fileName
    };
};
