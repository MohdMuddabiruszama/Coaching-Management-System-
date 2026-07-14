const razorpay = require('../config/razorpay');
const crypto = require('crypto');
const { RazorpayOrder, RazorpayPayment } = require('../models');

// ── 1. Create Order ─────────────────────────────────────
async function createOrder({ institute_id, amount_rupees, order_type, reference_id, notes = {} }) {
  if (!razorpay) {
      throw new Error("Razorpay is not configured");
  }
  const amount_paise = Math.round(amount_rupees * 100);
  const receipt = `rcpt_${order_type}_${Date.now()}`;

  // Ensure all notes are strings to prevent Razorpay 400 errors
  const rawNotes = { institute_id, order_type, reference_id, ...notes };
  const stringifiedNotes = {};
  for (const [key, value] of Object.entries(rawNotes)) {
    if (value !== undefined && value !== null) {
      stringifiedNotes[key] = String(value);
    }
  }

  // Call Razorpay API
  const rzpOrder = await razorpay.orders.create({
    amount: amount_paise,
    currency: 'INR',
    receipt,
    notes: stringifiedNotes,
  });

  // Save order to your DB
  const order = await RazorpayOrder.create({
    institute_id, 
    order_type, 
    reference_id,
    razorpay_order_id: rzpOrder.id,
    amount: amount_paise,
    amount_display: amount_rupees,
    currency: 'INR',
    receipt,
    status: 'pending',
    notes,
  });

  return { 
    order_db_id: order.id, 
    razorpay_order_id: rzpOrder.id,
    amount_paise, 
    amount_rupees, 
    receipt 
  };
}

// ── 2. Verify Signature ─────────────────────────────────
function verifySignature({ order_id, payment_id, signature }) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const body = order_id + '|' + payment_id;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  return expected === signature;  // returns true/false
}

// ── 3. Verify Webhook Signature ─────────────────────────
function verifyWebhookSignature(rawBody, receivedSignature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return expected === receivedSignature;
}

module.exports = { createOrder, verifySignature, verifyWebhookSignature };
