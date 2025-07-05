import { integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const churches = sqliteTable('churches', {
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
  imageId: text('image_id'),
  imageUrl: text('image_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

export const counties = sqliteTable('counties', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  path: text('path').unique(),
  description: text('description'),
  population: integer('population'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

export const affiliations = sqliteTable('affiliations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  path: text('path').unique(),
  status: text('status', { enum: ['Listed', 'Unlisted', 'Heretical'] }).default('Listed'),
  website: text('website'),
  privateNotes: text('private_notes'),
  publicNotes: text('public_notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

export const churchAffiliations = sqliteTable(
  'church_affiliations',
  {
    churchId: integer('church_id')
      .notNull()
      .references(() => churches.id),
    affiliationId: integer('affiliation_id')
      .notNull()
      .references(() => affiliations.id),
    order: integer('order').notNull(), // Order of affiliation for display
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
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(), // UUID
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
});
*/

export const churchGatherings = sqliteTable('church_gatherings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  churchId: integer('church_id')
    .notNull()
    .references(() => churches.id),
  time: text('time').notNull(),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

export const pages = sqliteTable('pages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  path: text('path').notNull().unique(),
  content: text('content'),
  featuredImageId: text('featured_image_id'),
  featuredImageUrl: text('featured_image_url'),
  navbarOrder: integer('navbar_order'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  value: text('value'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

export const churchImages = sqliteTable('church_images', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  churchId: integer('church_id')
    .notNull()
    .references(() => churches.id),
  imageId: text('image_id').notNull(),
  imageUrl: text('image_url').notNull(),
  caption: text('caption'),
  displayOrder: integer('display_order').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
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
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
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
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});
