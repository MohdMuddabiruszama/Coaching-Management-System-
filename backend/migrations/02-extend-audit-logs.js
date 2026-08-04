// backend/migrations/02-extend-audit-logs.js
// ─── Extend Audit Logs Migration ─────────────────────────────────────────────
// Extends the existing audit_logs table with fields needed for full audit trails:
// entity_type, entity_id, old_value (JSONB), new_value (JSONB).
// The audit_logs table and base model already exist — this adds the new columns.
// ZenithFlows — Enterprise DB Safety Architecture (Phase 4)

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const DT = Sequelize.DataTypes;
    
    try {
      console.log('  [02-audit-logs] Extending audit_logs table for full data trails...');

      const table = 'audit_logs';

      // 1. entity_type: e.g. "Student", "Fee", "Exam"
      try {
        const desc = await queryInterface.describeTable(table);
        if (!desc.entity_type) {
          await queryInterface.addColumn(table, 'entity_type', {
            type: DT.STRING(50),
            allowNull: true,
          });
          console.log(`    + ${table}.entity_type`);
        }
      } catch (e) { console.log(`    ? ${table} not found, skipping`); return; }

      // 2. entity_id: primary key of the affected row
      try {
        const desc = await queryInterface.describeTable(table);
        if (!desc.entity_id) {
          await queryInterface.addColumn(table, 'entity_id', {
            type: DT.INTEGER,
            allowNull: true,
          });
          console.log(`    + ${table}.entity_id`);
        }
      } catch (e) {}

      // 3. old_value: full state BEFORE change
      try {
        const desc = await queryInterface.describeTable(table);
        if (!desc.old_value) {
          await queryInterface.addColumn(table, 'old_value', {
            type: DT.JSONB,
            allowNull: true,
          });
          console.log(`    + ${table}.old_value`);
        }
      } catch (e) {}

      // 4. new_value: full state AFTER change
      try {
        const desc = await queryInterface.describeTable(table);
        if (!desc.new_value) {
          await queryInterface.addColumn(table, 'new_value', {
            type: DT.JSONB,
            allowNull: true,
          });
          console.log(`    + ${table}.new_value`);
        }
      } catch (e) {}

      // 5. remarks: super admin reasoning
      try {
        const desc = await queryInterface.describeTable(table);
        if (!desc.remarks) {
          await queryInterface.addColumn(table, 'remarks', {
            type: DT.TEXT,
            allowNull: true,
          });
          console.log(`    + ${table}.remarks`);
        }
      } catch (e) {}

      console.log('  [02-audit-logs] ✅ Audit logs extended.');
    } catch (err) {
      console.error('  [02-audit-logs] Failed:', err.message);
      throw err;
    }
  },

  async down(queryInterface) {
    const cols = ['entity_type', 'entity_id', 'old_value', 'new_value', 'remarks'];
    for (const col of cols) {
      try {
        await queryInterface.removeColumn('audit_logs', col);
      } catch (_) {}
    }
    try { await queryInterface.removeIndex('audit_logs', 'idx_audit_entity'); } catch (_) {}
    try { await queryInterface.removeIndex('audit_logs', 'idx_audit_inst_entity'); } catch (_) {}
  },
};
