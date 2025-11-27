import { NextRequest, NextResponse } from 'next/server';
import { loadTransactions } from '@/lib/transactions';
import {
  handleListTransactions,
  handleListGrantees,
  handleShowGrantee,
  handleAggregateTransactions,
} from '@/lib/mcp-handlers';
import { MCP_TOOLS } from '@/lib/mcp-tools';

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

// Re-export for backward compatibility
export const TOOLS = MCP_TOOLS;

// Handle GET requests (list tools)
export async function handleMCPGet(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    tools: MCP_TOOLS,
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
            tools: MCP_TOOLS,
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
            case 'aggregate_transactions':
              result = handleAggregateTransactions(transactions, toolArguments);
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

