// backend/scripts/backup.js
// ─── Automated Database Backup ────────────────────────────────────────────────
// Runs pg_dump on a cron schedule and stores backups locally.
// Backup Strategy:
//   Daily  → backups/daily/YYYY-MM-DD.sql   (kept 7 days)
//   Weekly → backups/weekly/YYYY-WNN.sql    (kept 4 weeks, runs on Sunday)
//   Monthly→ backups/monthly/YYYY-MM.sql    (kept 12 months, runs on 1st)
//
// Schedule: daily at 2:00 AM server time.
// No AWS required — runs locally on Render or any server.
// ZenithFlows — Enterprise DB Safety Architecture (Phase 5)

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const cron   = require('node-cron');
const { exec } = require('child_process');
const fs     = require('fs');
const path   = require('path');

// ─── Backup folder paths ──────────────────────────────────────────────────────
const ROOT     = path.join(__dirname, '../../backups');
const DAILY    = path.join(ROOT, 'daily');
const WEEKLY   = path.join(ROOT, 'weekly');
const MONTHLY  = path.join(ROOT, 'monthly');
const LOG_FILE = path.join(__dirname, '../logs/backup.log');

// Ensure directories exist
for (const dir of [DAILY, WEEKLY, MONTHLY]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─── Helper: log to file + console ───────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch (_) {}
}

// ─── Helper: week number ─────────────────────────────────────────────────────
function getWeekNumber(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 'W' + String(1 + Math.round(((date - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7)).padStart(2, '0');
}

// ─── Helper: delete old backup files ─────────────────────────────────────────
function deleteOlderThan(dir, maxDays) {
  if (!fs.existsSync(dir)) return;
  const cutoff = Date.now() - maxDays * 24 * 60 * 60 * 1000;
  fs.readdirSync(dir).forEach(file => {
    const fp = path.join(dir, file);
    const stat = fs.statSync(fp);
    if (stat.mtimeMs < cutoff) {
      fs.unlinkSync(fp);
      log(`  Deleted old backup: ${file}`);
    }
  });
}

// ─── Core: run pg_dump ────────────────────────────────────────────────────────
function runPgDump(outputPath) {
  return new Promise((resolve, reject) => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      reject(new Error('DATABASE_URL is not set in environment'));
      return;
    }

    // pg_dump must be installed on the server (available on Render, Railway, VPS)
    const cmd = `pg_dump "${dbUrl}" > "${outputPath}"`;
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`pg_dump failed: ${stderr || err.message}`));
      } else {
        resolve();
      }
    });
  });
}

// ─── Main backup function ─────────────────────────────────────────────────────
async function runBackup() {
  const now     = new Date();
  const dateStr = now.toISOString().slice(0, 10);        // 2026-08-04
  const yearMo  = now.toISOString().slice(0, 7);         // 2026-08
  const weekStr = `${now.getFullYear()}-${getWeekNumber(now)}`; // 2026-W31

  log('═══════════════════════════════════════');
  log(`Starting backup: ${dateStr}`);

  // ── Daily backup ────────────────────────────────────────────────────────────
  const dailyPath = path.join(DAILY, `${dateStr}.sql`);
  try {
    await runPgDump(dailyPath);
    const size = (fs.statSync(dailyPath).size / 1024).toFixed(1);
    log(`✅ Daily backup: ${dailyPath} (${size} KB)`);
  } catch (err) {
    log(`❌ Daily backup FAILED: ${err.message}`);
    log('   Check that pg_dump is installed and DATABASE_URL is correct.');
    return; // Don't run weekly/monthly if daily fails
  }

  // ── Weekly backup (every Sunday) ────────────────────────────────────────────
  if (now.getDay() === 0) { // 0 = Sunday
    const weeklyPath = path.join(WEEKLY, `${weekStr}.sql`);
    try {
      fs.copyFileSync(dailyPath, weeklyPath);
      log(`✅ Weekly backup: ${weeklyPath}`);
    } catch (err) {
      log(`⚠️  Weekly backup copy failed: ${err.message}`);
    }
  }

  // ── Monthly backup (1st of every month) ─────────────────────────────────────
  if (now.getDate() === 1) {
    const monthlyPath = path.join(MONTHLY, `${yearMo}.sql`);
    try {
      fs.copyFileSync(dailyPath, monthlyPath);
      log(`✅ Monthly backup: ${monthlyPath}`);
    } catch (err) {
      log(`⚠️  Monthly backup copy failed: ${err.message}`);
    }
  }

  // ── Cleanup old backups ──────────────────────────────────────────────────────
  deleteOlderThan(DAILY,   7);   // keep 7 days
  deleteOlderThan(WEEKLY,  30);  // keep ~4 weeks
  deleteOlderThan(MONTHLY, 370); // keep ~12 months

  log(`Backup complete.`);
  log('═══════════════════════════════════════');
}

// ─── Schedule: 2:00 AM every day ─────────────────────────────────────────────
if (require.main === module) {
  if (process.argv.includes('--now')) {
    log('Running manual backup immediately...');
    runBackup().then(() => process.exit(0));
  } else {
    log('Backup scheduler started. Will run daily at 2:00 AM. (Pass --now to run immediately)');
    cron.schedule('0 2 * * *', runBackup, { timezone: 'Asia/Kolkata' });
  }
}

// Export for manual trigger or integration into app startup
module.exports = { runBackup };
