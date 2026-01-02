require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { Client } = require('pg');

async function checkMerchantsTable() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'merchants';
        `);
        console.table(res.rows);
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

checkMerchantsTable();
