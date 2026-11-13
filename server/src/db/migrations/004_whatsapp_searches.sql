-- Migration 004: Dedicated WhatsApp Business Lead Searches Registry

CREATE TABLE IF NOT EXISTS whatsapp_searches (
  id VARCHAR(128) PRIMARY KEY,
  keywords TEXT NOT NULL,
  location TEXT NOT NULL,
  country_code VARCHAR(32) NOT NULL DEFAULT '+91',
  total_found INTEGER NOT NULL DEFAULT 0,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_searches_created ON whatsapp_searches(created_at DESC);
