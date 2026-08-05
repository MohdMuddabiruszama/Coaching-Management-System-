// backend/migrations/03-add-organization-type.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const DT = Sequelize.DataTypes;
    
    try {
      console.log('  [03-add-organization-type] Extending institutes table...');

      const table = 'institutes';

      try {
        const desc = await queryInterface.describeTable(table);
        if (!desc.organization_type) {
          await queryInterface.addColumn(table, 'organization_type', {
            type: DT.STRING(50),
            allowNull: true,
            defaultValue: 'Coaching Center',
          });
          console.log(`    + ${table}.organization_type`);
        }
      } catch (e) {
        console.log(`    ? ${table} not found, skipping`);
      }

      console.log('  [03-add-organization-type] ✅ Extended institutes table.');
    } catch (err) {
      console.error('  [03-add-organization-type] Failed:', err.message);
      throw err;
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeColumn('institutes', 'organization_type');
    } catch (_) {}
  },
};
