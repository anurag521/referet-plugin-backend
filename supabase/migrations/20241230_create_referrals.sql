-- 3. Referrers Table
CREATE TABLE IF NOT EXISTS referrers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    email VARCHAR(255),
    phone VARCHAR(50),
    name VARCHAR(255),
    shopify_customer_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(merchant_id, email)
);

-- 4. Referral Codes Table
CREATE TABLE IF NOT EXISTS referral_codes (
    code VARCHAR(50) PRIMARY KEY,
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    referrer_id UUID REFERENCES referrers(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    product_id VARCHAR(255),
    variant_id VARCHAR(255),
    clicks INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Referral Clicks Table
CREATE TABLE IF NOT EXISTS referral_clicks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referral_code VARCHAR(50) REFERENCES referral_codes(code) ON DELETE CASCADE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    source VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Referral Transactions (Pre-emptive)
CREATE TABLE IF NOT EXISTS referral_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    referral_code VARCHAR(50) REFERENCES referral_codes(code),
    referrer_id UUID REFERENCES referrers(id),
    order_id VARCHAR(255) NOT NULL,
    order_number VARCHAR(100),
    total_price NUMERIC(10, 2),
    currency VARCHAR(10),
    customer_email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending_validation',
    fraud_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(merchant_id, order_id)
);
