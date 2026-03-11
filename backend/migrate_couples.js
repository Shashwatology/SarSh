const db = require('./config/db');

async function migrateCouples() {
    try {
        console.log('Starting Couples Mode migration...');
        
        await db.query(`
            ALTER TABLE Chats 
            ADD COLUMN IF NOT EXISTS is_couple_mode BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS anniversary_date TIMESTAMP,
            ADD COLUMN IF NOT EXISTS couple_nicknames JSONB;
        `);

        console.log('Migration successful: Couples Mode columns added.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit();
    }
}

migrateCouples();
