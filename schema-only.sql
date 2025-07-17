CREATE TABLE counties (
CREATE TABLE affiliations (
CREATE TABLE churches (
CREATE TABLE church_gatherings (
CREATE TABLE pages (
CREATE TABLE settings (
CREATE TABLE church_suggestions (
CREATE TABLE comments (
CREATE TABLE users (
CREATE TABLE sessions (
CREATE TABLE accounts (
CREATE TABLE verification_tokens (
CREATE TABLE verification (
CREATE TABLE IF NOT EXISTS "church_affiliations" (church_id INTEGER NOT NULL, affiliation_id INTEGER NOT NULL, PRIMARY KEY (church_id, affiliation_id), FOREIGN KEY (church_id) REFERENCES churches(id), FOREIGN KEY (affiliation_id) REFERENCES affiliations(id));
CREATE TABLE `church_images` (
CREATE TABLE `images` (
CREATE TABLE `church_images_new` (
CREATE TABLE `county_images` (
CREATE TABLE `affiliation_images` (
CREATE TABLE `site_images` (
CREATE INDEX idx_churches_status ON churches(status);;
CREATE INDEX idx_churches_county_id ON churches(county_id);;
CREATE INDEX idx_churches_language ON churches(language);;
CREATE INDEX idx_church_gatherings_church_id ON church_gatherings(church_id);;
CREATE INDEX idx_comments_church_id ON comments(church_id);;
CREATE INDEX idx_sessions_user_id ON sessions(user_id);;
CREATE INDEX idx_accounts_user_id ON accounts(user_id);;
CREATE UNIQUE INDEX `idx_church_images_new_unique` ON `church_images_new` (`church_id`, `image_id`);;
CREATE UNIQUE INDEX `idx_county_images_unique` ON `county_images` (`county_id`, `image_id`);;
CREATE UNIQUE INDEX `idx_affiliation_images_unique` ON `affiliation_images` (`affiliation_id`, `image_id`);;
CREATE UNIQUE INDEX `idx_site_images_unique` ON `site_images` (`location`, `image_id`);;
