-- ============================================================
-- DOCKSIDE SAAS — COMPLETE MULTI-TENANT MIGRATION
-- Run this ONCE in Supabase SQL Editor
-- This adds company_id to ALL tables and enforces data isolation
-- ============================================================

-- STEP 1: Create user_profiles table
-- Links Supabase auth users to a company
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  company_id UUID,  -- will reference company(id) after we fix company table
  full_name TEXT,
  role TEXT DEFAULT 'owner',  -- owner | manager | staff
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- STEP 2: Add company_id to company table (self-reference for SaaS)
-- Each row in company table = one business using Dockside
ALTER TABLE company ADD COLUMN IF NOT EXISTS company_id UUID;
-- Set company_id = id for existing rows (each company owns itself)
UPDATE company SET company_id = id WHERE company_id IS NULL;

-- STEP 3: Add company_id to ALL data tables
ALTER TABLE inventory    ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE yards        ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE deals        ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE shipments    ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE customers    ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE suppliers    ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE branches     ADD COLUMN IF NOT EXISTS company_id UUID;

-- STEP 4: For existing data, assign to the first company in DB
-- (Your existing data will belong to your company)
DO $$
DECLARE
  first_company_id UUID;
BEGIN
  SELECT id INTO first_company_id FROM company LIMIT 1;
  IF first_company_id IS NOT NULL THEN
    UPDATE inventory  SET company_id = first_company_id WHERE company_id IS NULL;
    UPDATE yards      SET company_id = first_company_id WHERE company_id IS NULL;
    UPDATE deals      SET company_id = first_company_id WHERE company_id IS NULL;
    UPDATE shipments  SET company_id = first_company_id WHERE company_id IS NULL;
    UPDATE customers  SET company_id = first_company_id WHERE company_id IS NULL;
    UPDATE suppliers  SET company_id = first_company_id WHERE company_id IS NULL;
    UPDATE branches   SET company_id = first_company_id WHERE company_id IS NULL;
  END IF;
END $$;

-- STEP 5: Link existing users to the first company
DO $$
DECLARE
  first_company_id UUID;
BEGIN
  SELECT id INTO first_company_id FROM company LIMIT 1;
  -- Insert profile for each auth user
  INSERT INTO user_profiles (user_id, company_id, full_name, role)
  SELECT 
    u.id,
    first_company_id,
    COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
    'owner'
  FROM auth.users u
  WHERE NOT EXISTS (
    SELECT 1 FROM user_profiles p WHERE p.user_id = u.id
  );
END $$;

-- STEP 6: Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_profiles" ON user_profiles;
CREATE POLICY "allow_all_profiles" ON user_profiles FOR ALL USING (true) WITH CHECK (true);

-- STEP 7: Reload schema cache
NOTIFY pgrst, 'reload schema';

-- STEP 8: Verify
SELECT 'user_profiles' as table_name, count(*) as rows FROM user_profiles
UNION ALL
SELECT 'company', count(*) FROM company
UNION ALL
SELECT 'inventory', count(*) FROM inventory WHERE company_id IS NOT NULL
UNION ALL
SELECT 'yards', count(*) FROM yards WHERE company_id IS NOT NULL
UNION ALL
SELECT 'deals', count(*) FROM deals WHERE company_id IS NOT NULL
UNION ALL
SELECT 'customers', count(*) FROM customers WHERE company_id IS NOT NULL
UNION ALL
SELECT 'suppliers', count(*) FROM suppliers WHERE company_id IS NOT NULL;
