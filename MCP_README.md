# Utah Churches API - Model Context Protocol Integration

This document describes how to integrate with the Utah Churches data via MCP (Model Context Protocol).

## Available Endpoints

### Churches Data
- `GET https://utahchurches.org/churches.json` - Complete list of all listed churches with affiliations
- `GET https://utahchurches.org/churches.yaml` - Same data in YAML format (nulls removed)
- `GET https://utahchurches.org/churches.csv` - Spreadsheet-compatible format
- `GET https://utahchurches.org/churches.xlsx` - Excel workbook with multiple sheets

### API Endpoints
- `GET https://utahchurches.org/api/counties` - List of all Utah counties
- `GET https://utahchurches.org/api/networks` - List of church networks/affiliations
- `GET https://utahchurches.org/api/churches/search?q={query}` - Search churches by name

### MCP Protocol Endpoints
- `GET https://utahchurches.org/mcp/tools` - List available MCP tools
- `POST https://utahchurches.org/mcp/tools/call` - Execute MCP tool calls

#### Available MCP Tools
1. **church_search** - Enhanced church search with filters for status, county, and affiliation
2. **county_browser** - Browse churches by Utah county with statistics
3. **network_explorer** - Explore church networks and their member churches
4. **church_details** - Get comprehensive information about a specific church

## Data Structure

### Church Object
```json
{
  "id": 123,
  "name": "Church Name",
  "path": "church-name",
  "status": "Listed",
  "lastUpdated": 1234567890,
  "gatheringAddress": "123 Main St, City, UT 84101",
  "latitude": 40.7608,
  "longitude": -111.8910,
  "county": "Salt Lake",
  "website": "https://example.com",
  "statementOfFaith": "https://example.com/beliefs",
  "phone": "(801) 555-1234",
  "email": "info@example.com",
  "facebook": "https://facebook.com/example",
  "instagram": "https://instagram.com/example",
  "youtube": "https://youtube.com/example",
  "spotify": "https://open.spotify.com/show/example",
  "language": "English",
  "notes": "Public notes about the church",
  "affiliations": [
    {
      "id": 1,
      "name": "Network Name",
      "website": "https://network.com",
      "notes": "Network description"
    }
  ]
}
```

## Usage Notes

1. **Data Filtering**: The public endpoints exclude churches marked as "Heretical" to maintain data quality
2. **Rate Limiting**: Please be respectful of the API and avoid excessive requests
3. **Caching**: Data is updated regularly but can be cached for up to 1 hour
4. **Attribution**: When using this data, please attribute to Utah Churches (utahchurches.org)

## MCP Integration Examples

### Basic MCP Client Setup

```typescript
// List available tools
const toolsResponse = await fetch('https://utahchurches.org/mcp/tools');
const { tools } = await toolsResponse.json();

// Call a specific tool
const callResponse = await fetch('https://utahchurches.org/mcp/tools/call', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'church_search',
    arguments: {
      query: 'Baptist',
      county: 'Salt Lake',
      status: 'Listed',
      limit: 10
    }
  })
});

const result = await callResponse.json();
```

### Tool Usage Examples

#### Church Search Tool
```json
{
  "name": "church_search",
  "arguments": {
    "query": "Baptist",
    "county": "Utah",
    "status": "Listed",
    "affiliation": "Southern Baptist",
    "limit": 20
  }
}
```

#### County Browser Tool
```json
{
  "name": "county_browser",
  "arguments": {
    "county": "Salt Lake",
    "include_churches": true
  }
}
```

#### Network Explorer Tool
```json
{
  "name": "network_explorer",
  "arguments": {
    "network": "Presbyterian",
    "include_churches": true,
    "status_filter": "Listed"
  }
}
```

#### Church Details Tool
```json
{
  "name": "church_details",
  "arguments": {
    "identifier": "first-baptist-salt-lake"
  }
}
```

## Discussion Thread

Share your bot integrations and get help: https://github.com/orgs/modelcontextprotocol/discussions/84