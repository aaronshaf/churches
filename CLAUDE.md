# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Utah Churches - An application for discovering Christian churches in Utah.
Database name: `utahchurches`
Production URL: https://utahchurches.aaronshaf.workers.dev

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
- `bcryptjs` - Password hashing
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
pnpm db:push      # Push schema to Turso
pnpm db:studio    # Open Drizzle Studio
pnpm db:seed      # Seed admin user
pnpm db:reset-admin  # Reset admin password

# Run custom migrations (when db:push doesn't work)
pnpm tsx scripts/run-migration.ts

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
- **users**: Admin/contributor accounts
- **sessions**: User authentication sessions
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
- Session-based authentication (not JWT)
- bcrypt for password hashing
- Admin middleware for protected routes
- Environment variables for secrets

### UI/UX Patterns
- Responsive grid layouts
- Consistent color scheme via Tailwind config
- Loading states with delays to prevent flash
- Hover states and transitions for interactivity

## Development Best Practices

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