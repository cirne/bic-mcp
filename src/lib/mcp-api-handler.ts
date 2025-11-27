import { NextRequest, NextResponse } from 'next/server';
import { loadTransactions } from '@/lib/transactions';
import {
  handleListTransactions,
  handleListGrantees,
  handleShowGrantee,
  handleAggregateTransactions,
} from '@/lib/mcp-handlers';
import { MCP_TOOLS } from '@/lib/mcp-tools';
import type { Transaction } from '@/lib/filters';
import type { MCPToolResult } from '@/lib/mcp-handlers';

// Map tool names to their handler functions - single source of truth derived from MCP_TOOLS
type ToolHandler = (transactions: Transaction[], args: any) => MCPToolResult;
const TOOL_HANDLERS: Record<string, ToolHandler> = {
  list_transactions: handleListTransactions,
  list_grantees: handleListGrantees,
  show_grantee: handleShowGrantee,
  aggregate_transactions: handleAggregateTransactions,
};

// Get list of available tool names from MCP_TOOLS (single source of truth)
export function getAvailableToolNames(): string[] {
  return MCP_TOOLS.map(tool => tool.name);
}

// Validate that all tools in MCP_TOOLS have handlers
function validateToolHandlers() {
  const toolNames = getAvailableToolNames();
  const missingHandlers = toolNames.filter(name => !TOOL_HANDLERS[name]);
  if (missingHandlers.length > 0) {
    throw new Error(`Missing handlers for tools: ${missingHandlers.join(', ')}`);
  }
}

// Validate on module load
validateToolHandlers();

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
        
        // Get handler from map (single source of truth)
        const handler = TOOL_HANDLERS[toolName];
        if (!handler) {
          console.error('[MCP] ERROR: Unknown tool requested:', toolName);
          return NextResponse.json({
            jsonrpc: '2.0',
            id: body.id !== undefined ? body.id : null,
            error: {
              code: -32601,
              message: `Unknown tool: ${toolName}. Available: ${getAvailableToolNames().join(', ')}`,
            },
          });
        }
        
        let result;
        try {
          result = handler(transactions, toolArguments);
          
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
    
    // Get handler from map (single source of truth)
    const handler = TOOL_HANDLERS[toolName];
    if (!handler) {
      console.error('[MCP] ERROR: Unknown tool requested:', toolName);
      return NextResponse.json(
        { error: `Unknown tool: ${toolName}`, available: getAvailableToolNames() },
        { status: 400 }
      );
    }
    
    let result;
    try {
      result = handler(transactions, params || {});

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

