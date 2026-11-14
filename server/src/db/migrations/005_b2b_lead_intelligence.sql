-- Migration 005: Advanced B2B Lead Discovery & Decision-Maker Intelligence

CREATE TABLE IF NOT EXISTS b2b_companies (
  id VARCHAR(128) PRIMARY KEY,
  search_id VARCHAR(128) NOT NULL,
  business_name TEXT NOT NULL,
  brand_name TEXT,
  is_branch BOOLEAN NOT NULL DEFAULT false,
  branch_name TEXT,
  industry TEXT,
  category TEXT,
  address TEXT,
  locality TEXT,
  city TEXT NOT NULL,
  state TEXT,
  country TEXT NOT NULL DEFAULT 'India',
  website TEXT,
  google_profile_url TEXT,
  linkedin_url TEXT,
  rating TEXT,
  review_count INTEGER DEFAULT 0,
  operating_hours TEXT,
  company_fit_score INTEGER DEFAULT 0,
  contact_quality_score INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0,
  phones JSONB NOT NULL DEFAULT '[]',
  verification_status VARCHAR(32) NOT NULL DEFAULT 'unverified',
  source_urls JSONB NOT NULL DEFAULT '[]',
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_b2b_companies_search ON b2b_companies(search_id);
CREATE INDEX IF NOT EXISTS idx_b2b_companies_city ON b2b_companies(city, locality);
CREATE INDEX IF NOT EXISTS idx_b2b_companies_name ON b2b_companies(business_name);

CREATE TABLE IF NOT EXISTS b2b_decision_makers (
  id VARCHAR(128) PRIMARY KEY,
  company_id VARCHAR(128) NOT NULL,
  search_id VARCHAR(128) NOT NULL,
  name TEXT NOT NULL,
  designation TEXT NOT NULL,
  role_category VARCHAR(64) NOT NULL DEFAULT 'other',
  company_name TEXT NOT NULL,
  branch_location TEXT,
  linkedin_url TEXT,
  email TEXT,
  phone TEXT,
  phone_line_type VARCHAR(32) DEFAULT 'unknown',
  whatsapp_status VARCHAR(64) DEFAULT 'unverified',
  employment_status VARCHAR(32) NOT NULL DEFAULT 'unverified',
  confidence_score INTEGER DEFAULT 0,
  source_evidence TEXT,
  source_urls JSONB NOT NULL DEFAULT '[]',
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_b2b_dm_company ON b2b_decision_makers(company_id);
CREATE INDEX IF NOT EXISTS idx_b2b_dm_search ON b2b_decision_makers(search_id);
CREATE INDEX IF NOT EXISTS idx_b2b_dm_role ON b2b_decision_makers(role_category);
