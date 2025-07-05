#!/usr/bin/env tsx
/**
 * Export script to migrate data from Turso to D1
 * 
 * This script exports all data from your current Turso database
 * into SQL INSERT statements that can be imported into D1
 */

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import * as schema from '../src/db/schema';
import * as authSchema from '../src/db/auth-schema';
import fs from 'fs';
import path from 'path';

// Environment variables
const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
  console.error('Missing required environment variables: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN');
  process.exit(1);
}

// Create Turso client
const client = createClient({
  url: TURSO_DATABASE_URL,
  authToken: TURSO_AUTH_TOKEN,
});

const db = drizzle(client, { schema: { ...schema, ...authSchema } });

// Helper function to escape SQL string values
function escapeSQL(value: any): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'string') {
    return `'${value.replace(/'/g, "''")}'`;
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  if (value instanceof Date) {
    return Math.floor(value.getTime() / 1000).toString();
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

// Helper function to generate INSERT statements
function generateInserts(tableName: string, rows: any[]): string {
  if (rows.length === 0) {
    return `-- No data found for table: ${tableName}\n`;
  }

  const columns = Object.keys(rows[0]);
  let sql = `-- Data for table: ${tableName}\n`;
  
  for (const row of rows) {
    const values = columns.map(col => escapeSQL(row[col])).join(', ');
    sql += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values});\n`;
  }
  
  return sql + '\n';
}

async function exportData() {
  console.log('Starting Turso data export...');
  
  let exportSQL = `-- Turso to D1 Data Export
-- Generated on: ${new Date().toISOString()}
-- 
-- IMPORTANT: Before importing to D1, make sure you have:
-- 1. Created your D1 database schema
-- 2. Applied any necessary migrations
-- 3. Reviewed this file for any issues
--
-- Import to D1 using: wrangler d1 execute your-database-name --file=turso-export.sql

`;

  try {
    // Export core tables in dependency order
    const tables = [
      { name: 'counties', schema: schema.counties },
      { name: 'affiliations', schema: schema.affiliations },
      { name: 'churches', schema: schema.churches },
      { name: 'church_affiliations', schema: schema.churchAffiliations },
      { name: 'church_gatherings', schema: schema.churchGatherings },
      { name: 'church_images', schema: schema.churchImages },
      { name: 'church_suggestions', schema: schema.churchSuggestions },
      { name: 'pages', schema: schema.pages },
      { name: 'settings', schema: schema.settings },
      { name: 'comments', schema: schema.comments },
    ];

    // Export each table
    for (const table of tables) {
      console.log(`Exporting table: ${table.name}`);
      
      try {
        const data = await db.select().from(table.schema);
        exportSQL += generateInserts(table.name, data);
        console.log(`  ✓ Exported ${data.length} rows from ${table.name}`);
      } catch (error) {
        console.log(`  ⚠ Error exporting ${table.name}: ${error.message}`);
        exportSQL += `-- Error exporting ${table.name}: ${error.message}\n\n`;
      }
    }

    // Export auth tables
    const authTables = [
      { name: 'users', schema: authSchema.users },
      { name: 'sessions', schema: authSchema.sessions },
      { name: 'accounts', schema: authSchema.accounts },
      { name: 'verification_tokens', schema: authSchema.verificationTokens },
    ];

    exportSQL += `-- Authentication tables\n`;
    for (const table of authTables) {
      console.log(`Exporting auth table: ${table.name}`);
      
      try {
        const data = await db.select().from(table.schema);
        exportSQL += generateInserts(table.name, data);
        console.log(`  ✓ Exported ${data.length} rows from ${table.name}`);
      } catch (error) {
        console.log(`  ⚠ Error exporting ${table.name}: ${error.message}`);
        exportSQL += `-- Error exporting ${table.name}: ${error.message}\n\n`;
      }
    }

    // Write export file
    const exportPath = path.join(process.cwd(), 'turso-export.sql');
    fs.writeFileSync(exportPath, exportSQL);
    
    console.log(`\n✅ Export completed successfully!`);
    console.log(`📄 Export file written to: ${exportPath}`);
    console.log(`\nNext steps:`);
    console.log(`1. Review the export file for any issues`);
    console.log(`2. Create your D1 database: wrangler d1 create utahchurches-production`);
    console.log(`3. Apply schema to D1: wrangler d1 execute utahchurches-production --file=path/to/schema.sql`);
    console.log(`4. Import data to D1: wrangler d1 execute utahchurches-production --file=turso-export.sql`);
    console.log(`5. Test the import by running some queries`);
    
  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  }
}

// Run the export
exportData().then(() => {
  console.log('\n🎉 Data export process completed!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});