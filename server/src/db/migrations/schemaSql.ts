export const INITIAL_SCHEMA_SQL = `
-- ==============================================================================
-- MarketMate AI PostgreSQL Production Schema Migration (001_initial_schema.sql)
-- Designed for Neon PostgreSQL & Cloud Deployments
-- ==============================================================================

-- 1. Schema Migrations Tracking
CREATE TABLE IF NOT EXISTS _migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Background Jobs Execution Table
CREATE TABLE IF NOT EXISTS jobs (
  job_id VARCHAR(128) PRIMARY KEY,
  agent_id VARCHAR(64) NOT NULL,
  company_id VARCHAR(128),
  research_id VARCHAR(128),
  status VARCHAR(32) NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  current_stage TEXT,
  input JSONB NOT NULL,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_agent ON jobs(agent_id);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

-- 3. Agent Cache Table (For Grounded Scraping & Multi-Agent Isolation)
CREATE TABLE IF NOT EXISTS agent_cache (
  cache_key VARCHAR(512) PRIMARY KEY,
  agent_id VARCHAR(64) NOT NULL,
  data JSONB NOT NULL,
  expires_at BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_cache_agent ON agent_cache(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_cache_expires ON agent_cache(expires_at);

-- 4. Target Company Profiles
CREATE TABLE IF NOT EXISTS company_profiles (
  id VARCHAR(128) PRIMARY KEY,
  domain VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  industry TEXT,
  business_model TEXT,
  data JSONB NOT NULL,
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_company_profiles_domain ON company_profiles(domain);

-- 5. Autonomous Research Sessions (6-Stage Pipeline)
CREATE TABLE IF NOT EXISTS research_sessions (
  id VARCHAR(128) PRIMARY KEY,
  company_id VARCHAR(128) NOT NULL,
  target_url TEXT NOT NULL,
  current_step INTEGER NOT NULL DEFAULT 1,
  max_completed_step INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'idle',
  step_progress JSONB NOT NULL DEFAULT '[]',
  profile JSONB,
  competitors JSONB,
  campaigns JSONB,
  leads JSONB,
  stats JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_research_sessions_company ON research_sessions(company_id);

-- 6. Verified Competitors
CREATE TABLE IF NOT EXISTS competitors (
  id VARCHAR(128) PRIMARY KEY,
  company_id VARCHAR(128) NOT NULL,
  research_id VARCHAR(128),
  name VARCHAR(255) NOT NULL,
  website TEXT NOT NULL,
  category VARCHAR(64) NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_competitors_company ON competitors(company_id);
CREATE INDEX IF NOT EXISTS idx_competitors_research ON competitors(research_id);

-- 7. Target Campaigns & Intent Keyword Groups
CREATE TABLE IF NOT EXISTS campaigns (
  id VARCHAR(128) PRIMARY KEY,
  company_id VARCHAR(128) NOT NULL,
  research_id VARCHAR(128),
  title VARCHAR(255) NOT NULL,
  target_industry VARCHAR(255),
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_campaigns_company ON campaigns(company_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_research ON campaigns(research_id);

-- 8. Discovered Target Accounts & Leads
CREATE TABLE IF NOT EXISTS leads (
  id VARCHAR(128) PRIMARY KEY,
  company_id VARCHAR(128) NOT NULL,
  research_id VARCHAR(128),
  company_name VARCHAR(255) NOT NULL,
  website TEXT,
  industry VARCHAR(255),
  location TEXT,
  fit_score INTEGER DEFAULT 0,
  status VARCHAR(64) NOT NULL DEFAULT 'New',
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leads_company ON leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_research ON leads(research_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

-- 9. Email & LinkedIn Decision-Maker Search Runs
CREATE TABLE IF NOT EXISTS email_searches (
  id VARCHAR(128) PRIMARY KEY,
  mode VARCHAR(64) NOT NULL,
  target_url TEXT,
  domain VARCHAR(255),
  company_name VARCHAR(255),
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_searches_domain ON email_searches(domain);
CREATE INDEX IF NOT EXISTS idx_email_searches_created ON email_searches(created_at DESC);

-- 10. AI Chat Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id VARCHAR(128) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);

-- 11. Workflows & Agent Task Registry
CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(128) PRIMARY KEY,
  title TEXT NOT NULL,
  agent_id VARCHAR(64),
  status VARCHAR(32) NOT NULL,
  priority VARCHAR(32) DEFAULT 'medium',
  company_context TEXT,
  result TEXT,
  data JSONB NOT NULL DEFAULT '{}',
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_start_time ON tasks(start_time DESC);

-- 12. Uploaded Documents & Intelligence Storage
CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR(128) PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  file_type VARCHAR(64) NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  extracted_text TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  character_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded ON documents(uploaded_at DESC);

-- 13. System & User Settings
CREATE TABLE IF NOT EXISTS user_settings (
  key VARCHAR(128) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;


export const GTM_PLATFORM_SCHEMA_SQL = `
--
-- MarketMate AI: GTM Platform Schema Expansion (002_gtm_platform_schema.sql)
-- Users, Sessions, Job Events, Contacts, Email Results, Content, Editor, Reports
--

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(128) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(64) NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(128) REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS job_events (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(128) NOT NULL,
  stage VARCHAR(128) NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  event_type VARCHAR(64) NOT NULL DEFAULT 'info',
  message TEXT,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_job_events_job ON job_events(job_id);
CREATE INDEX IF NOT EXISTS idx_job_events_created ON job_events(created_at);

CREATE TABLE IF NOT EXISTS contacts (
  id VARCHAR(128) PRIMARY KEY,
  lead_id VARCHAR(128),
  company_id VARCHAR(128),
  name VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  department VARCHAR(128),
  location TEXT,
  linkedin_url TEXT,
  email VARCHAR(255),
  email_status VARCHAR(64) NOT NULL DEFAULT 'Unavailable',
  email_source VARCHAR(255),
  verification_status VARCHAR(64) NOT NULL DEFAULT 'Unverified',
  evidence JSONB NOT NULL DEFAULT '[]',
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contacts_lead ON contacts(lead_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_verification ON contacts(verification_status);

CREATE TABLE IF NOT EXISTS email_results (
  id VARCHAR(128) PRIMARY KEY,
  contact_id VARCHAR(128),
  lead_id VARCHAR(128),
  company_id VARCHAR(128),
  subject TEXT NOT NULL,
  subject_variations JSONB NOT NULL DEFAULT '[]',
  hook TEXT,
  pain_point TEXT,
  value_proposition TEXT,
  cta TEXT,
  body TEXT NOT NULL,
  follow_up_sequences JSONB NOT NULL DEFAULT '[]',
  is_draft BOOLEAN NOT NULL DEFAULT TRUE,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_results_contact ON email_results(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_results_company ON email_results(company_id);

CREATE TABLE IF NOT EXISTS content_items (
  id VARCHAR(128) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content_type VARCHAR(64) NOT NULL,
  topic TEXT NOT NULL,
  target_audience JSONB NOT NULL DEFAULT '{}',
  word_count_target INTEGER,
  actual_word_count INTEGER NOT NULL DEFAULT 0,
  character_count INTEGER NOT NULL DEFAULT 0,
  reading_time_minutes NUMERIC(5,2) NOT NULL DEFAULT 0,
  tone VARCHAR(64),
  language VARCHAR(64) NOT NULL DEFAULT 'en',
  reading_level VARCHAR(64),
  keywords JSONB NOT NULL DEFAULT '[]',
  cta TEXT,
  brand_voice TEXT,
  things_to_avoid TEXT,
  body TEXT NOT NULL DEFAULT '',
  status VARCHAR(64) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_content_items_type ON content_items(content_type);
CREATE INDEX IF NOT EXISTS idx_content_items_created ON content_items(created_at DESC);

CREATE TABLE IF NOT EXISTS content_versions (
  id VARCHAR(128) PRIMARY KEY,
  content_id VARCHAR(128) REFERENCES content_items(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  character_count INTEGER NOT NULL DEFAULT 0,
  reading_time_minutes NUMERIC(5,2) NOT NULL DEFAULT 0,
  change_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_content_versions_content ON content_versions(content_id);

CREATE TABLE IF NOT EXISTS editor_documents (
  id VARCHAR(128) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  html_content TEXT NOT NULL DEFAULT '',
  target_keyword VARCHAR(255),
  meta_description TEXT,
  word_count INTEGER NOT NULL DEFAULT 0,
  character_count INTEGER NOT NULL DEFAULT 0,
  reading_time_minutes NUMERIC(5,2) NOT NULL DEFAULT 0,
  flesch_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  seo_score INTEGER NOT NULL DEFAULT 0,
  analysis_breakdown JSONB NOT NULL DEFAULT '{}',
  faq_sections JSONB NOT NULL DEFAULT '[]',
  json_ld_schemas JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_editor_docs_updated ON editor_documents(updated_at DESC);

CREATE TABLE IF NOT EXISTS editor_document_versions (
  id VARCHAR(128) PRIMARY KEY,
  document_id VARCHAR(128) REFERENCES editor_documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  html_content TEXT,
  seo_score INTEGER NOT NULL DEFAULT 0,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_editor_doc_versions_doc ON editor_document_versions(document_id);

CREATE TABLE IF NOT EXISTS reports (
  id VARCHAR(128) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  report_type VARCHAR(64) NOT NULL,
  company_id VARCHAR(128),
  research_id VARCHAR(128),
  content TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reports_company ON reports(company_id);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC);

ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_data BYTEA;`;

export const CONTENT_AND_EDITOR_COLUMNS_SQL = `
ALTER TABLE content_items ALTER COLUMN current_body DROP NOT NULL;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS word_count_target INTEGER;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS actual_word_count INTEGER DEFAULT 0;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS tone VARCHAR(64);
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS language VARCHAR(64);
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS reading_level VARCHAR(64);
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS keywords JSONB DEFAULT '[]';
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS cta TEXT;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS brand_voice TEXT;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS things_to_avoid TEXT;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS status VARCHAR(64) DEFAULT 'draft';

ALTER TABLE content_versions ADD COLUMN IF NOT EXISTS reading_time_minutes NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE content_versions ADD COLUMN IF NOT EXISTS change_summary TEXT;

ALTER TABLE editor_documents ADD COLUMN IF NOT EXISTS html_content TEXT;
ALTER TABLE editor_documents ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0;
ALTER TABLE editor_documents ADD COLUMN IF NOT EXISTS character_count INTEGER DEFAULT 0;
ALTER TABLE editor_documents ADD COLUMN IF NOT EXISTS reading_time_minutes NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE editor_documents ADD COLUMN IF NOT EXISTS flesch_score NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE editor_documents ADD COLUMN IF NOT EXISTS seo_score INTEGER DEFAULT 0;
ALTER TABLE editor_documents ADD COLUMN IF NOT EXISTS analysis_breakdown JSONB DEFAULT '{}';
ALTER TABLE editor_documents ADD COLUMN IF NOT EXISTS status VARCHAR(64) DEFAULT 'draft';

ALTER TABLE editor_document_versions ADD COLUMN IF NOT EXISTS html_content TEXT;
ALTER TABLE editor_document_versions ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0;
ALTER TABLE editor_document_versions ADD COLUMN IF NOT EXISTS character_count INTEGER DEFAULT 0;
ALTER TABLE editor_document_versions ADD COLUMN IF NOT EXISTS reading_time_minutes NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE editor_document_versions ADD COLUMN IF NOT EXISTS flesch_score NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE editor_document_versions ADD COLUMN IF NOT EXISTS seo_score INTEGER DEFAULT 0;
ALTER TABLE editor_document_versions ADD COLUMN IF NOT EXISTS change_summary TEXT;
`;

