# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Utah Churches - An application for discovering Christian churches in Utah.
Database name: `utahchurches`

## Technology Stack & Library Choices

### Core Technologies
- **Runtime**: Cloudflare Workers (edge computing, global distribution)
- **Framework**: Hono (lightweight, edge-optimized web framework)
- **Database**: Turso (SQLite at the edge, low-latency reads)
- **ORM**: Drizzle ORM (type-safe, edge-compatible, lightweight)

### Frontend & Styling
- **UI Rendering**: Server-side JSX (no client-side framework needed)
- **Styling**: Tailwind CSS via CDN (no build step, instant updates)
- **Icons**: Heroicons (inline SVGs for performance)
- **Maps**: Google Maps JavaScript API (best coverage for Utah)

### Development Tools
- **Package Manager**: pnpm v10.11.0 (faster, more efficient than npm)
- **Local Dev**: Wrangler (Cloudflare's CLI)
- **TypeScript**: Built-in support via Hono
- **Code Search**: ast-grep (structural code search, faster than regex)

### Key Dependencies
- `hono` - Web framework optimized for edge
- `@libsql/client` - Turso database client
- `drizzle-orm` - Type-safe ORM
- `better-auth` - Self-hosted authentication with Google OAuth
- `js-yaml` - YAML data export
- `drizzle-kit` - Database migrations and schema management

### Why These Choices?
- **Edge-first**: All technologies chosen for edge compatibility
- **No build step**: Direct TSX support, CDN assets
- **Type safety**: TypeScript + Drizzle for runtime safety
- **Performance**: SQLite at edge locations, server-side rendering
- **Simplicity**: Minimal dependencies, no complex build pipeline

## Development Setup

This project uses pnpm as the package manager. 

### Environment Variables

Create a `.dev.vars` file with:
```
TURSO_DATABASE_URL=your_database_url
TURSO_AUTH_TOKEN=your_auth_token
GOOGLE_MAPS_API_KEY=your_maps_api_key
BETTER_AUTH_SECRET=your-secret-key-here-min-32-chars-long
BETTER_AUTH_URL=http://localhost:8787
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
```

### Common Commands

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Deploy to Cloudflare Workers
pnpm deploy

# Database commands
pnpm db:generate  # Generate Drizzle migrations
pnpm db:migrate   # Apply pending migrations (STANDARD WAY)
pnpm db:push      # Push schema to Turso (development only)
pnpm db:studio    # Open Drizzle Studio
pnpm db:seed      # Seed admin user
pnpm db:reset-admin  # Reset admin password

# Initialize standard migrations (one-time setup)
pnpm tsx scripts/setup-standard-migrations.ts

# Better-Auth setup (self-hosted authentication)
pnpm better-auth:setup    # Configure environment variables for better-auth
pnpm better-auth:schema   # Create auth database tables  
pnpm better-auth:test     # Show testing instructions

# Code search with ast-grep
ast-grep --pattern 'app.get($_, $_)' src/  # Find all GET routes
ast-grep --pattern 'churches.$_' src/      # Find church table queries
ast-grep --pattern '<$Component $$$>' src/  # Find JSX component usage
```

### Production Secrets

Set production secrets using wrangler:
```bash
wrangler secret put TURSO_DATABASE_URL
wrangler secret put TURSO_AUTH_TOKEN
wrangler secret put GOOGLE_MAPS_API_KEY
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put BETTER_AUTH_URL
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
```

## Architecture

### Backend: Cloudflare Workers
- Edge computing for low latency
- Server-side rendered JSX components
- RESTful API endpoints

### Database Schema
- **churches**: Church information including location, contacts, and status
- **counties**: Utah counties
- **affiliations**: Church networks/denominations with status (Listed, Unlisted, Heretical)
- **church_affiliations**: Many-to-many relationship
- **church_gatherings**: Gathering times and notes for each church
- **users**: Admin/contributor accounts (better-auth)
- **sessions**: User authentication sessions (better-auth)
- **accounts**: OAuth account linking (better-auth)
- **verification_tokens**: Email verification tokens (better-auth)
- **pages**: Custom content pages with title, path, and content

### Routes

#### Public Routes
- `/` - Home page with county list
- `/counties/:path` - Churches in a specific county
- `/churches/:path` - Individual church page
- `/map` - Interactive map of churches
- `/networks` - Listed church affiliations
- `/data` - Data export page

#### Data Export Routes
- `/churches.json` - JSON format (excludes heretical churches)
- `/churches.yaml` - YAML format (excludes heretical churches, null fields removed)
- `/churches.csv` - CSV format (spreadsheet-compatible)

#### Admin Routes
- `/admin` - Dashboard with statistics
- `/admin/churches` - Manage churches
- `/admin/affiliations` - Manage affiliations
- `/admin/counties` - Manage counties
- `/admin/users` - Manage users
- `/admin/pages` - Manage custom pages

### Key Features

1. **Church Management**
   - Status tracking (Listed, Ready to list, Assess, Needs data, Unlisted, Heretical, Closed)
   - Multiple affiliations per church
   - Public and private notes
   - Comprehensive contact information

2. **Map Integration**
   - Interactive Google Maps
   - User location detection (Utah bounds check)
   - Church markers with info windows
   - Responsive design

3. **Data Export**
   - Multiple formats (JSON, YAML, CSV)
   - Heretical churches excluded from public exports
   - Clean data formatting (nulls removed from YAML)

4. **UI/UX**
   - Active navigation state indicators
   - Responsive design
   - Improved loading indicators
   - Sticky footer with Bible verse
   - Smart redirects (e.g., /church-name → /churches/church-name)
   - Edit buttons in footer for authenticated users
   - Heretical churches option on map (?heretical query param)

## Architectural Patterns & Conventions

### Component Structure
- Server-side JSX components in `/src/components/`
- Props interfaces defined with TypeScript
- Functional components using Hono's JSX runtime
- No client-side state management (all server-rendered)

### Routing Patterns
- RESTful URLs for resources (`/churches/:path`, `/counties/:path`)
- Admin routes prefixed with `/admin/`
- Data export routes use file extensions (`.json`, `.yaml`, `.csv`)
- Current path passed to Layout for active navigation states

### Database Patterns
- Soft references via `countyId`, `affiliationId`
- Many-to-many via junction tables (`church_affiliations`)
- Timestamps on all tables (`createdAt`, `updatedAt`)
- Status enums for controlled values

### Security Patterns
- **Authentication**: Better-auth (self-hosted) with Google OAuth
- **Sessions**: Database sessions with role field on user
- **Admin middleware**: Protected routes using better-auth
- **Environment variables**: Secrets stored securely

### Authentication System
- **System**: Better-auth (self-hosted authentication)
- **OAuth**: Google OAuth only - no password storage (Apple OAuth planned)
- **Session Management**: Database-backed sessions
- **User Roles**: admin, contributor, user
- **Routes**: `/auth/signin`, `/auth/signout`, `/auth/callback/google`
- **Setup**: Run `pnpm better-auth:setup` to configure
- **Testing**: Run `pnpm better-auth:test` for instructions

### UI/UX Patterns
- Responsive grid layouts
- Consistent color scheme via Tailwind config
- Loading states with delays to prevent flash
- Hover states and transitions for interactivity

## Development Best Practices

### Database Migrations (Standard Drizzle Workflow)

**Initial Setup (One-time):**
1. Run `pnpm tsx scripts/setup-standard-migrations.ts` to initialize migration tracking
2. This marks your current schema as the baseline without affecting data

**Standard Workflow for Schema Changes:**
1. **Edit Schema**: Modify `src/db/schema.ts` with your changes
2. **Generate Migration**: Run `pnpm db:generate`
   - Creates numbered SQL files in `/drizzle/` folder
   - Drizzle auto-detects changes and generates appropriate SQL
3. **Review Migration**: Check the generated SQL file before applying
4. **Apply Migration**: Run `pnpm db:migrate`
   - Applies pending migrations to database
   - Updates tracking table automatically

**Development vs Production:**
- **Development**: Can use `pnpm db:push` for rapid prototyping (bypasses migrations)
- **Production**: ALWAYS use `pnpm db:migrate` for proper versioning and safety

**Migration Files Location:**
- Generated migrations: `/drizzle/0004_xxx.sql`, `/drizzle/0005_xxx.sql`, etc.
- Tracking metadata: `/drizzle/meta/` folder
- Old custom scripts: Can be removed after transition

### Code Search and Navigation
- **Use ast-grep for structural code search** - it's faster and more accurate than regex
  - Example: `ast-grep --pattern 'app.get($path, $_)' src/`
  - Example: `ast-grep --pattern 'name="$_"' src/components/`
  - Searches by AST structure, not text patterns
- Prefer ast-grep over grep/Grep when searching for:
  - Function calls, route definitions, JSX attributes
  - Import statements, variable declarations
  - Any code with specific structure

## Important Implementation Notes

- Always use pnpm commands instead of npm or yarn
- Church paths should be URL-friendly slugs (lowercase, hyphens)
- Heretical churches are excluded from public data exports
- Use environment variables for sensitive configuration
- Tailwind CSS is loaded via CDN, not compiled
- Map loading indicator has 500ms delay to prevent flash
- Footer shows single "Data" link instead of individual format links
- Active navbar items show blue bottom border
- All timestamps stored as Unix timestamps (seconds)
- Use Drizzle migrations for schema changes
- Prefer server-side rendering over client-side JavaScript
- Keep components pure (no side effects in render)
- Textarea elements in JSX must use children for content, not value attribute
- Database column names use snake_case (e.g., public_notes)
- TypeScript/JSX uses camelCase (e.g., publicNotes)
- Footer component accepts user, churchId, and countyId props for edit links
- Admin topnav is shown on /data page for authenticated admins
- 404 pages implement smart redirects for church URLs
- Networks page shows unlisted churches if only unlisted exist

## SEO & Structured Data

### JSON-LD Implementation
- **Where**: Only on individual church detail pages (`/churches/:path`)
- **Schema Type**: Church with Event sub-schemas for gatherings
- **Dynamic Values**: Domain and region are configurable via settings table
  - `site_domain` setting (defaults to utahchurches.org)
  - `site_region` setting (defaults to UT)
- **Features**:
  - Church information with address, geo coordinates, contact details
  - Statement of Faith as `subjectOf` CreativeWork
  - Church gatherings as recurring Event schemas
  - Social media links in `sameAs` array
  - Organization affiliations in `memberOf`
- **Note**: Logo field excluded as churches don't have logos in the system

### Sitemap & Robots.txt
- Both files use dynamic domain from settings
- Sitemap includes all listed churches, counties, networks, and pages
- Robots.txt blocks admin and API routes

## Authentication System History

**Current Authentication**: Better-auth (self-hosted) with Google OAuth ✅

The application uses better-auth for self-hosted authentication, providing full control over user management and sessions.