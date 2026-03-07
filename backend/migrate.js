require('dotenv').config();
const pool = require('./config/db');

async function migrate() {
    try {
        console.log('Running presence migrations...');
        await pool.query('ALTER TABLE Users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;');
        await pool.query('ALTER TABLE Users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE;');
        console.log('Presence migrations applied successfully.');
        // Keep it open for a beat so we can see
        setTimeout(() => process.exit(0), 500);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
