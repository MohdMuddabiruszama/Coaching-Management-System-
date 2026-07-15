const { sequelize } = require('./models');

async function run() {
    try {
        await sequelize.query('ALTER TABLE institutes ADD COLUMN student_attendance_mode VARCHAR(255) DEFAULT \'subject_based\';');
        console.log('Column added successfully');
    } catch (error) {
        console.error('Error adding column:', error.message);
    } finally {
        process.exit(0);
    }
}

run();
