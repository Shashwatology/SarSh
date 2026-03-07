const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function migrate() {
    console.log('Starting Phase 1 database migration...');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Alter Messages table
        console.log('Altering Messages table...');
        await client.query(`
            ALTER TABLE Messages 
            ADD COLUMN IF NOT EXISTS media_type VARCHAR(20),
            ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
        `);

        // 2. Create StatusUpdates table
        console.log('Creating StatusUpdates table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS StatusUpdates (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES Users(id) ON DELETE CASCADE,
                media_url TEXT NOT NULL,
                media_type VARCHAR(20) DEFAULT 'image',
                caption TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP WITH TIME ZONE
            );
            CREATE INDEX IF NOT EXISTS idx_status_updates_expires_at ON StatusUpdates(expires_at);
        `);

        // We will pause on radically altering Chats -> ChatParticipants for Phase 1 
        // to ensure we don't break existing 1-on-1 routing yet, since Phase 1 focuses on Edit/Delete.
        // We will do the Group Chats database migration in Phase 3.

        await client.query('COMMIT');
        console.log('Migration successful!');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Migration failed: ', e);
    } finally {
        client.release();
        pool.end();
    }
}

migrate();
