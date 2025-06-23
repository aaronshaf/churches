# Utah Churches

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A directory of evangelical churches in Utah, built with Cloudflare Workers, Hono, and Turso.

## Overview

Utah Churches provides a comprehensive directory of evangelical churches across Utah's counties. The application features an interactive map, detailed church information, and data export capabilities.

**Live Site**: [https://utahchurches.aaronshaf.workers.dev](https://utahchurches.aaronshaf.workers.dev)

## Features

- 📍 **Interactive Map** - Find churches near you with Google Maps integration
- 🏛️ **County Organization** - Browse churches organized by Utah counties
- 🔍 **Church Details** - View service times, contact info, and affiliations
- 📊 **Data Export** - Download church data in JSON, YAML, CSV, or XLSX formats
- 🌐 **Multi-language Support** - Track churches serving in different languages
- 🔐 **Admin Dashboard** - Manage churches, affiliations, and users

## Technology Stack

- **Runtime**: Cloudflare Workers (edge computing)
- **Framework**: Hono (lightweight web framework)
- **Database**: Turso (SQLite at the edge)
- **ORM**: Drizzle ORM
- **Styling**: Tailwind CSS (via CDN)
- **Package Manager**: pnpm

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm 10.11.0+
- Cloudflare account
- Turso database account

### Environment Variables

Create a `.dev.vars` file in the root directory:

```
TURSO_DATABASE_URL=your_database_url
TURSO_AUTH_TOKEN=your_auth_token
GOOGLE_MAPS_API_KEY=your_maps_api_key
```

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# The app will be available at http://localhost:8787
```

## Available Scripts

```bash
# Development
pnpm dev              # Start development server

# Database
pnpm db:generate      # Generate Drizzle migrations
pnpm db:push         # Push schema changes to database
pnpm db:studio       # Open Drizzle Studio
pnpm db:seed         # Seed admin user
pnpm db:reset-admin  # Reset admin password

# Deployment
pnpm deploy          # Deploy to Cloudflare Workers
```

## Project Structure

```
├── src/
│   ├── components/      # React-like JSX components
│   ├── db/             # Database schema and configuration
│   ├── middleware/     # Authentication middleware
│   ├── styles/         # Tailwind class collections
│   ├── utils/          # Utility functions
│   └── index.tsx       # Main application routes
├── drizzle/            # Database migrations
├── public/             # Static assets
└── wrangler.toml       # Cloudflare Workers configuration
```

## Database Schema

The application uses the following main tables:

- `churches` - Church information including location, contacts, and status
- `counties` - Utah counties
- `affiliations` - Church networks/denominations
- `church_affiliations` - Many-to-many relationship
- `church_gatherings` - Service times and details
- `users` - Admin/contributor accounts
- `sessions` - Authentication sessions

## Church Status Types

- **Listed** - Publicly visible churches
- **Ready to list** - Pending review
- **Assess** - Under evaluation
- **Needs data** - Incomplete information
- **Unlisted** - Not publicly visible
- **Heretical** - Excluded from public data
- **Closed** - No longer active

## API Endpoints

### Public Routes
- `GET /` - Home page with county list
- `GET /counties/:path` - Churches in a specific county
- `GET /churches/:path` - Individual church details
- `GET /map` - Interactive map
- `GET /networks` - Church affiliations
- `GET /data` - Data export page

### Data Export
- `GET /churches.json` - JSON format
- `GET /churches.yaml` - YAML format
- `GET /churches.csv` - CSV format
- `GET /churches.xlsx` - Excel format

### Admin Routes (Authentication Required)
- `GET /admin` - Dashboard
- `GET /admin/churches` - Manage churches
- `GET /admin/affiliations` - Manage affiliations
- `GET /admin/counties` - Manage counties
- `GET /admin/users` - Manage users

## Deployment

### Deploy to Cloudflare Workers

```bash
# Set production secrets
wrangler secret put TURSO_DATABASE_URL
wrangler secret put TURSO_AUTH_TOKEN
wrangler secret put GOOGLE_MAPS_API_KEY

# Deploy
pnpm deploy
```

## Contributing

Please read [CLAUDE.md](CLAUDE.md) for detailed information about the codebase structure and development patterns.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

For questions or support, please open an issue on GitHub.