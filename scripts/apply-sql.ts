import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

async function runSchema() {
    console.log('🔌 Connecting to database...');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const schemaPath = path.join(__dirname, '../supabase/schema.sql');
        console.log(`📂 Reading schema from: ${schemaPath}`);

        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('🚀 Executing SQL schema...');
        await pool.query(schemaSql);

        console.log('✅ Schema applied successfully!');

        const migrationPath = path.join(__dirname, '../supabase/add_name_column.sql');
        console.log(`📂 Reading migration from: ${migrationPath}`);
        if (fs.existsSync(migrationPath)) {
            const migrationSql = fs.readFileSync(migrationPath, 'utf8');
            console.log('🔄 Applying Name Column Migration...');
            await pool.query(migrationSql);
            console.log('✅ Name Column Migration applied successfully!');
        }

        const rlsPath = path.join(__dirname, '../supabase/rls_policies.sql');
        console.log(`📂 Reading RLS policies from: ${rlsPath}`);
        if (fs.existsSync(rlsPath)) {
            const rlsSql = fs.readFileSync(rlsPath, 'utf8');
            console.log('🔒 Applying RLS policies...');
            await pool.query(rlsSql);
            console.log('✅ RLS policies applied successfully!');
        } else {
            console.warn('⚠️ RLS policy file not found, skipping security policies.');
        }
    } catch (e) {
        console.error('❌ Error applying schema:', e);
    } finally {
        await pool.end();
    }
}

runSchema();
