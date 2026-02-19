# Card Block MCP Server

Model Context Protocol server for Card Block API. Allows AI agents to programmatically query bank card blocking information.

## Installation

```bash
cd mcp
npm install
```

## Usage

### Start the MCP server

```bash
npm start
```

### Available Tools

| Tool | Description |
|------|-------------|
| `list_banks` | List all available banks |
| `get_bank` | Get card blocking info for a specific bank |
| `search_banks` | Search banks by name |
| `get_blocking_methods` | Get blocking methods for a bank |
| `get_urgent_block` | Get fastest blocking method for emergencies |

### Example Usage

```json
// List all banks
{
  "name": "list_banks",
  "arguments": {}
}

// Get HDFC Bank info
{
  "name": "get_bank",
  "arguments": { "slug": "hdfc-bank" }
}

// Get urgent blocking info
{
  "name": "get_urgent_block",
  "arguments": { "slug": "sbi" }
}

// Search for a bank
{
  "name": "search_banks",
  "arguments": { "query": "axis" }
}
```

### Integration with Claude/OpenCode

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "card-block": {
      "command": "node",
      "args": ["/path/to/card-block-api/mcp/index.js"]
    }
  }
}
```

## Data

The MCP reads from the parent `data/banks/` directory. Make sure bank JSON files are present.
