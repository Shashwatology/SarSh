require('dotenv').config();
const pool = require('./config/db');

async function migrate() {
    try {
        console.log('Running Phase 3 migrations...');
        
        // Presence
        await pool.query('ALTER TABLE Users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;');
        await pool.query('ALTER TABLE Users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE;');
        
        // Couples Mode
        await pool.query('ALTER TABLE Chats ADD COLUMN IF NOT EXISTS is_couple_mode BOOLEAN DEFAULT false;');
        await pool.query('ALTER TABLE Chats ADD COLUMN IF NOT EXISTS anniversary_date DATE;');
        
        // Polls & Disappearing Messages
        await pool.query('ALTER TABLE Messages ADD COLUMN IF NOT EXISTS poll_data JSONB;');
        await pool.query('ALTER TABLE Messages ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;');
        await pool.query('ALTER TABLE Messages ADD COLUMN IF NOT EXISTS is_secret BOOLEAN DEFAULT false;');
        
        console.log('Migrations applied successfully.');
        setTimeout(() => process.exit(0), 500);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
