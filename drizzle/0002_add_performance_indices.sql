-- Add performance indices for frequently queried columns

-- Churches table indices
CREATE INDEX IF NOT EXISTS idx_churches_county_id ON churches(county_id);
CREATE INDEX IF NOT EXISTS idx_churches_status ON churches(status);
CREATE INDEX IF NOT EXISTS idx_churches_name ON churches(name);
-- Note: path already has a unique constraint which creates an index

-- Composite index for common query pattern (churches by county excluding heretical)
CREATE INDEX IF NOT EXISTS idx_churches_county_status ON churches(county_id, status);

-- Church affiliations junction table indices
CREATE INDEX IF NOT EXISTS idx_church_affiliations_church_id ON church_affiliations(church_id);
CREATE INDEX IF NOT EXISTS idx_church_affiliations_affiliation_id ON church_affiliations(affiliation_id);
CREATE INDEX IF NOT EXISTS idx_church_affiliations_church_order ON church_affiliations(church_id, "order");

-- Counties table indices
-- Note: name and path already have unique constraints which create indices

-- Affiliations table indices
CREATE INDEX IF NOT EXISTS idx_affiliations_status ON affiliations(status);
-- Note: name already has a unique constraint which creates an index

-- Users table indices
-- Note: email and username already have unique constraints which create indices
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);

-- Sessions table indices
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Church gatherings table indices
CREATE INDEX IF NOT EXISTS idx_church_gatherings_church_id ON church_gatherings(church_id);