require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    console.log("Connecting to database:", process.env.DATABASE_URL.split('@')[1]); // Log host only for safety

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Supabase/Cloud usually requires SSL
    });

    try {
        await client.connect();

        const sqlPath = path.join(__dirname, '../supabase/migrations/20241231_create_referee_claims.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log("Executing Migration: 20241231_create_referee_claims.sql");
        await client.query(sql);

        console.log("Migration Applied Successfully!");
    } catch (err) {
        console.error("Migration Failed:", err);
    } finally {
        await client.end();
    }
}

runMigration();
