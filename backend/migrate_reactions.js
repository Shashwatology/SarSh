require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool(
    process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
        : { user: 'postgres', password: 'password', host: 'localhost', port: 5432, database: 'chatapp' }
);

async function migrate() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS MessageReactions (
                id SERIAL PRIMARY KEY,
                message_id INTEGER REFERENCES Messages(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES Users(id) ON DELETE CASCADE,
                reaction VARCHAR(10) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(message_id, user_id)
            );
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON MessageReactions(message_id);`);
        console.log('✅ MessageReactions table created successfully!');
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
    }
}

migrate();
