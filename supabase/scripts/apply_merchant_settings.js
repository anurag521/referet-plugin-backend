require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    console.log("Connecting to database:", process.env.DATABASE_URL?.split('@')[1]);

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const sqlPath = path.join(__dirname, '../migrations/20260102_add_merchant_point_settings.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log("Executing Migration: 20260102_add_merchant_point_settings.sql");
        await client.query(sql);

        console.log("Settings Added Successfully!");
    } catch (err) {
        console.error("Migration Failed:", err);
    } finally {
        await client.end();
    }
}

runMigration();
