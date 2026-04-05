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

-- RLS: only authenticated users can read; inserts happen via service role from the API
ALTER TABLE content_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read translations"
  ON content_translations FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE content_translations IS 'Cache of AI-generated translations keyed by source text hash.';
