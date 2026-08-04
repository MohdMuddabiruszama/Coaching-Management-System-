// backend/migrations/01-add-soft-delete.js
// ─── Soft Delete Migration ────────────────────────────────────────────────────
// Adds deleted_at column to all critical tables.
// After this migration, no institute data is ever permanently lost.
// Use paranoid:true in Sequelize models to activate soft delete behavior.
// ZenithFlows — Enterprise DB Safety Architecture (Phase 3)

'use strict';

const CRITICAL_TABLES = [
  'students',
  'users',
  'institutes',
  'classes',
  'subjects',
  'fee_structures',   // feesStructure model
  'assignments',
  'attendances',
  'marks',
  'announcements',
  'faculty_salaries',
];

module.exports = {
  async up(queryInterface, Sequelize) {
    const DT = Sequelize.DataTypes;
    
    try {
      console.log('  [01-soft-delete] Adding deleted_at to critical tables...');

      // All tables that require soft deletion (paranoid mode)
      const CRITICAL_TABLES = [
        'students', 'users', 'institutes', 'classes', 'subjects',
        'fees_structures', 'assignments', 'attendances', 'marks', 
        'announcements', 'faculty_salaries'
      ];

      for (const table of CRITICAL_TABLES) {
        try {
          const desc = await queryInterface.describeTable(table);
          if (!desc.deleted_at) {
            await queryInterface.addColumn(table, 'deleted_at', {
              type: DT.DATE,
              allowNull: true,
            });
            console.log(`    + ${table}.deleted_at`);
          }
        } catch (tableErr) {
          console.log(`    ? ${table} — table not found, skipping (will be created by sync)`);
        }
      }
      
      console.log('  [01-soft-delete] ✅ Soft delete migration complete.');
    } catch (err) {
      console.error('  [01-soft-delete] Failed:', err.message);
      throw err;
    }
  },

  async down(queryInterface) {
    const CRITICAL_TABLES = [
      'students', 'users', 'institutes', 'classes', 'subjects',
      'fees_structures', 'assignments', 'attendances', 'marks', 
      'announcements', 'faculty_salaries'
    ];
    console.log('  [01-soft-delete] Rolling back soft delete columns...');
    for (const table of CRITICAL_TABLES) {
      try {
        await queryInterface.removeIndex(table, `idx_${table}_deleted_at`);
      } catch (_) {}
      try {
        await queryInterface.removeColumn(table, 'deleted_at');
        console.log(`    - ${table}.deleted_at removed`);
      } catch (_) {}
    }
  },
};
