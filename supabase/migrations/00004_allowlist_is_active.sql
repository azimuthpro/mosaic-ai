-- Add is_active column to allowlist table for invite request workflow
-- Default to FALSE for new invite requests (pending approval)

ALTER TABLE public.allowlist
ADD COLUMN is_active boolean NOT NULL DEFAULT false;

-- Update existing rows to be active (they were explicitly added before this feature)
UPDATE public.allowlist SET is_active = true WHERE is_active = false;

-- Add an index for faster lookups during signup
CREATE INDEX idx_allowlist_email_active ON public.allowlist(email, is_active);
