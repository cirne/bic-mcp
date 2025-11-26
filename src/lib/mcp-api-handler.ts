import { NextRequest, NextResponse } from 'next/server';
import { loadTransactions } from '@/lib/transactions';
import {
  handleListTransactions,
  handleListGrantees,
  handleShowGrantee,
} from '@/lib/mcp-handlers';

// Cache transactions in memory (Vercel serverless functions are stateless)
let cachedTransactions: ReturnType<typeof loadTransactions> | null = null;

function getTransactions() {
  if (!cachedTransactions) {
    cachedTransactions = loadTransactions();
  }
  return cachedTransactions;
}

// API key validation
export function validateApiKey(request: NextRequest): boolean {
  const apiKey = process.env.MCP_API_KEY;
  if (!apiKey) {
    // If no API key is set, allow all requests (for development)
    return true;
  }

  const authHeader = request.headers.get('authorization');
  const providedKey = authHeader?.replace('Bearer ', '') || request.headers.get('x-api-key');

  return providedKey === apiKey;
}

// MCP tool definitions
export const TOOLS = [
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
];

// Handle GET requests (list tools)
export async function handleMCPGet(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    tools: TOOLS,
  });
}

// Handle POST requests (call tools)
export async function handleMCPPost(request: NextRequest) {
  if (!validateApiKey(request)) {
    console.error('[MCP] Unauthorized - missing/invalid API key');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const contentType = request.headers.get('content-type') || '';
    let body: any;

    if (contentType.includes('application/json')) {
      body = await request.json();
    } else {
      const text = await request.text();
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          body = {};
        }
      } else {
        body = {};
      }
    }

    // Handle MCP protocol format: { method, params, id } or direct { name, arguments }
    const method = body.method || body.name;
    const params = body.params || body.arguments || {};
    const isMCPProtocol = !!body.method;

    // Handle MCP protocol methods
    if (isMCPProtocol) {
      if (method === 'initialize') {
        // Use the protocol version the client sent, or default to 2024-11-05
        const clientProtocolVersion = params.protocolVersion || '2024-11-05';
        
        const response = {
          jsonrpc: '2.0',
          id: body.id !== undefined ? body.id : null,
          result: {
            protocolVersion: clientProtocolVersion,
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'bic-grants',
              version: '1.0.0',
            },
          },
        };
        
        return NextResponse.json(response);
      }

      if (method === 'tools/list') {
        return NextResponse.json({
          jsonrpc: '2.0',
          id: body.id !== undefined ? body.id : null,
          result: {
            tools: TOOLS,
          },
        });
      }

      if (method === 'tools/call') {
        const toolName = params.name;
        const toolArguments = params.arguments || {};
        
        if (!toolName) {
          console.error('[MCP] ERROR: Missing tool name in params');
          return NextResponse.json({
            jsonrpc: '2.0',
            id: body.id !== undefined ? body.id : null,
            error: {
              code: -32602,
              message: 'Invalid params: tool name is required',
            },
          });
        }

        const transactions = getTransactions();
        
        let result;
        try {
          switch (toolName) {
            case 'list_transactions':
              result = handleListTransactions(transactions, toolArguments);
              break;
            case 'list_grantees':
              result = handleListGrantees(transactions, toolArguments);
              break;
            case 'show_grantee':
              result = handleShowGrantee(transactions, toolArguments);
              break;
            default:
              console.error('[MCP] ERROR: Unknown tool requested:', toolName);
              return NextResponse.json({
                jsonrpc: '2.0',
                id: body.id !== undefined ? body.id : null,
                error: {
                  code: -32601,
                  message: `Unknown tool: ${toolName}`,
                },
              });
          }
          
          return NextResponse.json({
            jsonrpc: '2.0',
            id: body.id !== undefined ? body.id : null,
            result: result,
          });
        } catch (error) {
          console.error('[MCP] ERROR executing tool:', toolName, error instanceof Error ? error.message : String(error));
          return NextResponse.json({
            jsonrpc: '2.0',
            id: body.id !== undefined ? body.id : null,
            error: {
              code: -32603,
              message: `Internal error executing tool: ${error instanceof Error ? error.message : String(error)}`,
            },
          });
        }
      }

      // Unknown MCP method
      return NextResponse.json({
        jsonrpc: '2.0',
        id: body.id || null,
        error: {
          code: -32601,
          message: `Unknown method: ${method}`,
        },
      });
    }

    // Handle simple format: { name, arguments }
    const toolName = method;
    if (!toolName) {
      console.error('[MCP] ERROR: Tool name or method is required');
      return NextResponse.json(
        { error: 'Tool name or method is required' },
        { status: 400 }
      );
    }

    const transactions = getTransactions();
    
    let result;
    try {
      switch (toolName) {
        case 'list_transactions':
          result = handleListTransactions(transactions, params || {});
          break;
        case 'list_grantees':
          result = handleListGrantees(transactions, params || {});
          break;
        case 'show_grantee':
          result = handleShowGrantee(transactions, params || {});
          break;
        default:
          console.error('[MCP] ERROR: Unknown tool requested:', toolName);
        return NextResponse.json(
          { error: `Unknown tool: ${toolName}`, available: ['list_transactions', 'list_grantees', 'show_grantee'] },
          { status: 400 }
        );
    }

      return NextResponse.json(result);
    } catch (error) {
      console.error('[MCP] ERROR executing tool:', toolName, error instanceof Error ? error.message : String(error));
      return NextResponse.json(
        { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[MCP] FATAL ERROR:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

