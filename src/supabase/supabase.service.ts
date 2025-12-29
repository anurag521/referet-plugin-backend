import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit, OnModuleDestroy {
    private pool: Pool;
    private supabase: SupabaseClient;

    constructor() {
        // Initialize Postgres Pool for Data Operations
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false },
        });

        // Initialize Supabase Client for Auth Operations
        // Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are in .env
        const supabaseUrl = process.env.SUPABASE_URL || '';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';

        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
            console.log('🔑 Using Supabase SERVICE_ROLE_KEY for Admin Client');
        } else {
            console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY not found. Fallback to SUPABASE_KEY. Admin actions (createUser) will likely FAIL (403).');
        }

        if (!supabaseUrl || !supabaseKey) {
            console.warn('⚠️ Supabase URL or Key missing. Auth operations may fail.');
        }

        this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    async onModuleInit() {
        try {
            // Optional: Test connection, though lazy connection usually fine
            // await this.pool.query('SELECT 1'); 
            console.log('✅ SupabaseService (PG + Client) initialized');
        } catch (e) {
            console.error('❌ Database connection failed', e);
        }
    }

    async onModuleDestroy() {
        await this.pool.end();
    }

    // Wrapper for raw queries
    async query(text: string, params?: any[]) {
        return this.pool.query(text, params);
    }

    // Expose Supabase Client for Auth
    getClient(): SupabaseClient {
        return this.supabase;
    }
}
