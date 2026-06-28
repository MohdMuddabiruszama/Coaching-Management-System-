
Institute Management System
Error Handling & System Resilience
Complete Professional Implementation Guide
Error Classification  │  Graceful Degradation  │  Crash Prevention  │  Monitoring  │  Recovery
Current Risk
One unhandled error can crash the entire Node.js process	After This Guide
Every error caught, logged, and handled without downtime

Version 1.0  │  Based on your Institute Management System (ZenithFlows) report

 
1.  Why Error Handling Is Critical for Your System
Your project is a multi-tenant SaaS platform serving multiple institutes simultaneously through Node.js/Express, React, MySQL with Sequelize, JWT auth, Razorpay payments, biometric hardware sync, and a Capacitor mobile app. A single unhandled error in any one institute's request can, in the worst case, crash the entire Node.js process — taking down the platform for every institute using it at that moment, not just the one that triggered the error.

The Core Problem in Multi-Tenant Systems
Your report (Chapter 13: Challenges) already identifies multi-tenant data isolation and
performance under large attendance/report data as real challenges you've faced.
What is missing from the report is a systematic strategy for what happens when something
goes wrong — a bad request, a database timeout, a third-party API failure (Razorpay,
Cloudinary, biometric device), or a bug in new code. Right now, depending on how routes
are written, these can either: (a) hang the request forever, (b) return a confusing
error to the user, or (c) in the worst case, crash the Node process for ALL institutes.

1.1  The Three Outcomes of Any Error
Outcome 1 — Worst Case	Outcome 2 — Bad	Outcome 3 — Goal of This Guide
Node.js process crashes. Every institute's users get disconnected. Server needs manual or auto restart.	Request hangs forever or returns a raw stack trace / generic 500 error with no useful information to the user or to you.	Error is caught, logged with full context, a clean message is shown to the user, and the rest of the system keeps running normally.

 
2.  Complete Error Classification for Your Project
Based on your tech stack and all 30+ features in your report (Student/Faculty/Parent management, Attendance, Biometric, Fees/Razorpay, Exams, Assignments, Reports, Mobile App, Multi-tenant architecture), here is every category of error your system will encounter, ranked from simple to advanced.

2.1  Level 1 — Simple Errors (Predictable, Easy to Handle)
#	Error Type	Example in Your Project	Why It's Simple
1	Validation errors	Admin submits Add Student form with empty 'Name' field	Known shape, caught before reaching DB
2	Duplicate entry errors	Two students registered with same email/mobile (your report explicitly validates this)	DB returns a specific, recognizable error code
3	Not Found errors	Faculty tries to mark attendance for a deleted student_id	Simple existence check before acting
4	Authentication errors	Expired or missing JWT token on any API call	Already centralized in your auth middleware
5	Authorization (403) errors	Student tries to access Admin billing routes (explicitly mentioned in your RBAC table)	Role check is a simple comparison
6	Business rule violations	Faculty tries to mark attendance for a future date (your report: 'Cannot mark future dates')	Single if-check before save
7	File upload errors	Uploading a .exe file as a study material or a 50MB image beyond Multer's limit	Multer throws a typed, catchable error

2.2  Level 2 — Moderate Errors (Need Careful Handling)
#	Error Type	Example in Your Project	Why It's Moderate
1	Database connection drops	MySQL connection pool exhausted during peak attendance-marking hours across many institutes	Requires pool config + retry logic, not just a try/catch
2	Race conditions	Two admins editing the same Fee Structure simultaneously; double-submit on Fee Payment	Needs locking or idempotency strategy
3	Third-party API failures	Razorpay payment gateway times out or returns an error mid-transaction	Must reconcile payment state — money may have moved even if your API call failed
4	Cloud storage failures	Cloudinary upload fails while saving a student's profile photo or exam result PDF	Partial save risk — DB record created but file missing
5	Biometric sync errors	Biometric hardware sends malformed punch data or device goes offline mid-sync	External hardware is outside your control — must degrade gracefully
6	Multi-tenant data leakage risk	A bug in a query forgets to filter by institute_id — Institute A could see Institute B's data	Silent failure — no crash, but a severe security/data error
7	Mobile app network errors	Capacitor app loses connectivity mid-sync (your report mentions Offline Support)	Needs offline queue + conflict resolution on reconnect

2.3  Level 3 — Advanced / Critical Errors (System-Wide Impact)
#	Error Type	Example in Your Project	Why It's Critical
1	Uncaught exceptions	A typo like reading .name on an undefined object deep in a report-generation function	By default, CRASHES the entire Node.js process — affects every institute
2	Unhandled promise rejections	An async DB call inside Reports Module (Chart.js/Recharts data prep) that has no .catch()	Same crash risk as above — Node will terminate the process
3	Memory leaks	Large attendance datasets or report exports (PDF/Excel) not releasing memory after generation	Doesn't crash immediately — degrades performance over hours/days until OOM crash
4	Database deadlocks	Concurrent fee payment + report generation locking the same rows in MySQL	Can freeze multiple requests simultaneously
5	Cascading failures	Database goes slow → all requests queue → connection pool exhausts → every feature fails at once	One slow component takes down unrelated features
6	Mobile build/runtime crashes	Capacitor app crash on a specific Android version due to a native plugin conflict	Affects all mobile users on that device type, hard to reproduce
7	Silent data corruption	A Sequelize migration or bulk update partially applies before failing, leaving inconsistent state	No visible error — discovered later, hardest to recover from

 
3.  Total Error Count Summary for Your Project
To directly answer your question — how many types of errors can occur — here is the complete count, categorized by where they originate in your specific architecture (Website/Mobile App via Capacitor → Backend API via Node/Express → Database via Sequelize/MySQL, as shown in your Chapter 3 architecture diagram):

Layer (from your architecture)	Error Count	Examples
Frontend (React + Vite)	6 types	Form validation, render crashes, broken API responses, stale state, routing errors, asset load failures
Mobile App (Capacitor)	5 types	Offline sync conflicts, native plugin crashes, build/permission errors, push notification failures, storage quota
Backend API (Node/Express)	9 types	Uncaught exceptions, unhandled rejections, middleware errors, route 404s, timeout errors, memory leaks, rate-limit triggers, CORS errors, JSON parse errors
Authentication / Authorization	4 types	Expired/invalid JWT, missing token, role mismatch (403), token tampering
Database (MySQL + Sequelize)	8 types	Connection pool exhaustion, deadlocks, constraint violations, query timeouts, migration failures, replication lag, slow queries, connection drops
Third-Party Integrations	5 types	Razorpay payment failures/timeouts, Cloudinary upload errors, biometric device sync errors, email/SMS gateway failures, webhook delivery failures
Multi-Tenant / Business Logic	4 types	Cross-institute data leakage, race conditions on shared resources, business rule violations, duplicate/idempotency errors
Infrastructure / Deployment	4 types	Server crash/restart, out-of-memory, disk space exhaustion, DNS/SSL/env-variable misconfiguration
TOTAL	45 types	Full coverage across every layer of your system

How To Read This Number
45 is not a number to be afraid of — it simply means there are 45 distinct *categories*
of failure. The good news: ALL 45 fall into only 4 handling PATTERNS (Section 4). You do
not need 45 different solutions. You need 4 well-built mechanisms applied consistently.

 
4.  The 4 Universal Error-Handling Patterns
Every one of the 45 error types above is handled using a combination of these 4 patterns. This is the professional, industry-standard approach used by real production Node.js SaaS platforms — and it is the best fit for your project's architecture.

4.1  Pattern 1 — Try/Catch + Centralized Error Middleware (Simple Errors)
Every controller function is wrapped so thrown errors are passed to one single Express error-handling middleware instead of being handled ad-hoc in each controller. This is the foundation pattern — it alone fixes most of the Level 1 errors from Section 2.1.

4.2  Pattern 2 — Process-Level Safety Nets (Crash Prevention)
Two Node.js global event listeners — uncaughtException and unhandledRejection — catch anything that escapes your try/catch blocks. This is the single most important fix for the Level 3 crash risk described in Section 2.3. Without this, one missed .catch() anywhere in your 30+ features can take down the entire platform.

4.3  Pattern 3 — Graceful Degradation (Moderate/Third-Party Errors)
When a non-critical dependency fails (Cloudinary, biometric sync, email/SMS), the system continues operating with reduced functionality instead of failing the entire request. Example: if Cloudinary is down, the student record still saves — just without the profile photo, with a flag to retry the upload later.

4.4  Pattern 4 — Circuit Breaker + Retry with Backoff (Cascading Failures)
For dependencies that can become slow or unavailable under load (database, Razorpay, biometric devices), a circuit breaker stops hammering a failing service and a retry with exponential backoff automatically re-attempts transient failures (like a momentary network blip) without manual intervention.

Pattern	Solves Error Levels	Used In Your Project For	Implementation Effort
1. Try/Catch + Middleware	Level 1 (all 7 types)	Every controller: Students, Faculty, Attendance, Exams, etc.	Low — 1–2 days
2. Process Safety Nets	Level 3 crash risks	Server entry file (server.js) — applies platform-wide instantly	Very Low — 1 hour
3. Graceful Degradation	Level 2 third-party errors	Cloudinary uploads, Biometric sync, Email/SMS notifications	Medium — 2–3 days
4. Circuit Breaker + Retry	Level 2–3 cascading failures	Razorpay calls, MySQL pool, Biometric device polling	Medium — 3–4 days

 
5.  Implementation Phases
The following phases take you from basic crash-prevention to advanced enterprise-grade monitoring. Phases 1–3 are mandatory and should be done first — they prevent total system crashes. Phases 4–10 add increasing sophistication.

Phase 1	Process-Level Crash Prevention
The single most important fix — do this before anything else

Add this to your main server.js / app.js entry file. This ensures that even a completely unexpected bug anywhere in your 30+ features cannot bring down the whole platform for all institutes.
// server.js — add at the very top, before anything else runs

process.on('uncaughtException', (err, origin) => {
  console.error('⚠️ UNCAUGHT EXCEPTION:', err);
  console.error('Origin:', origin);
  logErrorToFile(err, 'uncaughtException');     // see Phase 6: Logging
  notifyAdminIfCritical(err);                    // see Phase 9: Alerts
  // DO NOT immediately process.exit() in production for a multi-tenant
  // SaaS — that disconnects every institute at once.
  // Instead: log, alert, and let a process manager (PM2 / Docker) restart
  // gracefully ONLY if the error repeats (see Phase 3: graceful restart).
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ UNHANDLED PROMISE REJECTION:', reason);
  logErrorToFile(reason, 'unhandledRejection');
  notifyAdminIfCritical(reason);
  // Same philosophy: log + alert, don't crash all institutes instantly.
});

// Optional but recommended: warn on memory pressure before OOM crash
process.on('warning', (warning) => {
  if (warning.name === 'MaxListenersExceededWarning') {
    console.warn('Possible memory leak detected:', warning.message);
  }
});

Why Not Just process.exit() on Every Error?
Many tutorials tell you to call process.exit(1) inside uncaughtException. For a SINGLE-
tenant app that may be acceptable because a process manager restarts it in ~1 second.
For YOUR multi-tenant SaaS, an immediate exit disconnects every institute using the
platform at that exact moment — mid attendance-marking, mid fee payment, etc.
The professional approach: log + alert immediately, track error frequency, and only
trigger a controlled restart if the SAME uncaught error repeats (signals real corruption),
using a process manager like PM2 configured with graceful restart (Phase 3).

 
Phase 2	Centralized Express Error Middleware
One place that formats and logs every error consistently

This replaces scattered try/catch logic with a single, consistent error-handling pipeline used across every route — Students, Faculty, Attendance, Fees, Exams, Biometric, Reports, etc.
6.1  Custom Error Classes
// utils/AppError.js — create this new file
class AppError extends Error {
  constructor(message, statusCode, errorCode = null, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details) { super(message, 400, 'VALIDATION_ERROR', details); }
}
class NotFoundError extends AppError {
  constructor(resource) { super(`${resource} not found`, 404, 'NOT_FOUND'); }
}
class DuplicateError extends AppError {
  constructor(field) { super(`${field} already exists`, 409, 'DUPLICATE_ENTRY'); }
}
class AuthError extends AppError {
  constructor(message = 'Authentication required') { super(message, 401, 'AUTH_ERROR'); }
}
class ForbiddenError extends AppError {
  constructor(message = 'Access denied') { super(message, 403, 'FORBIDDEN'); }
}
class BusinessRuleError extends AppError {
  constructor(message) { super(message, 422, 'BUSINESS_RULE_VIOLATION'); }
}

module.exports = { AppError, ValidationError, NotFoundError, DuplicateError, AuthError, ForbiddenError, BusinessRuleError };

6.2  Async Handler Wrapper (Eliminates Repeated try/catch)
// utils/asyncHandler.js
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
module.exports = asyncHandler;

// USAGE — in your existing controllers, e.g. controllers/student.controller.js
const asyncHandler = require('../utils/asyncHandler');
const { NotFoundError, DuplicateError } = require('../utils/AppError');

exports.addStudent = asyncHandler(async (req, res) => {
  const { email, mobile } = req.body;
  const existing = await Student.findOne({ where: { email, institute_id: req.user.institute_id } });
  if (existing) throw new DuplicateError('Email');
  const student = await Student.create({ ...req.body, institute_id: req.user.institute_id });
  res.status(201).json({ success: true, data: student });
});

6.3  Central Error Middleware
// middlewares/errorHandler.middleware.js
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational || false;

  logErrorToFile(err, 'apiError', {
    path: req.originalUrl, method: req.method,
    institute_id: req.user?.institute_id, user_id: req.user?.id, role: req.user?.role,
  });

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ success: false, message: 'A record with this value already exists', errorCode: 'DUPLICATE_ENTRY', field: err.errors?.[0]?.path });
  }
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(409).json({ success: false, message: 'This record is linked to other data', errorCode: 'FOREIGN_KEY_VIOLATION' });
  }
  if (err.name === 'SequelizeConnectionError' || err.name === 'SequelizeConnectionRefusedError') {
    return res.status(503).json({ success: false, message: 'Service temporarily unavailable. Please try again.', errorCode: 'DB_UNAVAILABLE' });
  }
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Session expired. Please log in again.', errorCode: 'TOKEN_INVALID' });
  }

  if (isOperational) {
    return res.status(statusCode).json({ success: false, message: err.message, errorCode: err.errorCode, ...(err.details && { details: err.details }) });
  }

  console.error('UNEXPECTED ERROR:', err);
  return res.status(500).json({ success: false, message: 'Something went wrong on our end. Our team has been notified.', errorCode: 'INTERNAL_ERROR', referenceId: req.id || generateReferenceId() });
};
module.exports = errorHandler;

// Register LAST in server.js, after all routes:
// app.use((req,res)=>res.status(404).json({success:false,message:'Route not found'}));
// app.use(errorHandler);

 
Phase 3	Controlled Restart Strategy (PM2 / Docker)
Auto-recover from a crash in seconds without manual intervention

Even with Phases 1–2, a rare true crash can still happen. The professional answer is not "never crash" — it's "recover automatically and instantly." This directly addresses Chapter 13 of your report (Cloud Hosting & Deployment challenges).
npm install -g pm2

// pm2.config.js — create this in your backend root
module.exports = {
  apps: [{
    name: 'institute-saas-api',
    script: './server.js',
    instances: 2,
    exec_mode: 'cluster',
    max_memory_restart: '500M',
    autorestart: true,
    max_restarts: 10,
    min_uptime: '30s',
    restart_delay: 2000,
    env_production: { NODE_ENV: 'production' },
  }]
};

pm2 start pm2.config.js --env production
pm2 save
pm2 startup

Why cluster mode with 2+ instances matters for you
With instances:2 in cluster mode, if one instance crashes from an uncaught exception
that slipped through, PM2 instantly restarts JUST that instance — the other instance
keeps serving all institutes without any visible downtime. This is the real-world
answer to your question 'without terminate the project' — the project effectively
never goes down, even in the rare case a process does crash.

 
Phase 4	Database Resilience
Connection pooling, retry logic, and deadlock handling for MySQL/Sequelize

// config/database.js
const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
  host: process.env.DB_HOST, dialect: 'mysql',
  pool: { max: 20, min: 2, acquire: 30000, idle: 10000, evict: 5000 },
  retry: { max: 3, match: [/ETIMEDOUT/, /ECONNRESET/, /ECONNREFUSED/, /Deadlock/i] },
  logging: process.env.NODE_ENV !== 'production',
});
module.exports = sequelize;

// utils/withRetry.js — wrap critical writes (e.g. Fee Payment) in retry logic
const withRetry = async (fn, retries = 3, delayMs = 200) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try { return await fn(); }
    catch (err) {
      const isDeadlock = err.name === 'SequelizeDeadlockError' || err.parent?.code === 'ER_LOCK_DEADLOCK';
      if (!isDeadlock || attempt === retries) throw err;
      await new Promise(r => setTimeout(r, delayMs * attempt));
    }
  }
};
module.exports = withRetry;

exports.collectFee = asyncHandler(async (req, res) => {
  const result = await withRetry(() =>
    sequelize.transaction(async (t) => {
      const fee = await StudentFee.findByPk(req.body.fee_id, { lock: t.LOCK.UPDATE, transaction: t });
      if (!fee || fee.status === 'paid') throw new BusinessRuleError('Fee already paid or not found');
      await fee.update({ status: 'paid', paid_at: new Date() }, { transaction: t });
      return fee;
    })
  );
  res.json({ success: true, data: result });
});

 
Phase 5	Graceful Degradation for Third-Party Services
Razorpay, Cloudinary, Biometric, Email/SMS keep failing gracefully

Your report explicitly lists Razorpay, Cloudinary, and Biometric hardware as integrations. Each must never block the core feature if it fails.
9.1  Cloudinary Upload — Non-Blocking Pattern
// services/upload.service.js
exports.uploadWithFallback = async (file, studentId) => {
  try {
    const result = await cloudinary.uploader.upload(file.path, { timeout: 8000 });
    return { url: result.secure_url, uploaded: true };
  } catch (err) {
    console.error('Cloudinary upload failed, queueing for retry:', err.message);
    await UploadQueue.create({ student_id: studentId, file_path: file.path, status: 'pending' });
    return { url: null, uploaded: false, queued: true };
  }
};

exports.addStudent = asyncHandler(async (req, res) => {
  const student = await Student.create({ ...req.body, institute_id: req.user.institute_id });
  if (req.file) {
    const upload = await uploadWithFallback(req.file, student.id);
    if (upload.uploaded) await student.update({ photo_url: upload.url });
  }
  res.status(201).json({ success: true, data: student });
});

9.2  Razorpay — Idempotent Payment Verification
exports.verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const existing = await Payment.findOne({ where: { razorpay_payment_id } });
  if (existing) return res.json({ success: true, message: 'Already processed', data: existing });

  const isValid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
  if (!isValid) throw new AppError('Payment verification failed', 400, 'PAYMENT_INVALID');

  const paymentDetails = await razorpayInstance.payments.fetch(razorpay_payment_id);
  if (paymentDetails.status !== 'captured') throw new AppError('Payment not captured', 402, 'PAYMENT_NOT_CAPTURED');

  const payment = await Payment.create({ ...req.body, status: 'success', verified_at: new Date() });
  res.json({ success: true, data: payment });
});

// Webhook safety net — confirms payment even if user closes browser early
exports.razorpayWebhook = asyncHandler(async (req, res) => {
  const isValidWebhook = verifyWebhookSignature(req.body, req.headers['x-razorpay-signature']);
  if (!isValidWebhook) return res.status(400).send('Invalid signature');
  res.status(200).send('OK');
});

9.3  Biometric Device Sync — Isolated Failure Handling
exports.syncAllDevices = async () => {
  const devices = await BiometricDevice.findAll({ where: { status: 'active' } });
  const results = await Promise.allSettled(devices.map(device => syncSingleDevice(device)));

  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`Device ${devices[i].id} sync failed:`, result.reason.message);
      logErrorToFile(result.reason, 'biometricSync', { device_id: devices[i].id });
    }
  });
  return results;
};

const syncSingleDevice = async (device) => {
  const punches = await fetchPunchesFromDevice(device, { timeout: 5000 });
  for (const punch of punches) {
    if (!isValidPunchData(punch)) continue;
    await markAttendanceFromPunch(punch);
  }
};

 
Phase 6	Centralized Logging System
Know exactly what happened, when, and for which institute

npm install winston winston-daily-rotate-file

// utils/logger.js
const winston = require('winston');
require('winston-daily-rotate-file');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.DailyRotateFile({ filename: 'logs/error-%DATE%.log', datePattern: 'YYYY-MM-DD', level: 'error', maxFiles: '30d' }),
    new winston.transports.DailyRotateFile({ filename: 'logs/combined-%DATE%.log', datePattern: 'YYYY-MM-DD', maxFiles: '14d' }),
    new winston.transports.Console({ format: winston.format.simple() }),
  ],
});

const logErrorToFile = (err, type, context = {}) => {
  logger.error({ type, message: err.message, stack: err.stack, ...context, timestamp: new Date().toISOString() });
};
module.exports = { logger, logErrorToFile };

Why institute_id Must Be in Every Log Line
Your system is multi-tenant. Without institute_id in every error log, you cannot tell
WHICH institute experienced a problem when many institutes use the platform together.
Always log: institute_id, user_id, role, request path, and a request correlation ID.
This turns 'something broke somewhere' into 'Institute #34, Admin user #112, on the
fee collection route, at 3:42 PM' — the difference between a 5-minute fix and a 5-hour hunt.

 
Phase 7	React Frontend Error Boundaries
Prevent one broken component from blanking the whole UI

// components/ErrorBoundary.jsx
import { Component } from 'react';

class ErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }

  componentDidCatch(error, info) {
    fetch('/api/client-errors', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: error.message, stack: error.stack, componentStack: info.componentStack }),
    }).catch(() => {});
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <h3>Something went wrong loading this section</h3>
          <p>The rest of the dashboard is still working.</p>
          <button onClick={() => window.location.reload()}>Reload Page</button>
        </div>
      );
    }
    return this.props.children;
  }
}
export default ErrorBoundary;

// USAGE — wrap each independent dashboard widget, NOT the whole app
<ErrorBoundary><AttendanceWidget /></ErrorBoundary>
<ErrorBoundary><FeesSummaryWidget /></ErrorBoundary>
<ErrorBoundary><ReportsChartWidget /></ErrorBoundary>

7.1  Axios Global Interceptor (Consistent API Error Handling)
// services/api.js
import axios from 'axios';
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL, timeout: 15000 });

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') toast.error('Request timed out. Please check your connection.');
    else if (!error.response) toast.error('Cannot reach server. Please check your internet connection.');
    else if (error.response.status === 401) { localStorage.removeItem('token'); window.location.href = '/login?expired=true'; }
    else if (error.response.status === 403) toast.error('You do not have permission to do this.');
    else if (error.response.status >= 500) toast.error('Server error. Our team has been notified.');
    else toast.error(error.response.data?.message || 'Something went wrong');
    return Promise.reject(error);
  }
);
export default api;

 
Phase 8	Mobile App (Capacitor) Resilience
Offline sync conflicts, native crashes, and storage handling

Your report (Chapter 8 & 14) already plans Offline Support and improved offline-first sync. Here is how to make that resilient:
// services/offlineQueue.js — for the Capacitor mobile app
import { Storage } from '@capacitor/storage';

export const queueOfflineAction = async (action) => {
  const queue = JSON.parse((await Storage.get({ key: 'offline_queue' })).value || '[]');
  queue.push({ ...action, queuedAt: Date.now(), retries: 0 });
  await Storage.set({ key: 'offline_queue', value: JSON.stringify(queue) });
};

export const processOfflineQueue = async () => {
  const queue = JSON.parse((await Storage.get({ key: 'offline_queue' })).value || '[]');
  const remaining = [];
  for (const action of queue) {
    try { await api.request(action); }
    catch (err) {
      action.retries += 1;
      if (action.retries < 5) remaining.push(action);
      else logFailedSyncForManualReview(action);
    }
  }
  await Storage.set({ key: 'offline_queue', value: JSON.stringify(remaining) });
};

import { Network } from '@capacitor/network';
Network.addListener('networkStatusChange', (status) => {
  if (status.connected) processOfflineQueue();
});

 
Phase 9	Real-Time Alerting
Know about critical errors before your users complain

// utils/alerts.js
const CRITICAL_ERROR_CODES = ['DB_UNAVAILABLE', 'PAYMENT_NOT_CAPTURED', 'INTERNAL_ERROR'];

const notifyAdminIfCritical = async (err) => {
  const isCritical = !err.isOperational || CRITICAL_ERROR_CODES.includes(err.errorCode);
  if (!isCritical) return;

  const key = `alert_sent_${err.message}`;
  if (recentlyAlerted(key)) return;
  markAlerted(key, 300);

  await sendSlackAlert({
    text: `🚨 Critical error in production`,
    blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `*Error:* ${err.message}\n*Code:* ${err.errorCode || 'UNKNOWN'}` } }]
  });
};
module.exports = { notifyAdminIfCritical };

// Recommended free/low-cost monitoring tools for your scale:
// - Sentry (free tier) — automatic error tracking + stack traces + institute context
// - UptimeRobot (free) — pings your API every 5 min, alerts if down
// - PM2 Plus (free tier) — process monitoring dashboard

 
Phase 10	Multi-Tenant Data Isolation Safety Net
Catch institute_id leaks before they become security incidents

This directly addresses the #1 challenge listed in your report's Chapter 13. A missing institute_id filter is a silent error — no crash, no visible bug, just one institute seeing another's data.
// middlewares/tenantScope.middleware.js
const applyTenantScope = (req, res, next) => {
  if (!req.user?.institute_id && req.user?.role !== 'super_admin') {
    return next(new AuthError('No institute context found'));
  }
  req.db = {
    Student: Student.scope({ method: ['byInstitute', req.user.institute_id] }),
    Faculty: Faculty.scope({ method: ['byInstitute', req.user.institute_id] }),
    Fee: Fee.scope({ method: ['byInstitute', req.user.institute_id] }),
  };
  next();
};

// In each model definition, e.g. models/student.js:
Student.addScope('byInstitute', (instituteId) => ({ where: { institute_id: instituteId } }));

// Controllers use req.db.Student instead of Student directly:
exports.getStudents = asyncHandler(async (req, res) => {
  const students = await req.db.Student.findAll();
  res.json({ success: true, data: students });
});

 
6.  Testing & Verification Checklist
Your report's Chapter 11 already lists Jest and Supertest as your testing tools. Use these specific error-injection test cases against the implementation above:

#	Test Scenario	Expected Behavior	Verifies
1	Throw a raw error inside a controller without try/catch	Server stays up, 500 returned with generic safe message	Phase 1 + 2
2	Submit duplicate student email	409 DUPLICATE_ENTRY, no crash	Phase 2
3	Kill MySQL connection mid-request	Retry attempted, then 503 DB_UNAVAILABLE if still down	Phase 4
4	Simulate Cloudinary timeout during student photo upload	Student still saves, photo queued for retry	Phase 5
5	Send malformed punch data from one biometric device	Other devices continue syncing normally	Phase 5
6	Force a React component to throw during render	Only that widget shows fallback UI, rest of dashboard works	Phase 7
7	Disconnect mobile app network mid-attendance-sync	Action queued, auto-replays on reconnect	Phase 8
8	Manually remove institute_id filter from a test query	Scoped model still enforces it — cross-tenant leak blocked	Phase 10
9	Trigger 50 rapid-fire identical errors	Only ONE alert sent (rate-limited), not 50	Phase 9
10	Kill the Node process forcibly (kill -9)	PM2 restarts within seconds, other cluster instance served traffic meanwhile	Phase 3

 
7.  Complete Implementation Summary
Phase	What It Adds	Effort	Priority
1	Process crash prevention	1 hour	MANDATORY — do today
2	Centralized error middleware + custom error classes	1–2 days	MANDATORY — this week
3	PM2 cluster mode + auto-restart	Half day	MANDATORY — before next deploy
4	DB connection pooling + retry + deadlock handling	1–2 days	High — this month
5	Graceful degradation for Razorpay/Cloudinary/Biometric	2–3 days	High — this month
6	Winston structured logging with rotation	Half day	High — this month
7	React error boundaries + Axios interceptor	1 day	High — this month
8	Capacitor offline queue + retry sync	2–3 days	Medium — next sprint
9	Slack/Email critical alerts	1 day	Medium — next sprint
10	Tenant-scoped model safety net	2–3 days	High — security-critical

Direct Answer To Your Question
Q: If an unexpected error happens during runtime, how do I handle it without
   terminating the project?
A: Phases 1 + 2 + 3 together are the complete answer. Phase 1 catches anything that
   escapes your code. Phase 2 ensures expected errors never even reach that point —
   they're caught, classified, and a clean response is sent. Phase 3 means that even
   in the rare case a crash does occur, PM2's cluster mode keeps the OTHER instance
   serving every institute while the crashed one restarts in under 2 seconds.
   Result: the project, as experienced by your institutes, never goes down.

