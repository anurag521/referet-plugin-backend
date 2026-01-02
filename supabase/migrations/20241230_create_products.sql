CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    shopify_product_id VARCHAR(255) NOT NULL, -- gid://shopify/Product/123
    title VARCHAR(255) NOT NULL,
    handle VARCHAR(255),
    image_url TEXT,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'archived', 'draft'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(merchant_id, shopify_product_id)
);
