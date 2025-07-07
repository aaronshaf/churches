# 🏛️ Utah Churches MCP Server - Comprehensive Church Data API

Hi everyone! I've implemented a Model Context Protocol server for **Utah Churches** - a comprehensive database of Christian churches in Utah. This provides AI assistants and bots with structured access to church information, locations, and networks.

## 🚀 What's Available

**Base URL:** `https://utahchurches.org/mcp/`

### Available Tools

1. **`church_search`** - Enhanced search with filters
   - Search by name, keywords
   - Filter by county, status, affiliation
   - Smart ranking and limits

2. **`county_browser`** - Browse by Utah counties  
   - County statistics and demographics
   - Church counts and listings
   - Optional church details

3. **`network_explorer`** - Explore church networks
   - Browse denominations and affiliations
   - Member church listings
   - Network websites and information

4. **`church_details`** - Comprehensive church info
   - Full contact information
   - Location data with coordinates
   - Social media links and affiliations
   - Service times and languages

## 📋 Quick Start

### List Available Tools
```bash
GET https://utahchurches.org/mcp/tools
```

### Call a Tool
```bash
POST https://utahchurches.org/mcp/tools/call
Content-Type: application/json

{
  "name": "church_search",
  "arguments": {
    "query": "Baptist",
    "county": "Salt Lake", 
    "status": "Listed",
    "limit": 10
  }
}
```

## 🛠️ Technical Details

- **Built on:** Cloudflare Workers (edge computing)
- **Database:** SQLite at the edge via Turso
- **Features:** CORS enabled, comprehensive filtering, structured responses
- **Data Quality:** Curated and actively maintained database
- **Coverage:** All 29 Utah counties with 500+ churches

## 📊 Data Structure

Churches include:
- Name, status, and location data  
- Contact info (website, phone, email)
- Social media links (Facebook, Instagram, YouTube, Spotify)
- Network affiliations and denominations
- Service languages and gathering addresses
- Coordinates for mapping integration

## 🎯 Use Cases

Perfect for:
- **Location-based recommendations** ("Find churches near me")
- **Denominational research** ("What Presbyterian churches are in Utah County?")
- **Contact information lookup** ("Get the website for First Baptist")
- **Geographic analysis** ("How many churches are in rural counties?")
- **Social media integration** ("Find churches with active YouTube channels")

## 📚 Documentation

Full documentation and examples: [MCP_README.md](https://github.com/ashafovaloff/churches/blob/main/MCP_README.md)

The system also provides traditional REST endpoints and data exports (JSON, YAML, CSV) for broader integration needs.

---

**Attribution:** When using this data, please attribute to Utah Churches (utahchurches.org)

Happy to answer questions or help with integration! The codebase is open source and we welcome contributions.