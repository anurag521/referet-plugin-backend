-- Drop legacy columns that have been replaced by eligible_type and eligible_ids
ALTER TABLE campaigns 
DROP COLUMN IF EXISTS eligible_products,
DROP COLUMN IF EXISTS eligible_collections;
