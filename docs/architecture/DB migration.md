🛡️
ENTERPRISE DATABASE
SAFETY & MIGRATION ARCHITECTURE
ZenithFlows — School · College · Coaching Center · Training Institute
Zero Data Loss  ·  Umzug Migrations  ·  Automated Backups  ·  Soft Delete  ·  Audit Logs  ·  Point-in-Time Recovery


Core Principle	Institute data is MORE important than application code. If the app crashes, it can be redeployed. If data is lost, institutes may never recover.
Chosen Strategy	Approach 1 + Approach 3 combined — Migration Engine + Multi-Layer Protection
Schema Changes	Umzug migration runner — every change tracked, versioned, applied exactly once
NEVER Use	sequelize.sync({ force:true }) or sync({ alter:true }) in production
Backup Schedule	Daily automated to Neon built-in + weekly export to AWS S3
Delete Policy	Soft delete only (deleted_at timestamp) — no permanent DELETE ever
Audit Trail	Every critical action logged with who, what, when, old value, new value
Recovery Target	Max data loss: minutes, not months. Restore in <30 minutes.
Build Time	Phase 1: 1 day · Full implementation: 5 days
 
1. The Problem — What Can Go Wrong Right Now
Your current setup has two issues that are acceptable for early development but become dangerous as institutes add real data. Understanding exactly what can go wrong makes the solution obvious.

Current Setup — What Each Line Does
sequelize.sync({ alter: false })
  → Safe: Creates new tables. Does NOT touch existing ones. Good.

sequelize.sync({ alter: true })  ← NEVER use this in production
  → DANGEROUS: Sequelize compares your model to the DB and 'fixes' differences.
  → If you rename a model field, Sequelize drops the old column and loses all data.
  → If you add a field with no default, it may fail for all existing rows.
  → Real example: Rename students.phone to students.mobile → Sequelize drops
  → phone column, losing 10,000 student phone numbers permanently.

sequelize.sync({ force: true })  ← NEVER use this in production
  → Drops EVERY table and recreates it empty. All data gone.
  → Only safe in local dev with test data.

Raw ALTER TABLE blocks in app.js
  → No tracking of which ones have already run.
  → If the server restarts, they run again (may error or corrupt data).
  → Order matters but is not enforced.
  → There is no rollback if one fails halfway through.


What Happens to Institute Data If These Run in Production
Scenario 1 — Developer renames a model field:
  sync({ alter:true }) silently drops the old column.
  10,000 rows of student data gone. No error shown. No warning.

Scenario 2 — Server restarts with RUN_STARTUP_MIGRATIONS=true:
  ALTER TABLE runs again on already-modified tables.
  May fail with 'column already exists' errors blocking startup.
  OR silently overwrites default values on existing rows.

Scenario 3 — Neon DB connection timeout during ALTER TABLE:
  Half the column additions succeed, half fail.
  App starts with an inconsistent schema.
  Students can log in but their fees page crashes.

Scenario 4 — Developer accidentally uses sync({ force:true }) while
  deploying to production instead of dev:
  All 66 tables dropped. All institute data gone.
  No backup = no recovery. Institute goes offline permanently.

2. The Chosen Architecture — Approach 1 + Approach 3 Combined
After analysing all three approaches against ZenithFlows' actual situation (Neon PostgreSQL, 66 tables, multi-tenant, growing institute count), the right answer combines Approach 1's migration discipline with Approach 3's multi-layer data protection. Here is what each layer does and why.

Layer	Component	What It Does	Protects Against
1	Umzug Migrations	Every schema change is a versioned file. Applied exactly once. Tracked in SequelizeMeta table.	Duplicate ALTER, missed changes, ordering bugs
2	sync({ alter:false }) only	Creates brand-new tables safely. Never modifies existing ones.	Accidental column drops from model renames
3	Neon Automated Backups	Neon runs point-in-time recovery (PITR) automatically for all databases.	Server crash, accidental data deletion
4	Weekly S3 Export	pg_dump exported weekly to AWS S3 (or Cloudflare R2). 30-day retention.	Neon outage, account issues, regional failure
5	Soft Delete	No row is ever permanently deleted. deleted_at timestamp instead of DELETE.	Accidental deletions, parent removes child by mistake
6	Audit Logs Table	Every critical action logged: who, what, when, old value, new value.	Disputes, data tampering, debugging corruption
7	Transaction Wrappers	Critical operations (fee payment, promotion, admission) wrapped in BEGIN/COMMIT.	Partial failure leaving half-written data
8	Migration Staging Rule	All migrations run on staging/dev first. Never directly on production DB.	Migration bugs destroying live institute data

Phase 1 — Umzug Migration Engine Setup 
This is the most important phase. Once Umzug is running, every future schema change is safe, tracked, and reversible. This replaces the raw ALTER TABLE blocks in app.js permanently.

1.1 Install Packages
# In your backend directory:
npm install umzug sequelize-cli

# umzug    — the migration runner (official Sequelize engine)
# sequelize-cli — lets you generate migration files from terminal

1.2 Create Folder Structure
backend/
  config/
    umzug.js          ← migration runner configuration (create this)
  migrations/
    00-baseline.js    ← extract existing ALTER TABLE blocks here
    01-add-student-status.js
    02-add-is-test-account.js
    03-add-soft-delete.js
    (all future changes go here as numbered files)
  models/
    ... (existing)
  app.js             ← replace ALTER blocks with umzug.up()

1.3 Create: backend/config/umzug.js
// backend/config/umzug.js
const { Umzug, SequelizeStorage } = require('umzug');
const { sequelize } = require('../models');
const path = require('path');

const umzug = new Umzug({
  migrations: {
    // Auto-discover all .js files in the migrations folder
    glob: path.join(__dirname, '../migrations/*.js'),
    resolve: ({ name, path: mPath, context }) => {
      const migration = require(mPath);
      return {
        name,
        up:   async () => migration.up(context.queryInterface, context.Sequelize),
        down: async () => migration.down(context.queryInterface, context.Sequelize),
      };
    },
  },
  context: {
    queryInterface: sequelize.getQueryInterface(),
    Sequelize:      sequelize.constructor,
  },
  storage: new SequelizeStorage({
    sequelize,
    // Creates a 'SequelizeMeta' table to track which migrations ran
    tableName: 'SequelizeMeta',
  }),
  logger: console,  // logs migration name + status to terminal
});

module.exports = umzug;

1.4 Update: backend/app.js — Replace ALTER Blocks
// backend/app.js
const umzug = require('./config/umzug');

async function startServer() {
  try {
    // STEP 1: Connect to DB
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // STEP 2: Create brand-new tables only (safe, never modifies existing)
    await sequelize.sync({ alter: false });
    console.log('✅ New tables created');

    // STEP 3: Run pending migrations (tracked in SequelizeMeta)
    // Each migration runs EXACTLY ONCE — never twice
    const pending = await umzug.pending();
    if (pending.length > 0) {
      console.log(`⏳ Running ${pending.length} pending migration(s)...`);
      await umzug.up();
      console.log('✅ All migrations applied');
    } else {
      console.log('✅ Database schema is up to date');
    }

    // STEP 4: Start the HTTP server
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

  } catch (err) {
    console.error('❌ Server startup failed:', err.message);
    process.exit(1);  // Hard stop — don't run with broken schema
  }
}

startServer();

// ─── REMOVE THIS ENTIRE BLOCK ────────────────────────────────
// DELETE: if (process.env.RUN_STARTUP_MIGRATIONS === 'true') {
//   try { await sequelize.query('ALTER TABLE ...') } catch(e) {}
//   try { await sequelize.query('ALTER TABLE ...') } catch(e) {}
// }
// ─────────────────────────────────────────────────────────────

1.5 Migration File Format — How to Write Every Future Change
// backend/migrations/YYYYMMDD-description.js
// Example: 20260804-add-student-status.js

'use strict';

module.exports = {

  // ── UP: what to do when applying this migration ───────────
  async up(queryInterface, Sequelize) {
    // Check column exists first — safe to run even if restarted
    const tableDesc = await queryInterface.describeTable('students');

    if (!tableDesc.status) {
      await queryInterface.addColumn('students', 'status', {
        type:         Sequelize.DataTypes.STRING(20),
        defaultValue: 'active',
        allowNull:    false,
        comment:      'active|promoted|graduated|alumni|dropped|archived',
      });
      console.log('✅ Added students.status column');
    }
  },

  // ── DOWN: how to reverse this migration ───────────────────
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('students', 'status');
  },

};

1.6 Terminal Commands — Your Daily Workflow
# Generate a new migration file (auto-names with timestamp):
npx sequelize-cli migration:generate --name add-student-status

# See which migrations are pending (not yet applied):
node -e "require('./config/umzug').pending().then(p => console.log(p.map(m=>m.name)))"

# Apply all pending migrations manually (also runs on server start):
node -e "require('./config/umzug').up().then(()=>process.exit(0))"

# Rollback the last migration:
node -e "require('./config/umzug').down().then(()=>process.exit(0))"

# Rollback to a specific migration:
node -e "require('./config/umzug').down({to:'20260101-baseline'}).then(()=>process.exit(0))"

The Golden Rule — Standard Operating Procedure (SOP)
For ANY database change, follow this exact order. No exceptions.

STEP 1: Update the model file (models/Student.js, etc.)
STEP 2: Generate migration: npx sequelize-cli migration:generate --name describe-your-change
STEP 3: Write the up() and down() functions in the generated file
STEP 4: Test it on your local machine first
STEP 5: Deploy to production — Umzug runs it automatically on server start
STEP 6: Check SequelizeMeta table — your migration name appears there

NEVER DO:
  ✗  Write raw ALTER TABLE in app.js
  ✗  Use sync({ alter: true }) or sync({ force: true })
  ✗  Run ALTER TABLE directly in Neon dashboard on production
  ✗  Skip the down() function (needed for rollback)
  ✗  Run a migration on production without testing locally first

Phase 2 — Baseline Migration — Extract Existing ALTER Blocks 
Move all your existing raw ALTER TABLE blocks from app.js into a single baseline migration file. This makes them tracked, safe, and never run twice.

2.1 Create: backend/migrations/00-baseline.js
// backend/migrations/00-baseline.js
// Extracted from app.js startup migration block
// Run once — Umzug will never run it again after first apply

'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    const DT = Sequelize.DataTypes;
    const t  = await queryInterface.sequelize.transaction();
    try {

      // ── Helper: add column only if it doesn't exist ─────────
      async function addIfMissing(table, column, definition) {
        const desc = await queryInterface.describeTable(table);
        if (!desc[column]) {
          await queryInterface.addColumn(table, column, definition, { transaction: t });
          console.log(`  + ${table}.${column}`);
        }
      }

      // ── Add all columns that were in your raw ALTER blocks ───
      await addIfMissing('subscriptions', 'is_test', {
        type: DT.BOOLEAN, defaultValue: false, allowNull: false,
      });
      await addIfMissing('subscriptions', 'discount_amount', {
        type: DT.DECIMAL(10,2), defaultValue: 0, allowNull: false,
      });
      await addIfMissing('institutes', 'is_test_account', {
        type: DT.BOOLEAN, defaultValue: false, allowNull: false,
      });
      await addIfMissing('students', 'photo_url', {
        type: DT.STRING(500), allowNull: true,
      });
      await addIfMissing('students', 'deleted_at', {
        type: DT.DATE, allowNull: true,
      });
      await addIfMissing('users', 'deleted_at', {
        type: DT.DATE, allowNull: true,
      });

      // ── Add performance indexes ───────────────────────────────
      const qi = queryInterface;
      const addIdx = async (table, fields, name) => {
        try {
          await qi.addIndex(table, fields, { name, transaction: t });
        } catch(e) {
          if (!e.message.includes('already exists')) throw e;
        }
      };
      await addIdx('subscriptions', ['is_test'],             'idx_sub_is_test');
      await addIdx('subscriptions', ['payment_status','is_test'], 'idx_sub_status_test');
      await addIdx('subscriptions', ['institute_id','is_test'], 'idx_sub_inst_test');
      await addIdx('students',      ['class_id','institute_id'], 'idx_stu_class_inst');

      await t.commit();
      console.log('✅ Baseline migration complete');
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },

  async down(queryInterface) {
    // Rollback: remove the added columns
    const tables = [
      ['subscriptions', 'is_test'],
      ['subscriptions', 'discount_amount'],
      ['institutes',    'is_test_account'],
      ['students',      'photo_url'],
      ['students',      'deleted_at'],
      ['users',         'deleted_at'],
    ];
    for (const [table, col] of tables) {
      await queryInterface.removeColumn(table, col);
    }
  },
};

Phase 3 — Soft Delete — No Data Is Ever Permanently Lost 
In ZenithFlows, a student record, fee record, or exam result must NEVER be permanently deleted. Soft delete means we mark a row as deleted with a timestamp instead of actually removing it. The data stays in the database forever and can be recovered at any time.

Why Soft Delete Matters for Institutes
Real scenario: An admin accidentally deletes a student who has 2 years of
attendance, 15 fee payments, and 8 exam results. Without soft delete,
everything is gone permanently in milliseconds.

With soft delete:
  The student row has deleted_at = NOW() set.
  All queries that show students add WHERE deleted_at IS NULL.
  The data is invisible to the app — but still in the database.
  A super admin can recover it in 30 seconds.

Tables that MUST have soft delete in ZenithFlows:
  students, users, institutes, classes, subjects, fees,
  assignments, attendance, marks, announcements, faculty_salaries

3.1 Migration: Add deleted_at to Critical Tables
// backend/migrations/01-add-soft-delete.js
'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    const critical = [
      'students','users','institutes','classes',
      'subjects','fees','assignments','attendance',
      'marks','announcements','faculty_salaries',
    ];
    for (const table of critical) {
      const desc = await queryInterface.describeTable(table);
      if (!desc.deleted_at) {
        await queryInterface.addColumn(table, 'deleted_at', {
          type:      Sequelize.DataTypes.DATE,
          allowNull: true,
          defaultValue: null,
          comment: 'Soft delete timestamp. NULL = active row.',
        });
        await queryInterface.addIndex(table, ['deleted_at'],
          { name: `idx_${table}_deleted_at` });
        console.log(`  + ${table}.deleted_at`);
      }
    }
  },
  async down(queryInterface) {
    const tables = ['students','users','institutes','classes',
      'subjects','fees','assignments','attendance',
      'marks','announcements','faculty_salaries'];
    for (const t of tables) {
      await queryInterface.removeColumn(t, 'deleted_at');
    }
  },
};

3.2 Add paranoid: true to Sequelize Models
// In EVERY critical model — example: models/Student.js
const Student = sequelize.define('Student', {
  // ... your existing fields ...
}, {
  tableName:  'students',
  timestamps: true,
  paranoid:   true,   // ← THIS ONE LINE enables soft delete
  // paranoid: true means:
  // - Student.destroy() sets deleted_at = NOW() instead of DELETE
  // - Student.findAll() automatically adds WHERE deleted_at IS NULL
  // - Student.findByPk() returns null if deleted_at is set
  // - Student.restore({ where:{id} }) undeletes a row
});

// To recover a soft-deleted student:
await Student.restore({ where: { id: studentId } });

// To see deleted rows (super admin use):
await Student.findAll({ paranoid: false });  // includes deleted rows

// To permanently delete (ONLY for GDPR compliance, with explicit flag):
await Student.destroy({ where:{ id }, force: true }); // hard delete

3.3 Soft Delete API — Super Admin Recovery Endpoint
// controllers/superadmin/recovery.controller.js
const { Student, User, Institute } = require('../../models');

// GET /api/superadmin/recovery/:table — list soft-deleted rows
exports.listDeleted = async (req, res) => {
  const { table } = req.params;
  const MODEL_MAP = { students: Student, users: User, institutes: Institute };
  const Model = MODEL_MAP[table];
  if (!Model) return res.status(400).json({ message: 'Unknown table' });

  const rows = await Model.findAll({
    paranoid: false,  // include soft-deleted
    where: sequelize.literal('deleted_at IS NOT NULL'),
    attributes: { exclude: [] },
  });
  return res.json({ success: true, data: rows });
};

// POST /api/superadmin/recovery/:table/:id — restore one row
exports.restore = async (req, res) => {
  const { table, id } = req.params;
  const MODEL_MAP = { students: Student, users: User, institutes: Institute };
  const Model = MODEL_MAP[table];
  if (!Model) return res.status(400).json({ message: 'Unknown table' });

  await Model.restore({ where: { id } });
  return res.json({ success: true, message: `${table} #${id} restored` });
};

Phase 4 — Audit Logs — Complete Trail of Who Did What 
Every critical action in ZenithFlows must be logged: who did it, what they did, when, what the old value was, and what the new value is. This is essential for disputes, debugging, and compliance.

4.1 Migration: Create audit_logs Table
// backend/migrations/02-create-audit-logs.js
'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    const DT = Sequelize.DataTypes;
    await queryInterface.createTable('audit_logs', {
      id:           { type: DT.BIGINT, autoIncrement: true, primaryKey: true },
      institute_id: { type: DT.INTEGER, allowNull: true },
      user_id:      { type: DT.INTEGER, allowNull: true },
      user_role:    { type: DT.STRING(30), allowNull: true },
      action:       { type: DT.STRING(50), allowNull: false },
      // Examples: 'student.delete', 'fee.payment', 'exam.lock',
      // 'salary.disburse', 'institute.toggle_test', 'promotion.execute'
      entity_type:  { type: DT.STRING(50), allowNull: false },
      entity_id:    { type: DT.INTEGER, allowNull: true },
      old_value:    { type: DT.JSONB, allowNull: true },
      new_value:    { type: DT.JSONB, allowNull: true },
      ip_address:   { type: DT.STRING(45), allowNull: true },
      user_agent:   { type: DT.TEXT, allowNull: true },
      remarks:      { type: DT.TEXT, allowNull: true },
      created_at:   { type: DT.DATE, defaultValue: DT.NOW },
    });
    await queryInterface.addIndex('audit_logs',
      ['institute_id','entity_type','created_at'],
      { name: 'idx_audit_inst_entity_date' });
    await queryInterface.addIndex('audit_logs',
      ['entity_type','entity_id'],
      { name: 'idx_audit_entity' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('audit_logs');
  },
};

4.2 AuditLog Model
// models/AuditLog.js
module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define('AuditLog', {
    id:           { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    institute_id: { type: DataTypes.INTEGER, allowNull: true },
    user_id:      { type: DataTypes.INTEGER, allowNull: true },
    user_role:    { type: DataTypes.STRING(30) },
    action:       { type: DataTypes.STRING(50), allowNull: false },
    entity_type:  { type: DataTypes.STRING(50), allowNull: false },
    entity_id:    { type: DataTypes.INTEGER },
    old_value:    { type: DataTypes.JSONB },
    new_value:    { type: DataTypes.JSONB },
    ip_address:   { type: DataTypes.STRING(45) },
    user_agent:   { type: DataTypes.TEXT },
    remarks:      { type: DataTypes.TEXT },
  }, { tableName: 'audit_logs', timestamps: false });
  return AuditLog;
};

4.3 Audit Helper — utils/audit.js
// utils/audit.js
const { AuditLog } = require('../models');

// Call this from any controller after a critical action
// It's async but non-blocking — never slows down the main response
async function auditLog({
  req,          // Express request (for user + IP)
  action,       // 'student.delete' | 'fee.payment' | 'exam.lock' | etc
  entity_type,  // 'Student' | 'Fee' | 'Exam' | etc
  entity_id,    // the row ID that was affected
  old_value,    // JS object of values BEFORE the change
  new_value,    // JS object of values AFTER the change
  remarks,      // optional human note
}) {
  try {
    await AuditLog.create({
      institute_id: req?.user?.institute_id || null,
      user_id:      req?.user?.id           || null,
      user_role:    req?.user?.role         || null,
      action,
      entity_type,
      entity_id,
      old_value:  old_value ? JSON.parse(JSON.stringify(old_value))  : null,
      new_value:  new_value ? JSON.parse(JSON.stringify(new_value))  : null,
      ip_address: req?.ip || req?.connection?.remoteAddress || null,
      user_agent: req?.headers?.['user-agent'] || null,
      remarks,
    });
  } catch (err) {
    // Never let audit logging crash the main operation
    console.error('Audit log failed:', err.message);
  }
}

module.exports = { auditLog };

4.4 Using Audit Logs in Controllers — Examples
// In your student delete controller:
const { auditLog } = require('../utils/audit');

exports.deleteStudent = async (req, res) => {
  const student = await Student.findByPk(req.params.id);
  const oldData = student.toJSON();  // capture BEFORE deleting

  await student.destroy();  // soft delete (paranoid: true)

  // Log it — fire-and-forget, doesn't slow the response
  auditLog({
    req,
    action:      'student.soft_delete',
    entity_type: 'Student',
    entity_id:   student.id,
    old_value:   oldData,
    new_value:   { deleted_at: new Date() },
    remarks:     `Soft deleted by ${req.user.role}`,
  });

  return res.json({ success: true, message: 'Student removed' });
};

// In fee payment controller:
auditLog({
  req,
  action:      'fee.payment',
  entity_type: 'Fee',
  entity_id:   fee.id,
  old_value:   { status: 'pending', amount_paid: 0 },
  new_value:   { status: 'paid', amount_paid: fee.amount },
});

Phase 5 — Automated Backups — Data Safe Even if App Crashes 
Backups are the last line of defence. Even if every other protection fails, a backup from 24 hours ago means you lose at most one day of data — not years. ZenithFlows uses three backup layers in combination.

5.1 Layer 1 — Neon Built-In PITR (Already Active — Free)
Neon PostgreSQL provides Point-in-Time Recovery (PITR) automatically. This means Neon continuously logs every change to your database. If data is accidentally deleted at 11:35 AM, you can restore to 11:34 AM without losing the rest of the day.

Neon PITR — How to Use It
1. Go to: console.neon.tech → Your Project → Branches
2. Click 'Restore' on your main branch
3. Select the exact date and time you want to restore to
4. Neon creates a new branch with the data at that point in time
5. You can test on the new branch, then swap it to main

Free tier: 7-day history
Pro tier:  30-day history (recommended for production)

Cost for Pro: ~$19/month — worth it for institute data.
One accidental deletion of 500 student records costs 0 hours to recover.

5.2 Layer 2 — Weekly pg_dump Export to AWS S3 (Recommended)
Even with Neon PITR, you should export a full database dump weekly to a separate storage provider. This protects against Neon account issues, regional outages, or misconfigured access.

# backend/scripts/backup.sh
#!/bin/bash
# Run this weekly via cron or Railway's cron job

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="zenithflows_backup_${DATE}.sql"
S3_BUCKET="your-zenithflows-backups"

echo "Starting backup: ${BACKUP_FILE}"

# 1. Dump the database
pg_dump $DATABASE_URL > /tmp/$BACKUP_FILE

# 2. Compress it
gzip /tmp/$BACKUP_FILE

# 3. Upload to S3
aws s3 cp /tmp/${BACKUP_FILE}.gz s3://${S3_BUCKET}/weekly/${BACKUP_FILE}.gz

# 4. Delete local file
rm /tmp/${BACKUP_FILE}.gz

# 5. Delete S3 backups older than 30 days
aws s3 ls s3://${S3_BUCKET}/weekly/ | \
  awk '{print $4}' | \
  while read f; do
    if [[ "$f" < "zenithflows_backup_$(date -d '-30 days' +%Y%m%d)" ]]; then
      aws s3 rm s3://${S3_BUCKET}/weekly/$f
    fi
  done

echo "Backup complete: ${BACKUP_FILE}.gz"

5.3 Layer 3 — Scheduled Node.js Backup Job (pg_dump via Node)
// backend/scripts/backup.js
// Run via node-cron — weekly at 2 AM Sunday
const { exec } = require('child_process');
const cron    = require('node-cron');  // npm install node-cron
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs      = require('fs');
const path    = require('path');

const s3 = new S3Client({ region: process.env.AWS_REGION });

async function runBackup() {
  const filename = `backup_${new Date().toISOString().replace(/[:.]/g,'_')}.sql`;
  const filepath = path.join('/tmp', filename);

  console.log(`Starting backup → ${filename}`);

  // 1. Dump
  await new Promise((resolve, reject) => {
    exec(`pg_dump ${process.env.DATABASE_URL} > ${filepath}`, (err) => {
      if (err) reject(err); else resolve();
    });
  });

  // 2. Upload to S3
  const fileStream = fs.createReadStream(filepath);
  await s3.send(new PutObjectCommand({
    Bucket: process.env.BACKUP_S3_BUCKET,
    Key:    `weekly/${filename}`,
    Body:   fileStream,
  }));

  fs.unlinkSync(filepath);
  console.log(`Backup complete → s3://.../${filename}`);
}

// Schedule: 2:00 AM every Sunday
cron.schedule('0 2 * * 0', runBackup);

// Also export for manual trigger:
module.exports = { runBackup };

Backup Strategy Summary — 3 Layers
LAYER 1 — Neon PITR (automatic, always on):
  Protects against: accidental deletion, bad migration, app bug
  Recovery time:    5 minutes
  Data loss window: seconds to minutes
  Cost:             Included in Neon Pro ($19/mo)

LAYER 2 — Weekly S3 export (script above):
  Protects against: Neon account suspension, regional outage, billing issue
  Recovery time:    30–60 minutes
  Data loss window: up to 7 days
  Cost:             S3 storage ~$1–3/month for typical DB size

LAYER 3 — Git-tracked migrations:
  Protects against: schema corruption
  Recovery:         Re-run migrations on a fresh DB
  Gives you:        Reproducible schema from scratch in minutes

Combined: Maximum realistic data loss = 1 day (worst case, all 3 layers fail)
Realistic scenario: Neon PITR catches it in seconds.

Phase 6 — Transaction Wrappers — Partial Failures Never Corrupt Data  
A transaction means: either ALL steps succeed, or NONE of them happen. Without transactions, a server crash halfway through a fee payment can leave the fee marked as 'paid' but the student's balance unchanged — inconsistent data that is very hard to diagnose and fix.

6.1 Which Operations MUST Use Transactions
Operation	Why Transaction Is Critical
Fee payment	Update fee record + create payment entry + update student balance — all 3 must succeed or all 3 must fail
Salary disbursement	Update salary status + log payment + update faculty record — partial update = wrong payroll records
Student promotion	Update 50+ students' class_id + close enrollment records + create new ones — must be atomic
Institute registration	Create institute + create admin user + create default plan — partial creation = orphan records
Subscription payment	Create subscription + update institute status + log payment — partial = institute shows as paid but has no access
Marks locking	Set marks_locked + send notifications + log action — must all happen or none
Toggle test mode	Update institute.is_test_account + update ALL subscriptions.is_test — must be atomic

6.2 Transaction Pattern — Use This in Every Critical Controller
// utils/withTransaction.js
const { sequelize } = require('../models');

// Wrapper: runs fn inside a transaction, auto-commits or rolls back
async function withTransaction(fn) {
  const t = await sequelize.transaction();
  try {
    const result = await fn(t);
    await t.commit();
    return result;
  } catch (err) {
    await t.rollback();
    throw err;  // re-throw so controller returns 500
  }
}
module.exports = { withTransaction };

// Usage in fee payment controller:
const { withTransaction } = require('../utils/withTransaction');

exports.recordPayment = async (req, res) => {
  try {
    const result = await withTransaction(async (t) => {
      // Step 1: Update fee status
      await Fee.update(
        { status:'paid', paid_at: new Date() },
        { where:{ id: req.params.id }, transaction: t }
      );
      // Step 2: Create payment log
      await PaymentLog.create(
        { fee_id: req.params.id, amount: req.body.amount, ... },
        { transaction: t }
      );
      // If Step 2 fails, Step 1 is automatically rolled back
      return { success: true };
    });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ message: 'Payment failed', error: err.message });
  }
};

Phase 7 — Environment Safety Rules — Never Touch Production Data Accidentally 
The most common way production data is destroyed is a developer running a command locally, not realising they are connected to the production database. These rules prevent that.

7.1 Environment Configuration
# .env.development (local)
NODE_ENV=development
DATABASE_URL=postgresql://localhost:5432/zenithflows_dev
RUN_STARTUP_MIGRATIONS=true
ALLOW_FORCE_SYNC=true   # ONLY in dev — never in prod

# .env.production (Railway / server)
NODE_ENV=production
DATABASE_URL=postgresql://neon.tech/.../zenithflows
RUN_STARTUP_MIGRATIONS=true  # umzug.up() still runs on deploy
ALLOW_FORCE_SYNC=false        # HARDCODED protection

# .env.staging (testing before prod deploy)
NODE_ENV=staging
DATABASE_URL=postgresql://neon.tech/.../zenithflows_staging
RUN_STARTUP_MIGRATIONS=true

7.2 Startup Guard — Hard Block on Dangerous Operations in Production
// backend/config/dbSafety.js
// Called at the very start of app.js before anything else
function assertDatabaseSafety() {
  const env = process.env.NODE_ENV;
  const isProd = env === 'production';

  // ── ABSOLUTE BLOCK: force sync in production ───────────────
  if (isProd && process.env.ALLOW_FORCE_SYNC === 'true') {
    console.error('🚨 CRITICAL: ALLOW_FORCE_SYNC is true in production!');
    console.error('This would wipe ALL institute data. Refusing to start.');
    process.exit(1);
  }

  // ── WARN: staging DB URL looks like prod ───────────────────
  if (env === 'development' && process.env.DATABASE_URL?.includes('neon.tech')) {
    console.warn('⚠️  WARNING: You are in dev mode but connected to Neon!');
    console.warn('If this is intentional, ignore this warning.');
  }

  // ── BLOCK: force: true or alter: true never reach production ─
  if (isProd) {
    const originalSync = require('../models').sequelize.sync.bind(
      require('../models').sequelize
    );
    require('../models').sequelize.sync = (opts={}) => {
      if (opts.force || opts.alter) {
        console.error('🚨 Blocked: sync({ force/alter }) in production');
        throw new Error('sync({ force/alter }) not allowed in production');
      }
      return originalSync(opts);
    };
  }
}
module.exports = { assertDatabaseSafety };

// In app.js — FIRST LINE:
const { assertDatabaseSafety } = require('./config/dbSafety');
assertDatabaseSafety();  // runs before anything else

Phase 8 — Standard Operating Procedures & Complete Checklist 
These are the exact steps every developer on ZenithFlows must follow. Print this and put it next to your deployment process.

8.1 SOP: How to Make ANY Database Change
Step	Action	Command / Detail	Where
1	Update the Sequelize model	Add/rename the field in models/YourModel.js	models/
2	Generate a migration file	npx sequelize-cli migration:generate --name your-description	backend/
3	Write up() function	queryInterface.addColumn(table, column, definition)	migrations/
4	Write down() function	queryInterface.removeColumn(table, column)	migrations/
5	Test locally	Start dev server — check 'Migration applied' in console	local
6	Test the down() rollback	node -e "require('./config/umzug').down()" — verify it undoes correctly	local
7	Commit to Git	git add . && git commit -m 'migration: add-xxx-column'	git
8	Deploy to staging	Push to staging branch — umzug runs automatically	Railway
9	Verify on staging	Check SequelizeMeta table — migration name must appear	Neon dashboard
10	Deploy to production	Push to main branch — umzug runs automatically	Railway
11	Verify on production	Check logs for '✅ Migration applied' message	Railway logs


8.2 SOP: What to Do If a Migration Fails in Production
# STEP 1: Do NOT restart the server repeatedly — it will try to run the
# broken migration again and again and may cause inconsistent state.

# STEP 2: Check Railway logs for the exact error message.

# STEP 3: Fix the migration file locally.

# STEP 4: If the migration is half-applied, you may need to:
# a) Remove the entry from SequelizeMeta for that migration name
# b) Write a cleanup migration that undoes the partial change

# STEP 5: Use Neon PITR if data was corrupted:
# Go to Neon dashboard → Branches → Restore → pick time before migration

# STEP 6: Never manually ALTER TABLE on production to 'fix' it.
# Always fix through a new migration file.


8.3 What Each File in SequelizeMeta Means
-- After running all migrations, SequelizeMeta looks like:
SELECT * FROM SequelizeMeta;

name
----------------------------------------
00-baseline.js
01-add-soft-delete.js
02-create-audit-logs.js
03-add-student-status.js
04-create-academic-years.js
05-create-promotion-logs.js

-- Each row = this migration ran exactly once and succeeded.
-- If a migration is NOT in this table, it will run on next server start.
-- If it IS in this table, it will NEVER run again.


8.4 Final Implementation Checklist
	Task	Status
☐	npm install umzug sequelize-cli node-cron @aws-sdk/client-s3	Phase 1
☐	Create backend/config/umzug.js with SequelizeStorage	Phase 1
☐	Update app.js: remove raw ALTER blocks, add umzug.up()	Phase 1
☐	Create backend/config/dbSafety.js and call at top of app.js	Phase 7
☐	Create backend/migrations/00-baseline.js with all existing ALTER blocks	Phase 2
☐	Test locally: server starts, SequelizeMeta shows 00-baseline.js	Phase 2
☐	Create migration 01-add-soft-delete.js for all critical tables	Phase 3
☐	Add paranoid: true to all critical Sequelize models	Phase 3
☐	Create recovery endpoint: GET /api/superadmin/recovery/:table	Phase 3
☐	Create migration 02-create-audit-logs.js	Phase 4
☐	Create models/AuditLog.js model	Phase 4
☐	Create utils/audit.js helper function	Phase 4
☐	Add auditLog() call to: student delete, fee payment, salary disburse, promotion	Phase 4
☐	Enable Neon Pro plan (7→30 day PITR)	Phase 5
☐	Create backup.sh script	Phase 5
☐	Set up AWS S3 bucket for backups (or Cloudflare R2)	Phase 5
☐	Schedule weekly backup via node-cron or Railway cron	Phase 5
☐	Test backup restore: restore a dump locally and verify data	Phase 5
☐	Create utils/withTransaction.js wrapper	Phase 6
☐	Wrap fee payment in withTransaction	Phase 6
☐	Wrap salary disbursement in withTransaction	Phase 6
☐	Wrap student promotion in withTransaction	Phase 6
☐	Set .env.production with ALLOW_FORCE_SYNC=false	Phase 7
☐	Never use sync({ force:true }) or sync({ alter:true }) again	Phase 7
☐	Share this SOP doc with every developer on the project	Phase 8


8.5 Files Created or Modified Summary
File	Action	Purpose
backend/config/umzug.js	New	Migration runner — tracks every schema change
backend/config/dbSafety.js	New	Blocks force/alter sync in production
backend/app.js	Modify	Remove ALTER blocks, add umzug.up() call
backend/migrations/00-baseline.js	New	Extracts all existing ALTER blocks — runs once
backend/migrations/01-add-soft-delete.js	New	Adds deleted_at to 11 critical tables
backend/migrations/02-create-audit-logs.js	New	Creates audit_logs table
backend/models/AuditLog.js	New	Sequelize model for audit logs
backend/models/Student.js (+ all critical models)	Modify	Add paranoid: true for soft delete
backend/utils/audit.js	New	auditLog() helper — call from any controller
backend/utils/withTransaction.js	New	Transaction wrapper for critical operations
backend/controllers/superadmin/recovery.controller.js	New	List and restore soft-deleted rows
backend/scripts/backup.js	New	Weekly S3 backup via node-cron
backend/scripts/backup.sh	New	Shell script for pg_dump export
.env.development	New/Update	Dev-safe settings
.env.production	New/Update	Production guard settings


Never Again — The Three Lines That Must Never Appear in Production
// ✗ NEVER — drops all tables and loses ALL institute data:
await sequelize.sync({ force: true });

// ✗ NEVER — may silently drop columns when model changes:
await sequelize.sync({ alter: true });

// ✗ NEVER — raw ALTER in app.js runs again on every restart:
if (RUN_STARTUP_MIGRATIONS) { await sequelize.query('ALTER TABLE...') }

// ✓ ALWAYS — safe, tracked, applied exactly once:
await sequelize.sync({ alter: false });  // only creates new tables
await umzug.up();                        // applies pending migrations once

