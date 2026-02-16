-- Migration: Add session_id support to mcp_write_audit table
-- This allows audit logging for both token-based and session-based writes

-- Make token_id nullable (was previously NOT NULL)
-- SQLite doesn't support ALTER COLUMN, so we need to recreate the table

-- Create new table with updated schema
CREATE TABLE mcp_write_audit_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  token_id INTEGER, -- Now nullable
  session_id TEXT, -- New column for session-based writes
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  record_id INTEGER NOT NULL,
  diff TEXT,
  created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (token_id) REFERENCES mcp_tokens(id)
);

-- Copy existing data
INSERT INTO mcp_write_audit_new (id, user_id, token_id, session_id, action, entity, record_id, diff, created_at)
SELECT id, user_id, token_id, NULL, action, entity, record_id, diff, created_at
FROM mcp_write_audit;

-- Drop old table
DROP TABLE mcp_write_audit;

-- Rename new table
ALTER TABLE mcp_write_audit_new RENAME TO mcp_write_audit;

-- Recreate indexes
CREATE INDEX idx_mcp_write_audit_token_id ON mcp_write_audit(token_id);
CREATE INDEX idx_mcp_write_audit_session_id ON mcp_write_audit(session_id);
CREATE INDEX idx_mcp_write_audit_entity_record ON mcp_write_audit(entity, record_id);
CREATE INDEX idx_mcp_write_audit_created_at ON mcp_write_audit(created_at);
