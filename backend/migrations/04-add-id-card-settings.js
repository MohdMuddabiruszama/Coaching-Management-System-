'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add id_card_settings column to Institutes table
    try {
      await queryInterface.addColumn('Institutes', 'id_card_settings', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {
            theme: { primary_color: '#1e3a8a', text_color: '#ffffff' },
            visible_fields: { photo: true, student_name: true, roll_no: true, parent_name: true, email: true, parent_phone: true, class: true, gender: true, address: true }
        }
      });
    } catch (e) {
      console.log('Column id_card_settings might already exist or error:', e.message);
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeColumn('Institutes', 'id_card_settings');
    } catch (e) {
      console.log('Error removing id_card_settings column:', e.message);
    }
  }
};
