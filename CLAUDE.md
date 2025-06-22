# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Churches - An application for discovering churches in a region.
Database name: `utahchurches`

## Technology Stack

- **Package Manager**: pnpm (v10.11.0)
- **Backend**: Cloudflare Workers with Hono
- **Database**: Turso (SQLite at the edge)
- **ORM**: Drizzle ORM

## Development Setup

This project uses pnpm as the package manager. 

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
```

## Architecture Decisions

### Backend: Cloudflare Workers
The backend will be built using Cloudflare Workers for edge computing capabilities and global distribution.

### Database: Turso
Turso provides a SQLite-compatible database at the edge, perfect for low-latency access to church data from anywhere in the world.

### ORM: Drizzle
Drizzle ORM is used for type-safe database queries. It's lightweight, edge-compatible, and has first-class support for Turso via @libsql/client.

## Project Structure

The project is in its initial setup phase. When implementing features, consider:
- Setting up Cloudflare Workers with wrangler
- Configuring Turso database connection
- Database schema for storing church information
- Search and filtering capabilities
- Map integration for location-based discovery
- Frontend framework selection for the UI

## Important Notes

- Always use pnpm commands instead of npm or yarn
- Follow Cloudflare Workers best practices for edge computing
- Use Turso's edge-optimized queries for best performance
- Use Drizzle's schema definition for type safety
- Keep database migrations in sync with Drizzle schema