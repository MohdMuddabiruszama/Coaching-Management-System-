require('dotenv').config();
const nodemailer = require('nodemailer');

async function testSmtp() {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  try {
    await transporter.verify();
    console.log("SMTP is working correctly.");
  } catch (error) {
    console.error("SMTP error:", error);
  }
}

testSmtp();
