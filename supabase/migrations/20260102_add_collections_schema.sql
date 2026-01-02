-- Collection Based Eligibility Schema

-- 1. Create Collections Table
CREATE TABLE IF NOT EXISTS collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    shopify_collection_id VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    handle VARCHAR(255),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(merchant_id, shopify_collection_id)
);

-- 2. Create Product-Collections Join Table (Many-to-Many)
CREATE TABLE IF NOT EXISTS product_collections (
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, collection_id)
);

-- 3. Update Campaigns Table
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS eligible_type VARCHAR(20) DEFAULT 'product', -- 'product', 'collection', 'all'
ADD COLUMN IF NOT EXISTS eligible_ids JSONB DEFAULT '[]';
