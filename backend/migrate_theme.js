require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function migrateTheme() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('Adding theme column to Chats table...');
        await client.query(`
            ALTER TABLE Chats
            ADD COLUMN IF NOT EXISTS theme VARCHAR(50) DEFAULT 'default';
        `);

        await client.query('COMMIT');
        console.log('Migration successful!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', err);
    } finally {
        client.release();
        process.exit();
    }
}

migrateTheme();
