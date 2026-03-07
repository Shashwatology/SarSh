const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function run() {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('password123', salt);
    const users = ['shashwat', 'alice', 'bob', 'charlie', 'david'];

    for (const u of users) {
        console.log(`Resetting password for: ${u}`);
        const res = await pool.query('UPDATE Users SET password_hash = $1 WHERE username = $2', [hash, u]);
        console.log(`Rows affected: ${res.rowCount}`);
    }

    console.log('Passwords reset successfully to: password123');
    await pool.end();
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
