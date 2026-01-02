-- Add shopify_customer_id column
ALTER TABLE referrers ADD COLUMN IF NOT EXISTS shopify_customer_id TEXT;

-- Make email and name nullable (optional)
ALTER TABLE referrers ALTER COLUMN email DROP NOT NULL;
ALTER TABLE referrers ALTER COLUMN name DROP NOT NULL;

-- Add unique constraint for shopify_customer_id per merchant
-- (Drop existing if exists to be safe, though "IF NOT EXISTS" for constraint is specific syntax)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referrers_merchant_customer_id_key') THEN
        ALTER TABLE referrers ADD CONSTRAINT referrers_merchant_customer_id_key UNIQUE (merchant_id, shopify_customer_id);
    END IF;
END $$;
