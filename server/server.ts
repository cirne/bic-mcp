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
    tools: [
      {
        name: 'list_transactions',
        description: 'Search for grant transactions with advanced filtering, sorting, and grouping options.',
        inputSchema: {
          type: 'object',
          properties: {
            search_term: {
              type: 'string',
              description: 'Optional: The search term to find matching transactions using fuzzy, case-insensitive search across all fields',
            },
            charity: {
              type: 'string',
              description: 'Optional: Filter by exact charity name (case-insensitive)',
            },
            year: {
              type: 'number',
              description: 'Optional: Filter transactions by exact year (e.g., 2025). Checks all date fields.',
            },
            min_year: {
              type: 'number',
              description: 'Optional: Filter transactions from this year onwards (e.g., 2023 for "since 2023")',
            },
            max_year: {
              type: 'number',
              description: 'Optional: Filter transactions up to this year',
            },
            min_amount: {
              type: 'number',
              description: 'Optional: Filter transactions with amount greater than or equal to this value (e.g., 25000)',
            },
            max_amount: {
              type: 'number',
              description: 'Optional: Filter transactions with amount less than or equal to this value',
            },
            category: {
              type: 'string',
              description: 'Optional: Filter transactions by grantee category. Valid categories: "Evangelism", "Matthew 25", "Education/Schools", "Churches/Offerings"',
            },
            sort_by: {
              type: 'string',
              description: 'Optional: Field to sort by (e.g., "Sent Date", "Amount"). Default: no sorting',
            },
            sort_order: {
              type: 'string',
              enum: ['asc', 'desc'],
              description: 'Optional: Sort order - "asc" or "desc". Default: "asc"',
            },
            group_by: {
              type: 'string',
              description: 'Optional: Field to group results by (e.g., "year" extracts year from date fields, or any field name). Returns grouped object.',
            },
            fields: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional: Array of field names to include in response (e.g., ["Sent Date", "Amount", "Grant Purpose"]). If not provided, returns all fields.',
            },
          },
          required: [],
        },
      },
      {
        name: 'list_grantees',
        description: 'List all unique grantees (charities) with summary data including name, EIN, most recent grant note, transaction count, and total amount. This tool provides aggregated summary data for each grantee, making it ideal for answering questions about top grantees, largest recipients, or grantee rankings. Supports sorting by total amount, name, EIN, or most recent grant date. Optionally filter to only grantees that received grants in a specific year.',
        inputSchema: {
          type: 'object',
          properties: {
            year: {
              type: 'number',
              description: 'Optional: Filter to only grantees that received grants in this year (e.g., 2024). If provided, transaction count and total amount will be scoped to this year only.',
            },
            category: {
              type: 'string',
              description: 'Optional: Filter grantees by category. Valid categories: "Evangelism", "Matthew 25", "Education/Schools", "Churches/Offerings"',
            },
            sort_by: {
              type: 'string',
              enum: ['name', 'ein', 'recent_date', 'total_amount'],
              description: 'Optional: Sort grantees by name, EIN, most recent grant date, or total amount. Default: name',
            },
            sort_order: {
              type: 'string',
              enum: ['asc', 'desc'],
              description: 'Optional: Sort order - "asc" or "desc". Default: "asc"',
            },
          },
          required: [],
        },
      },
      {
        name: 'show_grantee',
        description: 'Show detailed information about a specific grantee including metadata and all transaction history.',
        inputSchema: {
          type: 'object',
          properties: {
            charity: {
              type: 'string',
              description: 'Required: Exact charity name to look up',
            },
            ein: {
              type: 'string',
              description: 'Optional: EIN (Employer Identification Number) to help identify the grantee if name is ambiguous',
            },
          },
          required: ['charity'],
        },
      },
      {
        name: 'aggregate_transactions',
        description: 'Aggregate grant transactions by category, grantee, or year. Returns summary statistics (count and total_amount) for each group. Only includes Payment Cleared grants. Use this tool for summary reports, category breakdowns, top grantees by amount, or yearly totals.',
        inputSchema: {
          type: 'object',
          properties: {
            group_by: {
              type: 'string',
              enum: ['category', 'grantee', 'year'],
              description: 'Required: Field to aggregate by - "category" (Evangelism, Matthew 25, Education/Schools, Churches/Offerings), "grantee" (charity name), or "year"',
            },
            year: {
              type: 'number',
              description: 'Optional: Filter transactions by exact year (e.g., 2025). Checks all date fields.',
            },
            min_year: {
              type: 'number',
              description: 'Optional: Filter transactions from this year onwards (e.g., 2023 for "since 2023")',
            },
            max_year: {
              type: 'number',
              description: 'Optional: Filter transactions up to this year',
            },
            min_amount: {
              type: 'number',
              description: 'Optional: Filter transactions with amount greater than or equal to this value (e.g., 25000)',
            },
            max_amount: {
              type: 'number',
              description: 'Optional: Filter transactions with amount less than or equal to this value',
            },
            category: {
              type: 'string',
              description: 'Optional: Filter by category when grouping by grantee or year (e.g., "Evangelism", "Matthew 25")',
            },
            charity: {
              type: 'string',
              description: 'Optional: Filter by exact charity name when grouping by category or year',
            },
            sort_by: {
              type: 'string',
              enum: ['count', 'total_amount', 'name'],
              description: 'Optional: Sort results by count, total_amount, or name. Default: total_amount',
            },
            sort_order: {
              type: 'string',
              enum: ['asc', 'desc'],
              description: 'Optional: Sort order - "asc" or "desc". Default: desc',
            },
          },
          required: ['group_by'],
        },
      },
    ],
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

