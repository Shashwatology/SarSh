const pool = require('./config/db');

async function debug() {
    try {
        console.log('--- TABLES ---');
        const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        tables.rows.forEach(r => console.log(r.table_name));

        console.log('\n--- MESSAGE CONSTRAINTS ---');
        const constraints = await pool.query(`
            SELECT
                tc.constraint_name, 
                tc.table_name, 
                kcu.column_name, 
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name 
            FROM 
                information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name
                  AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name='messages';
        `);
        constraints.rows.forEach(r => {
            console.log(`Table ${r.table_name}.${r.column_name} references ${r.foreign_table_name}.${r.foreign_column_name} (Constraint: ${r.constraint_name})`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debug();
