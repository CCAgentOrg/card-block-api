// Card Block API MCP Server
// Provides tools for AI agents to query card blocking information

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

const fs = require('fs');
const path = require('path');

// Load bank data
const dataDir = path.join(__dirname, '..', 'data', 'banks');

function loadBanksIndex() {
  const indexPath = path.join(dataDir, 'index.json');
  return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
}

function loadBank(slug) {
  const bankPath = path.join(dataDir, `${slug}.json`);
  if (!fs.existsSync(bankPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(bankPath, 'utf8'));
}

function searchBanks(query) {
  const index = loadBanksIndex();
  const q = query.toLowerCase();
  return index.banks.filter(bank => 
    bank.name.toLowerCase().includes(q) || 
    bank.slug.toLowerCase().includes(q)
  );
}

// Tools definitions
const tools = [
  {
    name: 'list_banks',
    description: 'List all available banks in the Card Block API',
    inputSchema: {
      type: 'object',
      properties: {},
    }
  },
  {
    name: 'get_bank',
    description: 'Get card blocking information for a specific bank',
    inputSchema: {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          description: 'Bank identifier (e.g., hdfc-bank, sbi, axis-bank)',
        },
      },
      required: ['slug'],
    }
  },
  {
    name: 'search_banks',
    description: 'Search banks by name',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (bank name)',
        },
      },
      required: ['query'],
    }
  },
  {
    name: 'get_blocking_methods',
    description: 'Get all blocking methods (phone, SMS, app, website) for a bank',
    inputSchema: {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          description: 'Bank identifier',
        },
        channel: {
          type: 'string',
          description: 'Filter by channel: sms, phone, app, website',
          enum: ['sms', 'phone', 'app', 'website'],
        },
      },
      required: ['slug'],
    }
  },
  {
    name: 'get_urgent_block',
    description: 'Get the fastest blocking method for emergency situations',
    inputSchema: {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          description: 'Bank identifier',
        },
      },
      required: ['slug'],
    }
  },
];

// Tool handlers
const toolHandlers = {
  list_banks: async () => {
    const index = loadBanksIndex();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          total_banks: index.banks.length,
          banks: index.banks.map(b => ({
            slug: b.slug,
            name: b.name,
            type: b.type
          }))
        }, null, 2)
      }]
    };
  },

  get_bank: async ({ slug }) => {
    const bank = loadBank(slug);
    if (!bank) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: `Bank not found: ${slug}` }, null, 2)
        }],
        isError: true
      };
    }
    
    // Return simplified info
    const info = {
      name: bank.name,
      slug: bank.slug,
      type: bank.type,
      website: bank.website,
      blocking_page: bank.blocking_page || bank.cards?.[0]?.blocking_methods?.find(m => m.url)?.url,
      verification: bank.verification,
      channels: {}
    };
    
    // Extract channel info
    const card = bank.cards?.[0];
    if (card) {
      for (const method of card.blocking_methods || []) {
        info.channels[method.channel] = {
          instructions: method.instructions,
          numbers: method.numbers,
          available_24x7: method.available_24x7
        };
      }
    }
    
    return {
      content: [{ type: 'text', text: JSON.stringify(info, null, 2) }]
    };
  },

  search_banks: async ({ query }) => {
    const results = searchBanks(query);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ results }, null, 2)
      }]
    };
  },

  get_blocking_methods: async ({ slug, channel }) => {
    const bank = loadBank(slug);
    if (!bank) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `Bank not found: ${slug}` }) }],
        isError: true
      };
    }
    
    const card = bank.cards?.[0];
    let methods = card?.blocking_methods || [];
    
    if (channel) {
      methods = methods.filter(m => m.channel === channel);
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          bank: bank.name,
          methods: methods.map(m => ({
            channel: m.channel,
            priority: m.priority,
            instructions: m.instructions,
            numbers: m.numbers,
            url: m.url,
            available_24x7: m.available_24x7
          }))
        }, null, 2)
      }]
    };
  },

  get_urgent_block: async ({ slug }) => {
    const bank = loadBank(slug);
    if (!bank) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `Bank not found: ${slug}` }) }],
        isError: true
      };
    }
    
    const card = bank.cards?.[0];
    const methods = card?.blocking_methods || [];
    
    // Sort by priority and get fastest
    methods.sort((a, b) => a.priority - b.priority);
    const fastest = methods[0];
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          bank: bank.name,
          fastest_method: fastest.channel,
          instructions: fastest.instructions,
          numbers: fastest.numbers,
          available_24x7: fastest.available_24x7,
          alternative: methods[1] ? {
            channel: methods[1].channel,
            instructions: methods[1].instructions,
            numbers: methods[1].numbers
          } : null
        }, null, 2)
      }]
    };
  },
};

// Create server
const server = new Server(
  {
    name: 'card-block-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Set up handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const handler = toolHandlers[name];
  
  if (!handler) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true
    };
  }
  
  try {
    return await handler(args);
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Card Block MCP Server running...');
}

main().catch(console.error);
