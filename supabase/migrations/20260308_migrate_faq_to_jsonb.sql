-- Migrate events.faq from TEXT to JSONB
-- Previously stored markdown text, now stores [{ "question": string, "answer": string }]

-- Step 1: Convert existing markdown FAQ data to JSONB array
-- Existing markdown is wrapped in a single FAQ item to preserve content
ALTER TABLE events
  ALTER COLUMN faq TYPE JSONB
  USING CASE
    WHEN faq IS NOT NULL AND faq != ''
    THEN jsonb_build_array(jsonb_build_object('question', 'FAQ', 'answer', faq))
    ELSE NULL
  END;

-- Step 2: Update column comment
COMMENT ON COLUMN events.faq IS 'JSON array of FAQ items: [{ "question": string, "answer": string }]';
