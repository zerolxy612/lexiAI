-- Add canvasId field to pages table
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "canvas_id" TEXT;

-- Migrate data from canvas_entity_relations to pages
UPDATE "pages" p
SET "canvas_id" = cer."entity_id"
FROM "canvas_entity_relations" cer
WHERE cer."entity_id" = p."page_id" 
AND cer."entity_type" = 'page'
AND p."canvas_id" IS NULL;

-- Set a default canvas ID for pages that don't have one
-- This creates a new canvas for each page without a canvas
WITH new_canvases AS (
  INSERT INTO "canvases" ("canvas_id", "uid", "title")
  SELECT 
    'canvas_' || substr(md5(random()::text), 1, 16),
    p."uid",
    p."title" || ' Canvas'
  FROM "pages" p
  WHERE p."canvas_id" IS NULL
  RETURNING "canvas_id", "uid"
)
UPDATE "pages" p
SET "canvas_id" = nc."canvas_id"
FROM new_canvases nc
WHERE p."uid" = nc."uid"
AND p."canvas_id" IS NULL;

-- Make canvas_id NOT NULL after data migration
ALTER TABLE "pages" ALTER COLUMN "canvas_id" SET NOT NULL;

-- Add index for improved query performance
CREATE INDEX IF NOT EXISTS "pages_canvas_id_deleted_at_idx" ON "pages"("canvas_id", "deleted_at");
