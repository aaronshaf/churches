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

## Example MCP Tool Configuration

```typescript
{
  name: "search_utah_churches",
  description: "Search for churches in Utah by name, city, or affiliation",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query"
      }
    },
    required: ["query"]
  },
  execute: async ({ query }) => {
    const response = await fetch(`https://utahchurches.org/api/churches/search?q=${encodeURIComponent(query)}`);
    return await response.json();
  }
}
```

## Discussion Thread

Share your bot integrations and get help: https://github.com/orgs/modelcontextprotocol/discussions/84