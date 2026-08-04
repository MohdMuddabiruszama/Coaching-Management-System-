// backend/scripts/restore.js
// ─── Database Restore Script ──────────────────────────────────────────────────
// Restores the database from a backup file created by backup.js.
//
// Usage:
//   node scripts/restore.js --list
//     → Lists all available backups
//
//   node scripts/restore.js backups/daily/2026-08-04.sql
//     → Restores from a specific file
//
//   node scripts/restore.js --latest
//     → Restores from the most recent daily backup
//
// ⚠️  WARNING: This will OVERWRITE the current database. Use with care.
// ZenithFlows — Enterprise DB Safety Architecture (Phase 5)

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { exec } = require('child_process');
const fs       = require('fs');
const path     = require('path');
const readline = require('readline');

const ROOT    = path.join(__dirname, '../../backups');
const DAILY   = path.join(ROOT, 'daily');
const WEEKLY  = path.join(ROOT, 'weekly');
const MONTHLY = path.join(ROOT, 'monthly');

// ─── List all available backups ───────────────────────────────────────────────
function listBackups() {
  console.log('\n📦 Available Backups\n');

  for (const [label, dir] of [['Daily', DAILY], ['Weekly', WEEKLY], ['Monthly', MONTHLY]]) {
    console.log(`── ${label} (${dir.replace(process.cwd(), '.')}) ──`);
    if (!fs.existsSync(dir)) { console.log('  (no backups yet)\n'); continue; }
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort().reverse();
    if (!files.length) { console.log('  (no backups yet)\n'); continue; }
    files.forEach(f => {
      const stat = fs.statSync(path.join(dir, f));
      const size = (stat.size / 1024).toFixed(1);
      console.log(`  ${f}  (${size} KB)  modified: ${stat.mtime.toISOString().slice(0, 19)}`);
    });
    console.log('');
  }
}

// ─── Get most recent daily backup ────────────────────────────────────────────
function getLatestBackup() {
  if (!fs.existsSync(DAILY)) return null;
  const files = fs.readdirSync(DAILY).filter(f => f.endsWith('.sql')).sort().reverse();
  return files.length ? path.join(DAILY, files[0]) : null;
}

// ─── Confirm before restore ───────────────────────────────────────────────────
function confirm(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'yes');
    });
  });
}

// ─── Run psql restore ────────────────────────────────────────────────────────
function runRestore(backupFile) {
  return new Promise((resolve, reject) => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) { reject(new Error('DATABASE_URL not set')); return; }

    // psql must be installed (available wherever pg_dump is)
    const cmd = `psql "${dbUrl}" < "${backupFile}"`;
    console.log(`\n⏳ Restoring from: ${backupFile}`);
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`psql failed: ${stderr || err.message}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const arg = process.argv[2];

  if (!arg || arg === '--help') {
    console.log(`
ZenithFlows — Database Restore Tool

Usage:
  node scripts/restore.js --list              List available backups
  node scripts/restore.js --latest            Restore from latest daily backup
  node scripts/restore.js <path/to/file.sql>  Restore from specific file

Examples:
  node scripts/restore.js --list
  node scripts/restore.js backups/daily/2026-08-04.sql
  node scripts/restore.js --latest
`);
    return;
  }

  if (arg === '--list') {
    listBackups();
    return;
  }

  let backupFile;
  if (arg === '--latest') {
    backupFile = getLatestBackup();
    if (!backupFile) {
      console.error('❌ No daily backups found. Run backup.js first.');
      process.exit(1);
    }
  } else {
    backupFile = path.resolve(process.cwd(), arg);
  }

  if (!fs.existsSync(backupFile)) {
    console.error(`❌ Backup file not found: ${backupFile}`);
    process.exit(1);
  }

  const size = (fs.statSync(backupFile).size / 1024).toFixed(1);
  console.log(`\n⚠️  DATABASE RESTORE`);
  console.log(`   File  : ${backupFile}`);
  console.log(`   Size  : ${size} KB`);
  console.log(`   Target: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`\n⚠️  WARNING: This will overwrite the current database!`);

  const ok = await confirm('   Type "yes" to continue, anything else to cancel: ');
  if (!ok) {
    console.log('❌ Restore cancelled.');
    process.exit(0);
  }

  try {
    await runRestore(backupFile);
    console.log('\n✅ Restore complete.');
    console.log('   Restart your server to reconnect active connections.');
  } catch (err) {
    console.error(`\n❌ Restore failed: ${err.message}`);
    process.exit(1);
  }
}

main();
