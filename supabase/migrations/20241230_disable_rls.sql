-- Disable RLS on all tables to remove dependency on Supabase Auth Users
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE merchants DISABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE referrals DISABLE ROW LEVEL SECURITY;

-- Note: We are now relying on Application Logic (Controller) to secure data by `shop_domain`.
