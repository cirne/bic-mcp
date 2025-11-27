#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadTransactions } from '../src/lib/transactions.js';
import {
  handleListTransactions,
  handleListGrantees,
  handleShowGrantee,
  handleAggregateTransactions,
} from '../src/lib/mcp-handlers.js';
import { MCP_TOOLS } from '../src/lib/mcp-tools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load transactions on startup
// Use the data directory relative to project root
const dataDir = join(__dirname, '..', 'data');
let transactions = loadTransactions(dataDir);

// Create MCP server
const server = new Server(
  {
    name: 'bic-grants',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: MCP_TOOLS,
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  let result: { content: Array<{ type: 'text'; text: string }>; isError?: boolean };
  switch (name) {
    case 'list_transactions':
      result = handleListTransactions(transactions, (args || {}) as Parameters<typeof handleListTransactions>[1]);
      break;
    case 'list_grantees':
      result = handleListGrantees(transactions, (args || {}) as Parameters<typeof handleListGrantees>[1]);
      break;
    case 'show_grantee':
      result = handleShowGrantee(transactions, (args || {}) as Parameters<typeof handleShowGrantee>[1]);
      break;
    case 'aggregate_transactions':
      result = handleAggregateTransactions(transactions, (args || {}) as Parameters<typeof handleAggregateTransactions>[1]);
      break;
    default:
      return {
        content: [
          {
            type: 'text',
            text: `Unknown tool: ${name}`,
          },
        ],
        isError: true,
      };
  }

  return result;
});

// Start server with stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('BIC Grants MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

