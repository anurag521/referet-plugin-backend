const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

async function runMigration() {
    const sqlPath = path.join(__dirname, '../migrations/20241230_create_referrals.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log("🚀 Running Migration: 20241230_create_referrals.sql");

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await pool.query(sql);
        console.log("✅ Migration Successful");
    } catch (e) {
        console.error("❌ Migration Failed", e);
    } finally {
        pool.end();
    }
}

runMigration();
