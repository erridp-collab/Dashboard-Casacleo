-- Add missing created_at column to action_checklist.
-- The API route orders by created_at; this column was never included in the initial schema.
ALTER TABLE public.action_checklist
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now() NOT NULL;
