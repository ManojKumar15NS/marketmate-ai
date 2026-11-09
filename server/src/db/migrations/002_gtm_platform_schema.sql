-- ==============================================================================
-- MarketMate AI: GTM Platform Schema Extension (002_gtm_platform_schema.sql)
-- Complete schema for AI GTM Platform, Content Creator, SEO Editor, and Auth
-- ==============================================================================

-- 1. Users and User Sessions
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(128) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT,
  role VARCHAR(64) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(128) REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- 2. Job Event Auditing (For Granular Stage Progress & Worker Transitions)
CREATE TABLE IF NOT EXISTS job_events (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(128) NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  event_type VARCHAR(64) NOT NULL,
  stage TEXT,
  progress INTEGER,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_job_events_job ON job_events(job_id);
CREATE INDEX IF NOT EXISTS idx_job_events_created ON job_events(created_at DESC);

-- 3. Dedicated Target Companies Table
CREATE TABLE IF NOT EXISTS target_companies (
  id VARCHAR(128) PRIMARY KEY,
  company_id VARCHAR(128),
  research_id VARCHAR(128),
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  website TEXT,
  industry VARCHAR(255),
  location TEXT,
  fit_score INTEGER DEFAULT 0,
  fit_reasons JSONB NOT NULL DEFAULT '[]',
  evidence_urls JSONB NOT NULL DEFAULT '[]',
  source VARCHAR(64) DEFAULT 'live_search',
  status VARCHAR(64) DEFAULT 'New',
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_target_companies_domain ON target_companies(domain);
CREATE INDEX IF NOT EXISTS idx_target_companies_research ON target_companies(research_id);

-- 4. Dedicated Decision-Maker Contacts Table
CREATE TABLE IF NOT EXISTS contacts (
  id VARCHAR(128) PRIMARY KEY,
  target_company_id VARCHAR(128),
  company_name VARCHAR(255) NOT NULL,
  company_domain VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  department VARCHAR(128),
  location TEXT,
  linkedin_url TEXT,
  linkedin_verified BOOLEAN DEFAULT FALSE,
  verification_status VARCHAR(64) DEFAULT 'unverified',
  raw_headline TEXT,
  source_url TEXT,
  retrieval_timestamp TIMESTAMPTZ DEFAULT NOW(),
  email VARCHAR(255),
  email_status VARCHAR(64) DEFAULT 'not_found',
  email_provenance VARCHAR(64),
  email_confidence INTEGER DEFAULT 0,
  outreach_draft JSONB,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(target_company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_domain ON contacts(company_domain);
CREATE INDEX IF NOT EXISTS idx_contacts_linkedin ON contacts(linkedin_url);

-- 5. Content Creator Items & Version History
CREATE TABLE IF NOT EXISTS content_items (
  id VARCHAR(128) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content_type VARCHAR(64) NOT NULL,
  topic TEXT NOT NULL,
  current_body TEXT NOT NULL,
  target_audience JSONB NOT NULL DEFAULT '{}',
  options JSONB NOT NULL DEFAULT '[]',
  word_count INTEGER NOT NULL DEFAULT 0,
  character_count INTEGER NOT NULL DEFAULT 0,
  reading_time_minutes NUMERIC(5, 2) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_content_items_created ON content_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_items_type ON content_items(content_type);

CREATE TABLE IF NOT EXISTS content_versions (
  id VARCHAR(128) PRIMARY KEY,
  content_id VARCHAR(128) NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  character_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_content_versions_content ON content_versions(content_id);

-- 6. SEO Content Editor Documents & Version History
CREATE TABLE IF NOT EXISTS editor_documents (
  id VARCHAR(128) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  target_keyword VARCHAR(255),
  meta_description TEXT,
  overall_score INTEGER NOT NULL DEFAULT 0,
  analysis JSONB NOT NULL DEFAULT '{}',
  suggestions JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_editor_docs_updated ON editor_documents(updated_at DESC);

CREATE TABLE IF NOT EXISTS editor_document_versions (
  id VARCHAR(128) PRIMARY KEY,
  document_id VARCHAR(128) NOT NULL REFERENCES editor_documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  target_keyword VARCHAR(255),
  meta_description TEXT,
  overall_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_editor_doc_versions_doc ON editor_document_versions(document_id);

-- 7. Document Intelligence Reports
CREATE TABLE IF NOT EXISTS reports (
  id VARCHAR(128) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  report_type VARCHAR(64) NOT NULL,
  company_id VARCHAR(128),
  data JSONB NOT NULL,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_company ON reports(company_id);

-- 8. Document File Storage (Base64 file data for DB persistence without local filesystem reliance)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_data TEXT;
