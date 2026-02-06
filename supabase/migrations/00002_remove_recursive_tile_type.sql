-- Migration: Remove "recursive" tile type
-- Converts all recursive tiles and skills to "analyzer" type,
-- then swaps the enum to remove "recursive" as a valid value.

BEGIN;

-- 1. Convert existing recursive tiles to analyzer
UPDATE tiles SET tile_type = 'analyzer' WHERE tile_type = 'recursive';

-- 2. Convert existing recursive tile skills to analyzer
UPDATE tile_skills SET tile_type = 'analyzer' WHERE tile_type = 'recursive';

-- 3. Create new enum without "recursive"
CREATE TYPE tile_type_new AS ENUM ('url_reader', 'web_search', 'analyzer');

-- 4. Alter columns to use new enum
ALTER TABLE tiles
  ALTER COLUMN tile_type TYPE tile_type_new
  USING tile_type::text::tile_type_new;

ALTER TABLE tile_skills
  ALTER COLUMN tile_type TYPE tile_type_new
  USING tile_type::text::tile_type_new;

-- 5. Drop old enum and rename new one
DROP TYPE tile_type;
ALTER TYPE tile_type_new RENAME TO tile_type;

COMMIT;
