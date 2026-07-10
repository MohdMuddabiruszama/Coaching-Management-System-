const { sequelize } = require('./models');

async function migrate() {
    try {
        await sequelize.authenticate();
        console.log('Connected to DB');
        
        await sequelize.query(`ALTER TABLE attendances ADD COLUMN IF NOT EXISTS source_meta JSONB NULL`);
        await sequelize.query(`ALTER TABLE attendances ADD COLUMN IF NOT EXISTS version INT DEFAULT 1`);
        
        await sequelize.query(`ALTER TABLE faculty_attendances ADD COLUMN IF NOT EXISTS marked_by_type VARCHAR(20) DEFAULT 'manual'`);
        await sequelize.query(`ALTER TABLE faculty_attendances ADD COLUMN IF NOT EXISTS source_meta JSONB NULL`);
        await sequelize.query(`ALTER TABLE faculty_attendances ADD COLUMN IF NOT EXISTS version INT DEFAULT 1`);
        
        console.log('Migration successful');
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        process.exit();
    }
}

migrate();
