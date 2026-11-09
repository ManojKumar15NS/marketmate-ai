-- ==============================================================================
-- MarketMate AI: Content & Editor Columns Extension (003_content_and_editor_columns.sql)
-- ==============================================================================

-- 1. Content Items Columns
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

-- 2. Content Versions Columns
ALTER TABLE content_versions ADD COLUMN IF NOT EXISTS reading_time_minutes NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE content_versions ADD COLUMN IF NOT EXISTS change_summary TEXT;

-- 3. Editor Documents Columns
ALTER TABLE editor_documents ADD COLUMN IF NOT EXISTS html_content TEXT;
ALTER TABLE editor_documents ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0;
ALTER TABLE editor_documents ADD COLUMN IF NOT EXISTS character_count INTEGER DEFAULT 0;
ALTER TABLE editor_documents ADD COLUMN IF NOT EXISTS reading_time_minutes NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE editor_documents ADD COLUMN IF NOT EXISTS flesch_score NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE editor_documents ADD COLUMN IF NOT EXISTS seo_score INTEGER DEFAULT 0;
ALTER TABLE editor_documents ADD COLUMN IF NOT EXISTS analysis_breakdown JSONB DEFAULT '{}';
ALTER TABLE editor_documents ADD COLUMN IF NOT EXISTS status VARCHAR(64) DEFAULT 'draft';

-- 4. Editor Document Versions Columns
ALTER TABLE editor_document_versions ADD COLUMN IF NOT EXISTS html_content TEXT;
ALTER TABLE editor_document_versions ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0;
ALTER TABLE editor_document_versions ADD COLUMN IF NOT EXISTS character_count INTEGER DEFAULT 0;
ALTER TABLE editor_document_versions ADD COLUMN IF NOT EXISTS reading_time_minutes NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE editor_document_versions ADD COLUMN IF NOT EXISTS flesch_score NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE editor_document_versions ADD COLUMN IF NOT EXISTS seo_score INTEGER DEFAULT 0;
ALTER TABLE editor_document_versions ADD COLUMN IF NOT EXISTS change_summary TEXT;
