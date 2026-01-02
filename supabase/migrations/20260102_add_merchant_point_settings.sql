-- Add Point Value Configuration to Merchants
-- Default: 1 Point = 0.01 currency unit (100 Points = 1.00)

ALTER TABLE merchants 
ADD COLUMN IF NOT EXISTS point_value NUMERIC(10, 4) DEFAULT 0.01;

ALTER TABLE merchants 
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'USD';
