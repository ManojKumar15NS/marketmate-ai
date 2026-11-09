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
