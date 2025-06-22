import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core';

export const churches = sqliteTable('churches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  path: text('path').unique(),
  status: text('status', { enum: ['Listed', 'Ready to list', 'Assess', 'Needs data', 'Unlisted', 'Heretical', 'Closed'] }),
  privateNotes: text('private_notes'),
  publicNotes: text('public_notes'),
  lastUpdated: integer('last_updated', { mode: 'timestamp' }),
  gatheringAddress: text('gathering_address'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  countyId: integer('county_id').references(() => counties.id),
  serviceTimes: text('service_times'),
  website: text('website'),
  statementOfFaith: text('statement_of_faith'),
  phone: text('phone'),
  email: text('email'),
  facebook: text('facebook'),
  instagram: text('instagram'),
  youtube: text('youtube'),
  spotify: text('spotify'),
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
  website: text('website'),
  privateNotes: text('private_notes'),
  publicNotes: text('public_notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

export const churchAffiliations = sqliteTable('church_affiliations', {
  churchId: integer('church_id').notNull().references(() => churches.id),
  affiliationId: integer('affiliation_id').notNull().references(() => affiliations.id),
  order: integer('order').notNull(), // Order of affiliation for display
}, (table) => ({
  pk: primaryKey({ columns: [table.churchId, table.affiliationId] }),
}));

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  userType: text('user_type', { enum: ['admin', 'contributor'] }).notNull().default('contributor'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(), // UUID
  userId: integer('user_id').notNull().references(() => users.id),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
});