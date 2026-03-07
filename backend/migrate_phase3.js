require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function migrate() {
    console.log('Starting Phase 3 Group Chat Migration...');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('Seeding ChatParticipants from existing 1-on-1 Chats...');
        // Insert user1
        await client.query(`
            INSERT INTO ChatParticipants (chat_id, user_id)
            SELECT id, user1_id FROM Chats WHERE user1_id IS NOT NULL
            ON CONFLICT DO NOTHING;
        `);
        // Insert user2
        await client.query(`
            INSERT INTO ChatParticipants (chat_id, user_id)
            SELECT id, user2_id FROM Chats WHERE user2_id IS NOT NULL
            ON CONFLICT DO NOTHING;
        `);

        // Important: We won't drop user1_id/user2_id yet until we ensure everything works,
        // but we will no longer use them in our API queries.

        await client.query('COMMIT');
        console.log('Phase 3 Migration successful. All existing chats properly seeded into ChatParticipants.');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Migration failed: ', e);
    } finally {
        client.release();
        pool.end();
    }
}

migrate();
