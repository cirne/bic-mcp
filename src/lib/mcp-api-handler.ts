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

// Load transactions with error handling
function loadTransactionsSafely(): { transactions: Transaction[] } | { error: string } {
  try {
    const transactions = getTransactions();
    if (!transactions || transactions.length === 0) {
      console.error('[MCP] WARNING: No transactions loaded');
      return { error: 'No transactions available. Please check data files.' };
    }
    return { transactions };
  } catch (error) {
    console.error('[MCP] ERROR loading transactions:', error instanceof Error ? error.message : String(error), error instanceof Error ? error.stack : '');
    return { error: `Failed to load transactions: ${error instanceof Error ? error.message : String(error)}` };
  }
}

// Execute a tool handler with error handling
function executeTool(toolName: string, transactions: Transaction[], args: any): MCPToolResult | { error: string } {
  const handler = TOOL_HANDLERS[toolName];
  if (!handler) {
    console.error('[MCP] ERROR: Unknown tool requested:', toolName);
    return { error: `Unknown tool: ${toolName}. Available: ${getAvailableToolNames().join(', ')}` };
  }

  try {
    const result = handler(transactions, args);
    
    // Check if handler returned an error
    if (result.isError) {
      const errorText = result.content[0]?.text || 'Unknown error occurred';
      console.error('[MCP] Tool returned error:', toolName, errorText);
      return { error: errorText };
    }
    
    return result;
  } catch (error) {
    console.error('[MCP] ERROR executing tool:', toolName, error instanceof Error ? error.message : String(error), error instanceof Error ? error.stack : '');
    return { error: `Internal error executing tool: ${error instanceof Error ? error.message : String(error)}` };
  }
}

// Format MCP tool result for response (handles structuredContent when outputSchema exists)
function formatMCPResult(toolName: string, executionResult: MCPToolResult): any {
  const tool = MCP_TOOLS.find(t => t.name === toolName);
  const hasOutputSchema = tool && 'outputSchema' in tool && tool.outputSchema;
  
  if (!hasOutputSchema) {
    return executionResult;
  }
  
  // Parse JSON from content[0].text to get structured data
  const jsonText = executionResult.content[0]?.text;
  if (!jsonText) {
    console.error('[MCP] ERROR: No content text found for tool:', toolName);
    // Still return structuredContent with null/empty to maintain protocol compliance
    // Claude's MCP client expects ONLY structuredContent when outputSchema exists
    return {
      structuredContent: null,
    };
  }
  
  try {
    const structuredData = JSON.parse(jsonText);
    
    // Validate that parsed data matches expected structure (basic check)
    if (structuredData === null || structuredData === undefined) {
      console.warn('[MCP] WARNING: Parsed data is null/undefined for tool:', toolName);
    }
    
    // Return structuredContent format (MCP protocol requirement when outputSchema is defined)
    // Claude's MCP client expects ONLY structuredContent when outputSchema exists, not both fields
    return {
      structuredContent: structuredData,
    };
  } catch (parseError) {
    const errorMsg = parseError instanceof Error ? parseError.message : String(parseError);
    const preview = jsonText.substring(0, 200);
    console.error('[MCP] ERROR: Failed to parse JSON for tool:', toolName, {
      error: errorMsg,
      preview,
      contentLength: jsonText.length,
    });
    
    // For tools with outputSchema, we MUST return structuredContent format
    // Return error in structuredContent to maintain protocol compliance
    // Claude's MCP client expects ONLY structuredContent when outputSchema exists
    return {
      structuredContent: {
        error: 'Failed to parse tool result',
        message: errorMsg,
      },
    };
  }
}

// Create JSON-RPC error response
function createJsonRpcError(id: any, code: number, message: string) {
  return NextResponse.json({
    jsonrpc: '2.0',
    id: id !== undefined ? id : null,
    error: { code, message },
  });
}

// Create JSON-RPC success response
function createJsonRpcSuccess(id: any, result: any) {
  return NextResponse.json({
    jsonrpc: '2.0',
    id: id !== undefined ? id : null,
    result,
  });
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
        
        console.log('[MCP] tools/call request:', { toolName, toolArguments: JSON.stringify(toolArguments) });
        
        if (!toolName) {
          console.error('[MCP] ERROR: Missing tool name in params');
          return createJsonRpcError(body.id, -32602, 'Invalid params: tool name is required');
        }

        // Load transactions
        console.log('[MCP] Loading transactions for tool:', toolName);
        const transactionsResult = loadTransactionsSafely();
        if ('error' in transactionsResult) {
          console.error('[MCP] ERROR loading transactions:', transactionsResult.error);
          return createJsonRpcError(body.id, -32603, transactionsResult.error);
        }
        const { transactions } = transactionsResult;
        console.log('[MCP] Loaded', transactions.length, 'transactions for tool:', toolName);
        
        // Execute tool
        console.log('[MCP] Executing tool:', toolName);
        const executionResult = executeTool(toolName, transactions, toolArguments);
        if ('error' in executionResult) {
          console.error('[MCP] ERROR executing tool:', toolName, executionResult.error);
          // Use appropriate error code based on error type
          const isUnknownTool = executionResult.error.includes('Unknown tool');
          const errorCode = isUnknownTool ? -32601 : -32603;
          return createJsonRpcError(body.id, errorCode, executionResult.error);
        }
        console.log('[MCP] Tool execution successful:', toolName, {
          hasContent: !!executionResult.content,
          contentLength: executionResult.content?.length,
          firstContentType: executionResult.content?.[0]?.type,
          firstContentTextLength: executionResult.content?.[0]?.text?.length,
        });
        
        try {
          // Verify the result structure is valid
          if (!executionResult || !executionResult.content || !Array.isArray(executionResult.content)) {
            console.error('[MCP] ERROR: Invalid result structure:', {
              hasExecutionResult: !!executionResult,
              hasContent: !!executionResult?.content,
              isArray: Array.isArray(executionResult?.content),
              executionResult,
            });
            return createJsonRpcError(body.id, -32603, 'Invalid result structure from tool handler');
          }
          
          // Format result (handles structuredContent when outputSchema exists)
          console.log('[MCP] Formatting result for tool:', toolName);
          const mcpResult = formatMCPResult(toolName, executionResult);
          const hasStructuredContent = 'structuredContent' in mcpResult;
          
          // Safe preview generation (handle large arrays/objects)
          let preview: string;
          try {
            if (hasStructuredContent) {
              const structuredStr = JSON.stringify(mcpResult.structuredContent);
              preview = structuredStr.length > 200 ? structuredStr.substring(0, 200) + '...' : structuredStr;
              console.log('[MCP] tools/call success:', { 
                toolName, 
                format: 'structuredContent',
                structuredDataType: Array.isArray(mcpResult.structuredContent) ? 'array' : typeof mcpResult.structuredContent,
                structuredDataLength: Array.isArray(mcpResult.structuredContent) ? mcpResult.structuredContent.length : 'N/A',
                preview,
              });
            } else {
              preview = mcpResult.content[0]?.text?.substring(0, 200) || '(no preview)';
              console.log('[MCP] tools/call success:', { 
                toolName, 
                format: 'content',
                preview,
              });
            }
          } catch (previewError) {
            console.warn('[MCP] WARNING: Could not generate preview:', previewError);
            preview = '(preview generation failed)';
          }
          
          // Validate serialization and log response size
          console.log('[MCP] Validating serialization for tool:', toolName);
          try {
            const testResponse = {
              jsonrpc: '2.0' as const,
              id: body.id !== undefined ? body.id : null,
              result: mcpResult,
            };
            const serialized = JSON.stringify(testResponse);
            const responseSizeKB = Math.round(serialized.length / 1024);
            console.log('[MCP] Response serialization validated, size:', responseSizeKB, 'KB', 'for tool:', toolName);
            
            if (responseSizeKB > 1000) {
              console.warn('[MCP] WARNING: Large response size:', responseSizeKB, 'KB', 'for tool:', toolName);
            }
          } catch (serialError) {
            console.error('[MCP] ERROR: Result cannot be serialized for tool:', toolName, serialError);
            return createJsonRpcError(body.id, -32603, `Result serialization error: ${serialError instanceof Error ? serialError.message : String(serialError)}`);
          }
          
          console.log('[MCP] Returning success response for tool:', toolName);
          return createJsonRpcSuccess(body.id, mcpResult);
        } catch (error) {
          console.error('[MCP] ERROR creating response for tool:', toolName, error instanceof Error ? error.message : String(error), error instanceof Error ? error.stack : '');
          return createJsonRpcError(body.id, -32603, `Error creating response: ${error instanceof Error ? error.message : String(error)}`);
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

    // Load transactions
    const transactionsResult = loadTransactionsSafely();
    if ('error' in transactionsResult) {
      return NextResponse.json(
        { error: transactionsResult.error },
        { status: 500 }
      );
    }
    const { transactions } = transactionsResult;
    
    // Execute tool
    const executionResult = executeTool(toolName, transactions, params || {});
    if ('error' in executionResult) {
      // Check if it's an unknown tool error (400) vs execution error (500)
      const isUnknownTool = executionResult.error.includes('Unknown tool');
      const isInternalError = executionResult.error.includes('Internal error executing tool');
      
      if (isInternalError) {
        // Extract the actual error message for details field
        const errorMessage = executionResult.error.replace('Internal error executing tool: ', '');
        return NextResponse.json(
          { error: 'Internal server error', details: errorMessage },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: executionResult.error, ...(isUnknownTool ? { available: getAvailableToolNames() } : {}) },
        { status: isUnknownTool ? 400 : 500 }
      );
    }

    return NextResponse.json(executionResult);
  } catch (error) {
    console.error('[MCP] FATAL ERROR:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

