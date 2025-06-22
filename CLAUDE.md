# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Utah Churches - An application for discovering Christian churches in Utah.
Database name: `utahchurches`
Production URL: https://utahchurches.aaronshaf.workers.dev

## Technology Stack

- **Package Manager**: pnpm (v10.11.0)
- **Backend**: Cloudflare Workers with Hono
- **Database**: Turso (SQLite at the edge)
- **ORM**: Drizzle ORM
- **Styling**: Tailwind CSS (via CDN)
- **Maps**: Google Maps JavaScript API

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
- **affiliations**: Church networks/denominations
- **church_affiliations**: Many-to-many relationship
- **users**: Admin/contributor accounts
- **sessions**: User authentication sessions

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
- `/admin` - Dashboard
- `/admin/churches` - Manage churches
- `/admin/affiliations` - Manage affiliations
- `/admin/counties` - Manage counties
- `/admin/users` - Manage users

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

## Important Implementation Notes

- Always use pnpm commands instead of npm or yarn
- Church paths should be URL-friendly slugs
- Heretical churches are excluded from public data exports
- Use environment variables for sensitive configuration
- Tailwind CSS is loaded via CDN, not compiled
- Map loading indicator has 500ms delay to prevent flash
- Footer shows single "Data" link instead of individual format links
- Active navbar items show blue bottom border