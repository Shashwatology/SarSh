const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool(
    process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
        : {
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'password',
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'chatapp'
        }
);

// Admin credentials
// =========================================
// username   | password
// -----------|---------------------------
// shashwat   | Sarsh@Shashwat1
// sargam     | Sarsh@Sargam1
// ritesh     | Sarsh@Ritesh1
// vaibhav    | Sarsh@Vaibhav1
// sana       | Sarsh@Sana1
// =========================================

const admins = [
    { username: 'shashwat', phone: '9000000001', email: 'shashwat@sarsh.app', password: 'Sarsh@Shashwat1' },
    { username: 'sargam', phone: '9000000002', email: 'sargam@sarsh.app', password: 'Sarsh@Sargam1' },
    { username: 'ritesh', phone: '9000000003', email: 'ritesh@sarsh.app', password: 'Sarsh@Ritesh1' },
    { username: 'vaibhav', phone: '9000000004', email: 'vaibhav@sarsh.app', password: 'Sarsh@Vaibhav1' },
    { username: 'sana', phone: '9000000005', email: 'sana@sarsh.app', password: 'Sarsh@Sana1' },
];

async function seedAdmins() {
    console.log('🔐 Seeding admin users...\n');
    const salt = await bcrypt.genSalt(10);

    for (const admin of admins) {
        const password_hash = await bcrypt.hash(admin.password, salt);
        try {
            const result = await pool.query(
                `INSERT INTO Users (username, phone, email, password_hash, status)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (username) DO NOTHING
                 RETURNING id, username`,
                [admin.username, admin.phone, admin.email, password_hash, 'Admin 🔑']
            );
            if (result.rows.length > 0) {
                console.log(`✅ Created: ${admin.username} (id: ${result.rows[0].id})`);
            } else {
                console.log(`⚠️  Already exists, skipped: ${admin.username}`);
            }
        } catch (err) {
            console.error(`❌ Error creating ${admin.username}:`, err.message);
        }
    }

    console.log('\n✅ Done! Admin credentials:');
    console.log('----------------------------------------------');
    admins.forEach(a => console.log(`  ${a.username.padEnd(10)} → ${a.password}`));
    console.log('----------------------------------------------');

    await pool.end();
}

seedAdmins();
