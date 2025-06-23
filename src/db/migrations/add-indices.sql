-- Add indices for better query performance

-- Churches table indices
CREATE INDEX IF NOT EXISTS idx_churches_status ON churches(status);
CREATE INDEX IF NOT EXISTS idx_churches_county_id ON churches(county_id);
CREATE INDEX IF NOT EXISTS idx_churches_last_updated ON churches(last_updated);
CREATE INDEX IF NOT EXISTS idx_churches_status_last_updated ON churches(status, last_updated);

-- Church affiliations indices
CREATE INDEX IF NOT EXISTS idx_church_affiliations_church_id ON church_affiliations(church_id);
CREATE INDEX IF NOT EXISTS idx_church_affiliations_affiliation_id ON church_affiliations(affiliation_id);

-- Sessions table index
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Church gatherings index
CREATE INDEX IF NOT EXISTS idx_church_gatherings_church_id ON church_gatherings(church_id);