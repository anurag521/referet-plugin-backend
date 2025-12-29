const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
    console.log('--- Database Migration Tool ---');

    let connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.warn('⚠️  DATABASE_URL is missing in .env');
        return;
    }

    // Remove any existing sslmode parameter
    connectionString = connectionString.replace(/[?&]sslmode=[^&]*/g, '');

    // Mask password for display
    console.log('Target:', connectionString.replace(/:[^:@]*@/, ':****@'));

    const client = new Client({
        connectionString: connectionString,
        ssl: {
            rejectUnauthorized: false  // Accept Supabase's certificates
        }
    });

    try {
        console.log('Connecting...');
        await client.connect();
        console.log('✅ Connected successfully!');

        const schemaPath = path.join(__dirname, '..', 'current_schema.sql');
        if (fs.existsSync(schemaPath)) {
            const sql = fs.readFileSync(schemaPath, 'utf8');
            console.log('Running Schema Migration...');
            await client.query(sql);
            console.log('✅ Schema applied successfully.');
        } else {
            console.warn('⚠️ schema file not found:', schemaPath);
        }

    } catch (err) {
        console.error('\n❌ CONNECTION FAILED');
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

runMigration();
