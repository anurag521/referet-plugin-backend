require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { Client } = require('pg');

async function checkTables() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const res = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('rewards', 'user_points', 'user_wallets');
        `);

        console.log("Found Tables:", res.rows.map(r => r.table_name));

        // Check columns for 'rewards'
        const cols = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'rewards'
        `);
        console.log("Rewards Columns:", cols.rows.map(c => c.column_name).join(', '));

    } catch (err) {
        console.error("Check Failed:", err);
    } finally {
        await client.end();
    }
}

checkTables();
