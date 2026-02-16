import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const churches = sqliteTable(
  'churches',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    path: text('path').unique(),
    status: text('status', {
      enum: ['Listed', 'Ready to list', 'Assess', 'Needs data', 'Unlisted', 'Heretical', 'Closed'],
    }),
    privateNotes: text('private_notes'),
    publicNotes: text('public_notes'),
    lastUpdated: integer('last_updated', { mode: 'timestamp' }),
    gatheringAddress: text('gathering_address'),
    mailingAddress: text('mailing_address'),
    latitude: real('latitude'),
    longitude: real('longitude'),
    countyId: integer('county_id').references(() => counties.id),
    website: text('website'),
    statementOfFaith: text('statement_of_faith'),
    phone: text('phone'),
    email: text('email'),
    facebook: text('facebook'),
    instagram: text('instagram'),
    youtube: text('youtube'),
    spotify: text('spotify'),
    language: text('language').notNull().default('English'),
    imagePath: text('image_path'), // R2 field
    imageAlt: text('image_alt'), // R2 field
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (table) => ({
    churchesDeletedAtIdx: index('idx_churches_deleted_at').on(table.deletedAt),
  })
);

export const counties = sqliteTable(
  'counties',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull().unique(),
    path: text('path').unique(),
    description: text('description'),
    population: integer('population'),
    imagePath: text('image_path'), // New R2 field
    imageAlt: text('image_alt'), // New R2 field
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (table) => ({
    countiesDeletedAtIdx: index('idx_counties_deleted_at').on(table.deletedAt),
  })
);

export const affiliations = sqliteTable(
  'affiliations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull().unique(),
    path: text('path').unique(),
    status: text('status', { enum: ['Listed', 'Unlisted', 'Heretical'] }).default('Listed'),
    website: text('website'),
    privateNotes: text('private_notes'),
    publicNotes: text('public_notes'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (table) => ({
    affiliationsDeletedAtIdx: index('idx_affiliations_deleted_at').on(table.deletedAt),
  })
);

export const churchAffiliations = sqliteTable(
  'church_affiliations',
  {
    churchId: integer('church_id')
      .notNull()
      .references(() => churches.id),
    affiliationId: integer('affiliation_id')
      .notNull()
      .references(() => affiliations.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.churchId, table.affiliationId] }),
  })
);

// Legacy tables - no longer used, authentication is handled by better-auth
// Keeping definitions for migration purposes only
/*
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  userType: text('user_type', { enum: ['admin', 'contributor'] })
    .notNull()
    .default('contributor'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(), // UUID
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});
*/

export const churchGatherings = sqliteTable('church_gatherings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  churchId: integer('church_id')
    .notNull()
    .references(() => churches.id),
  time: text('time').notNull(),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const churchImages = sqliteTable('church_images', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  churchId: integer('church_id')
    .notNull()
    .references(() => churches.id),
  imagePath: text('image_path').notNull(), // R2 path
  imageAlt: text('image_alt'),
  caption: text('caption'),
  isFeatured: integer('is_featured', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const pages = sqliteTable('pages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  path: text('path').notNull().unique(),
  content: text('content'),
  featuredImagePath: text('featured_image_path'), // R2 field
  featuredImageAlt: text('featured_image_alt'), // R2 field
  navbarOrder: integer('navbar_order'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  value: text('value'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const churchSuggestions = sqliteTable('church_suggestions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(),
  churchName: text('church_name').notNull(),
  denomination: text('denomination'),
  address: text('address'),
  city: text('city'),
  state: text('state').default('UT'),
  zip: text('zip'),
  website: text('website'),
  phone: text('phone'),
  email: text('email'),
  serviceTimes: text('service_times'),
  statementOfFaith: text('statement_of_faith'),
  facebook: text('facebook'),
  instagram: text('instagram'),
  youtube: text('youtube'),
  spotify: text('spotify'),
  notes: text('notes'),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] })
    .notNull()
    .default('pending'),
  reviewedBy: text('reviewed_by'),
  reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const comments = sqliteTable('comments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(),
  churchId: integer('church_id').references(() => churches.id),
  content: text('content').notNull(),
  type: text('type', { enum: ['user', 'system'] })
    .notNull()
    .default('user'),
  metadata: text('metadata'), // JSON string for storing change details
  isPublic: integer('is_public', { mode: 'boolean' }).default(false),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] })
    .notNull()
    .default('pending'),
  reviewedBy: text('reviewed_by'),
  reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Image metadata table
export const images = sqliteTable('images', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  filename: text('filename').notNull(),
  originalFilename: text('original_filename'),
  mimeType: text('mime_type').notNull(),
  fileSize: integer('file_size').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  blurhash: text('blurhash').notNull(),
  altText: text('alt_text'),
  caption: text('caption'),
  uploadedBy: text('uploaded_by'), // User ID from better-auth
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

// New church images junction table (will replace existing churchImages)
export const churchImagesNew = sqliteTable(
  'church_images_new',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    churchId: integer('church_id')
      .notNull()
      .references(() => churches.id, { onDelete: 'cascade' }),
    imageId: integer('image_id')
      .notNull()
      .references(() => images.id, { onDelete: 'cascade' }),
    displayOrder: integer('display_order').notNull().default(0),
    isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    uniqueChurchImage: primaryKey({ columns: [table.churchId, table.imageId] }),
  })
);

// County images junction table
export const countyImages = sqliteTable(
  'county_images',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    countyId: integer('county_id')
      .notNull()
      .references(() => counties.id, { onDelete: 'cascade' }),
    imageId: integer('image_id')
      .notNull()
      .references(() => images.id, { onDelete: 'cascade' }),
    displayOrder: integer('display_order').notNull().default(0),
    isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    uniqueCountyImage: primaryKey({ columns: [table.countyId, table.imageId] }),
  })
);

// Affiliation images junction table
export const affiliationImages = sqliteTable(
  'affiliation_images',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    affiliationId: integer('affiliation_id')
      .notNull()
      .references(() => affiliations.id, { onDelete: 'cascade' }),
    imageId: integer('image_id')
      .notNull()
      .references(() => images.id, { onDelete: 'cascade' }),
    displayOrder: integer('display_order').notNull().default(0),
    isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    uniqueAffiliationImage: primaryKey({ columns: [table.affiliationId, table.imageId] }),
  })
);

// Site images table
export const siteImages = sqliteTable('site_images', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  imageId: integer('image_id')
    .notNull()
    .references(() => images.id, { onDelete: 'cascade' }),
  location: text('location').notNull(), // 'homepage_hero', 'about_banner', etc.
  displayOrder: integer('display_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const mcpTokens = sqliteTable(
  'mcp_tokens',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id').notNull(),
    tokenName: text('token_name').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    scope: text('scope').notNull().default('broad'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
    lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
    revokedAt: integer('revoked_at', { mode: 'timestamp' }),
  },
  (table) => ({
    mcpTokensUserIdIdx: index('idx_mcp_tokens_user_id').on(table.userId),
    mcpTokensRevokedAtIdx: index('idx_mcp_tokens_revoked_at').on(table.revokedAt),
  })
);

export const mcpWriteAudit = sqliteTable(
  'mcp_write_audit',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id').notNull(),
    tokenId: integer('token_id').references(() => mcpTokens.id), // Nullable for session-based writes
    sessionId: text('session_id'), // Nullable for token-based writes
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    recordId: integer('record_id').notNull(),
    diff: text('diff'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    mcpWriteAuditTokenIdIdx: index('idx_mcp_write_audit_token_id').on(table.tokenId),
    mcpWriteAuditSessionIdIdx: index('idx_mcp_write_audit_session_id').on(table.sessionId),
    mcpWriteAuditEntityRecordIdx: index('idx_mcp_write_audit_entity_record').on(table.entity, table.recordId),
    mcpWriteAuditCreatedAtIdx: index('idx_mcp_write_audit_created_at').on(table.createdAt),
  })
);

// OAuth 2.1 tables for MCP authentication
export const oauthClients = sqliteTable('oauth_clients', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clientId: text('client_id').notNull().unique(),
  clientSecret: text('client_secret'), // Null for public clients (PKCE)
  clientName: text('client_name').notNull(),
  redirectUris: text('redirect_uris').notNull(), // JSON array of allowed redirect URIs
  scope: text('scope').notNull().default('mcp:admin'),
  grantTypes: text('grant_types').notNull().default('authorization_code'), // JSON array
  responseTypes: text('response_types').notNull().default('code'), // JSON array
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

export const oauthAuthorizationCodes = sqliteTable(
  'oauth_authorization_codes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    code: text('code').notNull().unique(),
    clientId: text('client_id').notNull(), // No foreign key - client registration is optional
    userId: text('user_id').notNull(), // Better Auth user ID
    redirectUri: text('redirect_uri').notNull(),
    scope: text('scope').notNull(),
    codeChallenge: text('code_challenge').notNull(), // PKCE code challenge
    codeChallengeMethod: text('code_challenge_method').notNull().default('S256'), // S256 or plain
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    usedAt: integer('used_at', { mode: 'timestamp' }), // Prevents code reuse
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    oauthAuthCodesClientIdIdx: index('idx_oauth_auth_codes_client_id').on(table.clientId),
    oauthAuthCodesUserIdIdx: index('idx_oauth_auth_codes_user_id').on(table.userId),
    oauthAuthCodesExpiresAtIdx: index('idx_oauth_auth_codes_expires_at').on(table.expiresAt),
  })
);

export const oauthAccessTokens = sqliteTable(
  'oauth_access_tokens',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    accessToken: text('access_token').notNull().unique(),
    clientId: text('client_id').notNull(), // No foreign key - client registration is optional
    userId: text('user_id').notNull(), // Better Auth user ID
    scope: text('scope').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    revokedAt: integer('revoked_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    oauthAccessTokensClientIdIdx: index('idx_oauth_access_tokens_client_id').on(table.clientId),
    oauthAccessTokensUserIdIdx: index('idx_oauth_access_tokens_user_id').on(table.userId),
    oauthAccessTokensExpiresAtIdx: index('idx_oauth_access_tokens_expires_at').on(table.expiresAt),
    oauthAccessTokensRevokedAtIdx: index('idx_oauth_access_tokens_revoked_at').on(table.revokedAt),
  })
);
