# Utah Churches

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A directory of evangelical churches in Utah, built with Cloudflare Workers, Hono, and Turso.

## Overview

Utah Churches provides a comprehensive directory of evangelical churches across Utah's counties. The application features an interactive map, detailed church information, and data export capabilities.

## Features

- 📍 **Interactive Map** - Find churches near you with Google Maps integration
- 🏛️ **County Organization** - Browse churches organized by Utah counties
- 🔍 **Church Details** - View service times, contact info, and affiliations
- 📊 **Data Export** - Download church data in JSON, YAML, CSV, or XLSX formats
- 🌐 **Multi-language Support** - Track churches serving in different languages
- 🔐 **Admin Dashboard** - Manage churches, affiliations, and users
- 🤖 **AI-Powered Data Extraction** - Automatically extract church information from websites
- 🖼️ **Image Management** - Upload and reorder multiple church images via Cloudflare Images
- ⚡ **Save and Continue** - Efficiently review churches with one-click navigation to next church

## Technology Stack

- **Runtime**: Cloudflare Workers (edge computing)
- **Framework**: Hono (lightweight web framework)
- **Database**: Turso (SQLite at the edge)
- **ORM**: Drizzle ORM
- **Authentication**: Clerk (role-based access control)
- **Styling**: Tailwind CSS (via CDN)
- **Package Manager**: pnpm
- **AI Integration**: OpenRouter API with Google Gemini
- **Image Storage**: Cloudflare Images

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm 10.11.0+
- Cloudflare account
- Turso database account
- Clerk account (for authentication)

### Environment Variables

Create a `.dev.vars` file in the root directory:

```
TURSO_DATABASE_URL=your_database_url
TURSO_AUTH_TOKEN=your_auth_token
GOOGLE_MAPS_API_KEY=your_maps_api_key
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_ACCOUNT_HASH=your_cloudflare_account_hash
CLOUDFLARE_IMAGES_API_TOKEN=your_cloudflare_images_token
OPENROUTER_API_KEY=your_openrouter_api_key

# Authentication (Clerk) - Required
CLERK_PUBLISHABLE_KEY=pk_test_your_key
CLERK_SECRET_KEY=sk_test_your_key
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
- `church_images` - Church photos and images
- `pages` - Static pages (FAQ, About, etc.)
- `settings` - Site configuration

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
- `GET /admin/settings` - Site settings and configuration
- `GET /admin/pages` - Manage static pages
- `POST /admin/churches/:id/extract` - Extract church data from website

## Key Features for Administrators

### Save and Continue Workflow
When editing churches, administrators can use the "Save and continue" button to:
1. Save the current church
2. Automatically navigate to the next church needing review (oldest update date)
3. Continue reviewing churches in sequence without returning to the list

### Efficient Data Entry
- Drag-and-drop image reordering
- Automatic address formatting and normalization
- Service time validation and normalization
- AI extraction for rapid data collection from church websites

## AI-Powered Data Extraction

The application includes an AI-powered feature to automatically extract church information from websites:

### How it Works
1. Enter a church website URL in the edit form
2. Click "Extract Info from Website"
3. The system fetches and converts the webpage to text
4. Google Gemini 2.5 Flash Lite (via OpenRouter) analyzes the content
5. Extracted data is automatically filled into the form

### Extracted Information
- Phone numbers (formatted consistently)
- Email addresses
- Physical addresses (with proper capitalization)
- Service times with:
  - Normalized time formats (e.g., "9 AM" not "9am")
  - Day of week for multi-day schedules
  - Brief notes (2-4 words max like "Traditional" or "Bible study")
- Social media links (Facebook, Instagram, YouTube, Spotify)
- Statement of Faith URL

### Setup
1. Sign up for a free [OpenRouter](https://openrouter.ai) account
2. Generate an API key
3. Add to `.dev.vars` and production secrets

The extraction uses Google Gemini 2.5 Flash Lite which has a 1M+ token context window, allowing it to process even very large church websites.

## Authentication Setup

### Clerk Configuration

The application uses [Clerk](https://clerk.com) for authentication with role-based access control.

1. **Create a Clerk Application**
   - Sign up at [clerk.com](https://clerk.com)
   - Create a new application
   - Copy your API keys

2. **Configure Environment Variables**
   ```bash
   # Development keys (required)
   CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   ```

3. **Set User Roles**
   - The application uses `publicMetadata` for role-based access control
   - Available roles: `admin`, `contributor`, `user`
   - First user can be promoted to admin using:
   ```bash
   pnpm tsx scripts/set-clerk-admin.ts user@example.com
   ```

4. **Production Setup**
   ```bash
   # Set production secrets
   wrangler secret put CLERK_PUBLISHABLE_KEY
   wrangler secret put CLERK_SECRET_KEY
   ```


## Deployment

### Deploy to Cloudflare Workers

```bash
# Set production secrets
wrangler secret put TURSO_DATABASE_URL
wrangler secret put TURSO_AUTH_TOKEN
wrangler secret put GOOGLE_MAPS_API_KEY
wrangler secret put CLOUDFLARE_ACCOUNT_ID
wrangler secret put CLOUDFLARE_ACCOUNT_HASH
wrangler secret put CLOUDFLARE_IMAGES_API_TOKEN
wrangler secret put OPENROUTER_API_KEY
wrangler secret put CLERK_PUBLISHABLE_KEY
wrangler secret put CLERK_SECRET_KEY
wrangler secret put USE_CLERK_AUTH

# Deploy
pnpm deploy
```

## Contributing

Please read [CLAUDE.md](CLAUDE.md) for detailed information about the codebase structure and development patterns.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

For questions or support, please open an issue on GitHub.