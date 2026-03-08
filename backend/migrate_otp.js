require('dotenv').config();
const pool = require('./config/db');

async function migrate() {
    try {
        console.log('Running OTP and PendingRegistrations migrations...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS PendingRegistrations (
                email VARCHAR(255) PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                phone VARCHAR(50),
                password_hash VARCHAR(255) NOT NULL,
                otp VARCHAR(10) NOT NULL,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('PendingRegistrations migration applied successfully.');
        // Keep it open for a beat so we can see
        setTimeout(() => process.exit(0), 500);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
