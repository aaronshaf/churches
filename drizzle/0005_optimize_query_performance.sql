-- Optimize query performance with additional indexes
-- This migration adds indexes to improve performance for common query patterns

-- Add composite index for church affiliations lookup by affiliation
-- This optimizes queries that find all churches for a specific affiliation
CREATE INDEX IF NOT EXISTS idx_church_affiliations_affiliation_church 
  ON church_affiliations(affiliation_id, church_id);

-- Add composite index for churches with gathering times
-- This optimizes queries that join churches with their gathering times
CREATE INDEX IF NOT EXISTS idx_church_gatherings_church_time 
  ON church_gatherings(church_id, time);

-- Add index for church images lookup
CREATE INDEX IF NOT EXISTS idx_church_images_church_id 
  ON church_images(church_id);

-- Add index for church images display order
CREATE INDEX IF NOT EXISTS idx_church_images_church_order 
  ON church_images(church_id, display_order);

-- Add index for comments by church
CREATE INDEX IF NOT EXISTS idx_comments_church_id 
  ON comments(church_id);

-- Add index for comments by status for moderation
CREATE INDEX IF NOT EXISTS idx_comments_status 
  ON comments(status);

-- Add composite index for comments moderation queue
CREATE INDEX IF NOT EXISTS idx_comments_status_created 
  ON comments(status, created_at DESC);

-- Add index for church suggestions by status
CREATE INDEX IF NOT EXISTS idx_church_suggestions_status 
  ON church_suggestions(status);

-- Add composite index for church suggestions moderation queue
CREATE INDEX IF NOT EXISTS idx_church_suggestions_status_created 
  ON church_suggestions(status, created_at DESC);

-- Add index for pages by path for quick lookup
CREATE INDEX IF NOT EXISTS idx_pages_path 
  ON pages(path);

-- Add composite index for navbar pages ordering
CREATE INDEX IF NOT EXISTS idx_pages_navbar_order 
  ON pages(navbar_order)
  WHERE navbar_order IS NOT NULL;

-- Add index for settings by key for quick lookup
CREATE INDEX IF NOT EXISTS idx_settings_key 
  ON settings(key);

-- Activity logs indexes removed - table does not exist yet

-- Better-auth tables indexes (if not already created by better-auth)
CREATE INDEX IF NOT EXISTS idx_accounts_user_id 
  ON accounts(user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id_auth 
  ON sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at_auth 
  ON sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_verification_tokens_identifier_token 
  ON verification_tokens(identifier, token);

-- Add index for users by role for permission checks
CREATE INDEX IF NOT EXISTS idx_users_role 
  ON users(role);

-- Note: These indexes are designed to optimize common query patterns:
-- 1. Finding all churches for an affiliation (networks page)
-- 2. Loading church details with gatherings, images, and comments
-- 3. Moderation queues for comments and suggestions
-- 4. Activity log queries
-- 5. Settings and page lookups
-- 6. Authentication and session management