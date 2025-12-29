const { execSync } = require('child_process');

console.log('=== Supabase Database Maintenance ===');
console.log('Ensuring tables exist by running migration files...');

try {
    // 1. Generate the migration file (if schema changed)
    // Note: This requires a working DB connection
    console.log('1. Checking for schema changes (creating migration file)...');
    try {
        // We use --create-only if we just want to make the file, but usually 'dev' applies it too.
        // We give it a name to avoid interactive prompt
        execSync('npx prisma migrate dev --name update_schema', { stdio: 'inherit' });
    } catch (e) {
        console.warn('Warning: Could not create new migration. Proceeding to deploy existing ones.');
    }

    // 2. Apply all pending migrations to the database
    console.log('2. Applying migrations (creating/updating tables)...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });

    // 3. Regenerate Client
    console.log('3. Regenerating Prisma Client...');
    execSync('npx prisma generate', { stdio: 'inherit' });

    console.log('✅ Maintenance Success!');
} catch (error) {
    console.error('❌ Maintenance Failed:', error.message);
    console.log('Tip: Check if Supabase project is paused or IP is blocked.');
    process.exit(1);
}
