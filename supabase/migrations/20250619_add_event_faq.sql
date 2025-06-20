-- Add faq column to events table
ALTER TABLE events
ADD COLUMN faq TEXT;

-- Add comment to explain the structure
COMMENT ON COLUMN events.faq IS 'Markdown text containing frequently asked questions and answers for the event'; 