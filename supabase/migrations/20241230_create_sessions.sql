-- Create sessions table for Shopify Token Storage
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(255) PRIMARY KEY,
  shop VARCHAR(255) NOT NULL,
  state VARCHAR(255) NOT NULL,
  is_online BOOLEAN DEFAULT FALSE,
  scope VARCHAR(255),
  expires INTEGER,
  online_access_info JSONB,
  content JSONB -- Full JSON content of the session
);

CREATE INDEX IF NOT EXISTS idx_sessions_shop ON sessions(shop);

-- Enable Row Level Security
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Create Policy: Merchants can only access sessions where the shop matches their merchant record
-- Note: This requires the user to be authenticated via Supabase Auth and have a matching record in 'merchants'.
-- Backend 'Service Role' bypasses this.
CREATE POLICY "Merchants can manage own sessions" 
ON sessions 
FOR ALL 
USING (
  shop IN (
    SELECT shop_domain 
    FROM merchants 
    WHERE supabase_user_id = auth.uid()
  )
);
