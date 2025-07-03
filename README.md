# Churches Directory

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A directory of evangelical churches, built with Cloudflare Workers, Hono, and Turso.

## Overview

This application provides a comprehensive directory of evangelical churches organized by county. The application features an interactive map, detailed church information, and data export capabilities.

## Features

- 📍 **Interactive Map** - Find churches near you with Google Maps integration
- 🏛️ **County Organization** - Browse churches organized by counties
- 🔍 **Church Details** - View gathering times, contact info, and affiliations
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
- **Authentication**: Better-auth (self-hosted, Google OAuth)
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
- Google OAuth credentials (for authentication)

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

# Authentication (Better-Auth) - Required
BETTER_AUTH_SECRET=your-secret-key-here-min-32-chars-long
BETTER_AUTH_URL=http://localhost:8787
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
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
- `counties` - Geographic counties
- `affiliations` - Church networks/denominations
- `church_affiliations` - Many-to-many relationship
- `church_gatherings` - Gathering times and details
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
- Gathering time validation and normalization
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
- Gathering times with:
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

## SEO & Structured Data

The application includes JSON-LD structured data on individual church pages (`/churches/:path`) to improve search engine understanding and visibility. This includes:

- Church schema with address, contact information, and geo coordinates
- Event schemas for recurring church gatherings
- Organization affiliations
- Social media links
- Statement of Faith as a related CreativeWork

The domain and region in structured data are configurable via the site settings.

## Authentication Setup

### Better-Auth Configuration

The application uses better-auth for self-hosted authentication with Google OAuth.

1. **Create Google OAuth Application**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project or select existing
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URI: `http://localhost:8787/auth/callback/google`

2. **Configure Environment Variables**
   ```bash
   # Better-Auth configuration (required)
   BETTER_AUTH_SECRET=your-secret-key-here-min-32-chars-long
   BETTER_AUTH_URL=http://localhost:8787
   GOOGLE_CLIENT_ID=your-google-client-id-here
   GOOGLE_CLIENT_SECRET=your-google-client-secret-here
   ```

3. **Set Up Database Schema**
   ```bash
   # Create better-auth tables
   pnpm better-auth:schema
   ```

4. **Production Setup**
   ```bash
   # Set production secrets
   wrangler secret put BETTER_AUTH_SECRET
   wrangler secret put BETTER_AUTH_URL
   wrangler secret put GOOGLE_CLIENT_ID
   wrangler secret put GOOGLE_CLIENT_SECRET
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
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put BETTER_AUTH_URL
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET

# Deploy
pnpm deploy
```

## Contributing

Please read [CLAUDE.md](CLAUDE.md) for detailed information about the codebase structure and development patterns.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

For questions or support, please open an issue on GitHub.