# Web Search MCP Server

A Model Context Protocol (MCP) server that enables reliable web searching with automatic fallback.

## Features

- **3-tier fallback**: Google → DuckDuckGo → Tavily API
- Browser automation with stealth mode to avoid bot detection
- No API keys required (optional Tavily for fallback)
- Returns structured results with titles, URLs, and descriptions
- Configurable number of results per search

## How It Works

1. **First**: Attempts Google search via browser automation
2. **Fallback 1**: If Google blocks, tries DuckDuckGo
3. **Fallback 2**: If browser search fails, uses Tavily API (if configured)

## Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

The server uses `npx agent-browser` which auto-installs on first run.

## Installation

1. Install dependencies:
```bash
pnpm install
```

2. Build the server:
```bash
pnpm build
```

3. Add the server to your MCP configuration:

For Claude Code (`~/.claude.json`):
```json
{
  "mcpServers": {
    "web-search": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/web-search/build/index.js"],
      "env": {
        "TAVILY_API_KEY": "your-tavily-api-key-here"
      }
    }
  }
}
```

## Configuration

### Optional: Tavily API Key

Set the `TAVILY_API_KEY` environment variable to enable Tavily as a fallback when browser-based search fails. Get a key at [tavily.com](https://tavily.com).

Without Tavily configured, the server will only use browser-based search.

## Usage

The server provides a single tool named `search`:

```typescript
{
  "query": string,    // Search query (1-500 characters)
  "limit": number     // Optional: Number of results (default: 5, max: 10)
}
```

Example:
```json
{
  "query": "hello world",
  "limit": 3
}
```

Response:
```json
{
  "results": [
    {
      "title": "Example Result",
      "url": "https://example.com",
      "description": "Description..."
    }
  ],
  "source": "duckduckgo",
  "query": "hello world"
}
```

The `source` field indicates which provider was used: `google`, `duckduckgo`, or `tavily`.

## Security

This server implements several security measures:
- Command injection prevention via spawn() with argument arrays
- URL encoding via Node.js URL API
- Input validation with length limits
- Output size limits (10MB max)
- Timeout handling with proper cleanup
- Browser cleanup after each search

## License

MIT
