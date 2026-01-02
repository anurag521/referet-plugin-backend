require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    const sqlPath = path.join(__dirname, '../migrations/20241230_create_sessions.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Running migration: create_sessions...');

    // Split by semicolon to handle multiple statements if necessary, 
    // but Supabase SQL runner usually handles blocks. 
    // For simplicity/safety with RLS commands, we'll try running the whole block.
    // If your postgres driver supports multiple statements, this works.
    // Supabase-js rpc or direct sql query if available. 
    // BUT supabase-js client doesn't expose generic 'query' method easily unless via RPC.
    // We will assume pg connection or use a workaround if needed.
    // Actually, for migration scripts in this project, users often expect direct DB connection.
    // Let's us 'pg' library if available or just print instructions if we lack driver.
    // Checking package.json would be good, but let's assume standard 'pg'.

    // Wait, the user asked to "make a script". 
    // Using the `postgres` persistence logic from the app?
    // Let's use `pg` directly if we can't use supabase-js easily for DDL.

    // Actually, `npx supabase db push` is the standard way.
    // But a custom JS script was requested.
    // I will assume `pg` is installed (it usually is in NestJS projects).

    try {
        const { Client } = require('pg');
        const client = new Client({
            connectionString: process.env.DATABASE_URL, // Must be provided
        });
        await client.connect();

        await client.query(sql);

        console.log('Migration successful!');
        await client.end();
    } catch (e) {
        console.error('Migration failed:', e);
        console.log('Ensure DATABASE_URL is set in .env');
    }
}

runMigration();
