-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Merchants Table
-- Stores Shopify shop details and authentication info for the Refertle Portal
CREATE TABLE IF NOT EXISTS merchants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id VARCHAR(255) UNIQUE NOT NULL, -- e.g., 'offline_1234567890' or raw shop domain logic
    shop_domain VARCHAR(255) UNIQUE NOT NULL, -- e.g., 'example.myshopify.com'
    email VARCHAR(255) UNIQUE, -- Contact email for the merchant
    phone VARCHAR(50),
    access_token_encrypted TEXT, -- Encrypted Shopify Access Token
    plan VARCHAR(50) DEFAULT 'basic',
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'uninstalled', 'suspended'
    supabase_user_id UUID, -- Link to Supabase Auth User ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Campaigns Table
-- Defines the rules for referral programs
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'scheduled', 'active', 'paused', 'completed', 'deleted'
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    
    -- Reward Configuration
    reward_type VARCHAR(50) NOT NULL, -- 'cashback', 'wallet', 'reward_points'
    who_gets_reward VARCHAR(50) NOT NULL, -- 'both', 'referrer_only', 'referee_only'
    
    -- Referrer Reward
    referrer_reward_type VARCHAR(50), -- 'fixed', 'percentage'
    referrer_reward_value NUMERIC(10, 2),
    
    -- Referee Reward
    referee_reward_type VARCHAR(50), -- 'fixed', 'percentage'
    referee_reward_value NUMERIC(10, 2),
    
    -- Conditions
    min_order_value NUMERIC(10, 2) DEFAULT 0,
    eligible_products JSONB DEFAULT '["all"]', -- List of product IDs or ["all"]
    eligible_collections JSONB DEFAULT '[]',
    usage_limit VARCHAR(50) DEFAULT 'unlimited', -- 'one_time', 'unlimited'
    
    -- Issuance & Expiry
    reward_issuance VARCHAR(50) DEFAULT 'instant', -- 'instant', 'after_days'
    reward_issuance_days INTEGER DEFAULT 0,
    reward_expiry_days INTEGER DEFAULT 365,
    return_cancellation_rule VARCHAR(50) DEFAULT 'revoke', -- 'revoke', 'keep_pending', 'manual_review'
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Referrers Table
-- Links a real human (via email/phone) to a merchant for the purpose of sharing
CREATE TABLE IF NOT EXISTS referrers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    email VARCHAR(255),
    phone VARCHAR(50),
    name VARCHAR(255),
    shopify_customer_id VARCHAR(255), -- Optional link to Shopify Customer ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(merchant_id, email) -- Unique referrer per shop by email
);

-- 4. Referral Codes Table
-- Specific codes generated for a Referrer in a Campaign
CREATE TABLE IF NOT EXISTS referral_codes (
    code VARCHAR(50) PRIMARY KEY, -- The unique referral code (e.g., 'JOH-X7D2')
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    referrer_id UUID REFERENCES referrers(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    product_id VARCHAR(255), -- Optional: if the link is specific to a product
    variant_id VARCHAR(255),
    clicks INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Referral Clicks Table
-- Tracking individual clicks for analytics
CREATE TABLE IF NOT EXISTS referral_clicks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referral_code VARCHAR(50) REFERENCES referral_codes(code) ON DELETE CASCADE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    source VARCHAR(50), -- 'whatsapp', 'facebook', 'email', 'direct'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Referral Transactions Table
-- Records a successful purchase attributed to a referral
CREATE TABLE IF NOT EXISTS referral_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    referral_code VARCHAR(50) REFERENCES referral_codes(code),
    referrer_id UUID REFERENCES referrers(id),
    
    -- Order Details
    order_id VARCHAR(255) NOT NULL, -- Shopify Order ID
    order_number VARCHAR(100),
    total_price NUMERIC(10, 2),
    currency VARCHAR(10),
    customer_email VARCHAR(255), -- The Referee's email
    
    status VARCHAR(50) DEFAULT 'pending_validation', -- 'pending_validation', 'approved', 'rejected', 'fraud_suspected'
    fraud_reason TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(merchant_id, order_id) -- One transaction per order
);

-- 7. Rewards Table
-- The actual payout/benefit to be given
CREATE TABLE IF NOT EXISTS rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES referral_transactions(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    
    user_email VARCHAR(255) NOT NULL,
    user_type VARCHAR(20) NOT NULL, -- 'referrer', 'referee'
    
    reward_type VARCHAR(50) NOT NULL, -- 'wallet', 'reward_points', 'coupon', 'cashback'
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    point_value INTEGER, -- If reward_type is points
    
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'issued', 'redeemed', 'expired', 'revoked'
    
    discount_code VARCHAR(100), -- If issued as a coupon
    shopify_price_rule_id VARCHAR(255),
    
    approval_date TIMESTAMP WITH TIME ZONE,
    expiry_date TIMESTAMP WITH TIME ZONE,
    issued_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. User Wallets Table
-- Holds currency balance for users
CREATE TABLE IF NOT EXISTS user_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    user_email VARCHAR(255) NOT NULL,
    balance NUMERIC(10, 2) DEFAULT 0.00,
    currency VARCHAR(10) DEFAULT 'INR',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(merchant_id, user_email)
);

-- 9. User Points Table
-- Holds point balance for users
CREATE TABLE IF NOT EXISTS user_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    user_email VARCHAR(255) NOT NULL,
    balance INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(merchant_id, user_email)
);

-- 10. Fraud Flags Table
-- Tracks suspicious activities
CREATE TABLE IF NOT EXISTS fraud_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    referral_code VARCHAR(50),
    actor_email VARCHAR(255), -- Who did it
    reason VARCHAR(255), -- 'self_referral', 'high_velocity'
    severity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    metadata JSONB, -- Store IP, UA etc
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
