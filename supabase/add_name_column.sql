-- Add name column to merchants table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchants' AND column_name = 'name') THEN
        ALTER TABLE merchants ADD COLUMN name VARCHAR(255);
    END IF;
END $$;
