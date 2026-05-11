const nodemailer = require('nodemailer');
const { Resend } = require('resend');

// ✅ Phase 7: Production Email Provider (Resend)
const resend = process.env.EMAIL_PROVIDER === 'resend' && process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

// Create transporter once — reused for all emails
const createTransporter = () => {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,       // false for port 587 (STARTTLS)
    requireTLS: true,    // force TLS upgrade
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === "production",  // fixes certificate issues in dev, strict in prod
    },
  });
};

/**
 * Unified email sender that routes through Resend (Prod) or Nodemailer (Dev)
 */
const sendEmail = async ({ to, subject, html }) => {
    const from = process.env.EMAIL_FROM || "ZF Solution <noreply@yourdomain.com>";
    
    if (resend) {
        const { data, error } = await resend.emails.send({
            from,
            to: Array.isArray(to) ? to : [to],
            subject,
            html
        });
        if (error) throw new Error(`Resend Error: ${error.message}`);
        return { messageId: data.id, provider: 'resend' };
    } else {
        const transporter = createTransporter();
        await transporter.verify();
        const info = await transporter.sendMail({ from, to, subject, html });
        return { messageId: info.messageId, provider: 'smtp' };
    }
};

exports.sendOtpEmail = async (to, otp, type) => {
  const isReset = type === 'password_reset';

  const subject = isReset
    ? 'Password Reset OTP — ZF Solution'
    : 'Verify Your Email — ZF Solution';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;
         padding:32px;border:1px solid #e2e8f0;border-radius:12px;">
      <h2 style="color:#1E3A5F;margin-bottom:8px;">
        ${isReset ? '🔐 Reset Your Password' : '✅ Verify Your Email'}
      </h2>
      <p style="color:#374151;">Your One-Time Password (OTP) is:</p>
      <div style="font-size:40px;font-weight:bold;letter-spacing:12px;
           color:#2563EB;text-align:center;padding:24px;
           background:#EFF6FF;border-radius:8px;margin:20px 0;">
        ${otp}
      </div>
      <p style="color:#6B7280;font-size:14px;">
        ⏰ This code expires in <strong>10 minutes</strong>.<br/>
        🚫 Do not share this OTP with anyone.<br/>
        If you did not request this, please ignore this email.
      </p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;"/>
      <p style="color:#9CA3AF;font-size:12px;text-align:center;">
        ZF Solution Platform — Automated Email
      </p>
    </div>
  `;

  const info = await sendEmail({ to, subject, html });

  console.log(`✅ Real email sent to ${to} via ${info.provider} | ID: ${info.messageId}`);
  return info;
};

// Send welcome email with auto-generated credentials
exports.sendStudentWelcomeEmail = async ({ to, studentName, instituteName, email, tempPassword }) => {
  const transporter = createTransporter();

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;
         border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">

      <!-- Header -->
      <div style="background:#1E3A5F;padding:28px 32px;">
        <h1 style="color:#fff;margin:0;font-size:22px;">Welcome to ${instituteName}</h1>
        <p style="color:#93C5FD;margin:6px 0 0;">Your student account is ready</p>
      </div>

      <!-- Body -->
      <div style="padding:32px;">
        <p style="color:#374151;font-size:15px;">Hi <strong>${studentName}</strong>,</p>
        <p style="color:#374151;font-size:15px;">
          Your student account has been created. Use the credentials below to login.
        </p>

        <!-- Credentials Box -->
        <div style="background:#F8FAFC;border:1px solid #E2E8F0;
             border-left:4px solid #2563EB;border-radius:8px;padding:20px;margin:20px 0;">
          <p style="margin:0 0 10px;color:#6B7280;font-size:13px;
             text-transform:uppercase;letter-spacing:1px;">Login Credentials</p>
          <p style="margin:0 0 8px;color:#111827;font-size:15px;">
            <span style="color:#6B7280;">Email:</span> <strong>${email}</strong>
          </p>
          <p style="margin:0;color:#111827;font-size:15px;">
            <span style="color:#6B7280;">Password:</span>
            <strong style="font-size:20px;letter-spacing:2px;color:#2563EB;">
              ${tempPassword}
            </strong>
          </p>
        </div>

        <div style="background:#FEF3C7;border-radius:8px;padding:14px 18px;
             border-left:4px solid #F59E0B;margin:20px 0;">
          <p style="margin:0;color:#92400E;font-size:14px;">
            You will be asked to change this password after your first login.
          </p>
        </div>

        <p style="text-align:center;margin:28px 0 0;">
          <a href="${process.env.FRONTEND_URL}/login"
             style="background:#2563EB;color:#fff;padding:12px 32px;
             border-radius:8px;text-decoration:none;font-size:15px;
             font-weight:bold;">Login to Your Account</a>
        </p>
      </div>

      <!-- Footer -->
      <div style="background:#F1F5F9;padding:16px 32px;text-align:center;">
        <p style="color:#9CA3AF;font-size:12px;margin:0;">
          This is an automated message from ${instituteName} via Student SaaS.
        </p>
      </div>
    </div>
  `;

  const info = await sendEmail({
    to,
    subject: `Your Login Credentials — ${instituteName}`,
    html,
  });

  console.log(`✅ Welcome email sent to ${to} via ${info.provider}`);
  return info;
};