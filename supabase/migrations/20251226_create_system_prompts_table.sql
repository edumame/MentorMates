-- Create system_prompts table for storing system prompts as text
CREATE TABLE IF NOT EXISTS system_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(255) NOT NULL UNIQUE,
  prompt_text TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by agent_id
CREATE INDEX IF NOT EXISTS idx_system_prompts_agent_id ON system_prompts(agent_id);

-- Index for active prompts
CREATE INDEX IF NOT EXISTS idx_system_prompts_active ON system_prompts(is_active) WHERE is_active = true;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_system_prompts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on row updates
CREATE TRIGGER update_system_prompts_updated_at
  BEFORE UPDATE ON system_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_system_prompts_updated_at();

-- RLS policies
ALTER TABLE system_prompts ENABLE ROW LEVEL SECURITY;

-- Only admins can view system prompts
CREATE POLICY "Only admins can view system prompts"
  ON system_prompts
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user((SELECT auth.uid())));

-- Only admins can insert system prompts
CREATE POLICY "Only admins can insert system prompts"
  ON system_prompts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user((SELECT auth.uid())));

-- Only admins can update system prompts
CREATE POLICY "Only admins can update system prompts"
  ON system_prompts
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_user((SELECT auth.uid())))
  WITH CHECK (public.is_admin_user((SELECT auth.uid())));

-- Only admins can delete system prompts
CREATE POLICY "Only admins can delete system prompts"
  ON system_prompts
  FOR DELETE
  TO authenticated
  USING (public.is_admin_user((SELECT auth.uid())));

-- Add comments describing the table and columns
COMMENT ON TABLE system_prompts IS 'Stores system prompts used throughout the application. Each prompt has a unique agent_id identifier and text content.';
COMMENT ON COLUMN system_prompts.agent_id IS 'Unique identifier/name for the system prompt (e.g., "project_feedback", "event_notification")';
COMMENT ON COLUMN system_prompts.prompt_text IS 'The actual prompt text content';
COMMENT ON COLUMN system_prompts.description IS 'Optional description explaining the purpose and usage of this prompt';
COMMENT ON COLUMN system_prompts.is_active IS 'Whether this prompt is currently active. Inactive prompts can be kept for historical purposes.';

