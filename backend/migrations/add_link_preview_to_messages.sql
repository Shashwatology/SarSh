-- Migration to add link_preview column to Messages table
ALTER TABLE Messages ADD COLUMN IF NOT EXISTS link_preview JSONB;
