-- Add display_format column to tiles table for controlling how job results are rendered
ALTER TABLE public.tiles
ADD COLUMN display_format text NOT NULL DEFAULT 'markdown'
CHECK (display_format IN ('markdown', 'code'));

-- Add comment explaining the column
COMMENT ON COLUMN public.tiles.display_format IS 'Controls how job results are displayed: markdown (rendered) or code (raw JSON/text)';
