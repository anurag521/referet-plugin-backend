-- Enable RLS on all tables
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrers ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_flags ENABLE ROW LEVEL SECURITY;

-- Policy helper function (optional, but clean)
-- For now, we'll write direct policies for simplicity and portability

-- 1. Merchants Table
-- Merchants can only see and edit their own record
DROP POLICY IF EXISTS "Merchants can manage own data" ON merchants;
CREATE POLICY "Merchants can manage own data" ON merchants
    FOR ALL
    USING (auth.uid() = supabase_user_id);

-- 2. Campaigns
DROP POLICY IF EXISTS "Merchants can manage own campaigns" ON campaigns;
CREATE POLICY "Merchants can manage own campaigns" ON campaigns
    FOR ALL
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE supabase_user_id = auth.uid()
    ));

-- 3. Referrers
DROP POLICY IF EXISTS "Merchants can manage own referrers" ON referrers;
CREATE POLICY "Merchants can manage own referrers" ON referrers
    FOR ALL
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE supabase_user_id = auth.uid()
    ));

-- 4. Referral Codes
DROP POLICY IF EXISTS "Merchants can manage own referral codes" ON referral_codes;
CREATE POLICY "Merchants can manage own referral codes" ON referral_codes
    FOR ALL
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE supabase_user_id = auth.uid()
    ));

-- 5. Referral Clicks
-- Note: Clicks are often public inserts, but for Merchant Dashboard (SELECT), they should only see their own.
-- Assuming Insert is done via Service Role usually, but if public, we might need a public insert policy.
-- For now, we restrict ALL based on merchant ownership.
DROP POLICY IF EXISTS "Merchants can see own clicks" ON referral_clicks;
CREATE POLICY "Merchants can see own clicks" ON referral_clicks
    FOR SELECT
    USING (referral_code IN (
        SELECT code FROM referral_codes WHERE merchant_id IN (
            SELECT id FROM merchants WHERE supabase_user_id = auth.uid()
        )
    ));

-- 6. Transactions
DROP POLICY IF EXISTS "Merchants can manage own transactions" ON referral_transactions;
CREATE POLICY "Merchants can manage own transactions" ON referral_transactions
    FOR ALL
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE supabase_user_id = auth.uid()
    ));

-- 7. Rewards
DROP POLICY IF EXISTS "Merchants can manage own rewards" ON rewards;
CREATE POLICY "Merchants can manage own rewards" ON rewards
    FOR ALL
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE supabase_user_id = auth.uid()
    ));

-- 8. Wallets & Points
DROP POLICY IF EXISTS "Merchants can manage own wallets" ON user_wallets;
CREATE POLICY "Merchants can manage own wallets" ON user_wallets
    FOR ALL
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE supabase_user_id = auth.uid()
    ));

DROP POLICY IF EXISTS "Merchants can manage own point balances" ON user_points;
CREATE POLICY "Merchants can manage own point balances" ON user_points
    FOR ALL
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE supabase_user_id = auth.uid()
    ));

-- 9. Fraud Flags
DROP POLICY IF EXISTS "Merchants can manage own fraud flags" ON fraud_flags;
CREATE POLICY "Merchants can manage own fraud flags" ON fraud_flags
    FOR ALL
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE supabase_user_id = auth.uid()
    ));
