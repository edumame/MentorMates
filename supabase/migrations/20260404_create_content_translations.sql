-- Content translations cache
-- Phase 4 of the multi-language support rollout (#659)
--
-- Stores AI-generated translations of long-form user content (event
-- descriptions, project descriptions, FAQ answers). Keyed by a hash of
-- the source text so cache invalidation is automatic when the source
-- edits (new hash → cache miss → new translation).

CREATE TABLE IF NOT EXISTS content_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_hash TEXT NOT NULL,           -- sha256 of the source text
  source_lang TEXT,                    -- ISO locale code, nullable if auto-detected
  target_lang TEXT NOT NULL,           -- ISO locale code (e.g. "zh", "es")
  translated_text TEXT NOT NULL,
  model TEXT NOT NULL,                 -- e.g. "gpt-4o-mini"
  token_count INTEGER,                 -- optional usage tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_hash, target_lang)
);

CREATE INDEX IF NOT EXISTS idx_content_translations_lookup
  ON content_translations(source_hash, target_lang);

-- RLS on with no client policies: cached rows may contain private content,
-- so only the service role (used by /api/translate) can read or write them.
-- Folded in from 202610120001_secure_translation_cache.sql so a fresh
-- database never has a window with a broad authenticated SELECT policy.
ALTER TABLE content_translations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON content_translations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON content_translations TO service_role;

COMMENT ON TABLE content_translations IS 'Cache of AI-generated translations keyed by source text hash.';
