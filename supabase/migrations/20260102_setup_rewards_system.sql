-- Rewards System Schema (Unified & Improved)
-- Replaces previous definitions to align with Shopify Customer ID usage.

-- 1. DROP existing tables if they exist (to ensure clean slate)
DROP TABLE IF EXISTS user_wallets CASCADE;
DROP TABLE IF EXISTS user_points CASCADE;
DROP TABLE IF EXISTS rewards CASCADE;

-- 2. User Wallets (Store Credit / Cash)
CREATE TABLE user_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    customer_id VARCHAR(255), -- Shopify Customer ID (Primary Identifier)
    email VARCHAR(255),       -- Fallback/Display
    balance DECIMAL(10, 2) DEFAULT 0.00,
    currency VARCHAR(10) DEFAULT 'USD',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(merchant_id, customer_id)
);

-- 3. User Points (Loyalty Points)
CREATE TABLE user_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    customer_id VARCHAR(255), -- Shopify Customer ID
    email VARCHAR(255),
    balance INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(merchant_id, customer_id)
);

-- 4. Rewards Transaction Log (The Ledger)
-- This tracks every history item: "User A earned $10", "User B spent 500 points"
CREATE TABLE rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    
    -- Who
    customer_id VARCHAR(255),
    email VARCHAR(255),
    user_type VARCHAR(20) DEFAULT 'customer', -- 'referrer', 'referee'
    
    -- Source
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    transaction_id UUID REFERENCES referral_transactions(id) ON DELETE SET NULL, -- Link to the purchase
    
    -- Reward Details
    reward_type VARCHAR(50) NOT NULL, -- 'wallet', 'point', 'cashback', 'description'
    amount DECIMAL(10, 2) DEFAULT 0,  -- For wallet/cashback
    points INTEGER DEFAULT 0,         -- For points
    currency VARCHAR(10) DEFAULT 'USD',
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'paid', 'cancelled'
    
    -- Dates
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expiry_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
