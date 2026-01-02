-- Table to track successful referral claims (Link Validated by Referee)
CREATE TABLE IF NOT EXISTS referee_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    referral_code VARCHAR(50) REFERENCES referral_codes(code),
    referee_customer_id VARCHAR(255), -- Shopify Customer ID of the person claiming
    status VARCHAR(50) DEFAULT 'claimed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(merchant_id, referee_customer_id, referral_code) -- Prevent double claiming same code
);
