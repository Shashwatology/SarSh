const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runSchema() {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    try {
        console.log('Running schema.sql against production database...');
        await pool.query(sql);
        console.log('✅ Schema created successfully!');
    } catch (err) {
        console.error('❌ Schema error:', err.message);
    } finally {
        await pool.end();
    }
}

runSchema();
