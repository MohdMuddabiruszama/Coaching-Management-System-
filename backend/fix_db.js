require('dotenv').config();
const { sequelize } = require('./models');

async function migrate() {
    const cols = [
        `ALTER TABLE biometric_settings ADD COLUMN IF NOT EXISTS enforce_subject_enrollment BOOLEAN DEFAULT true`,
        `ALTER TABLE biometric_settings ADD COLUMN IF NOT EXISTS notify_main_gate_in BOOLEAN DEFAULT false`,
        `ALTER TABLE biometric_settings ADD COLUMN IF NOT EXISTS notify_main_gate_out BOOLEAN DEFAULT false`,
        `ALTER TABLE biometric_settings ADD COLUMN IF NOT EXISTS notify_subject_in BOOLEAN DEFAULT false`,
        `ALTER TABLE biometric_settings ADD COLUMN IF NOT EXISTS notify_subject_out BOOLEAN DEFAULT false`,
    ];
    for (const sql of cols) {
        try {
            await sequelize.query(sql + ';');
            console.log('OK:', sql.split(' ADD COLUMN IF NOT EXISTS ')[1]);
        } catch (e) {
            console.warn('SKIP:', e.message);
        }
    }
    console.log('All migrations done.');
    process.exit(0);
}
migrate();
