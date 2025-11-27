import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { validateApiKey, handleMCPGet, handleMCPPost, TOOLS, getAvailableToolNames } from './mcp-api-handler';
import { MCP_TOOLS } from './mcp-tools';
import type { Transaction } from './filters';

// Mock the handlers and transactions loader
vi.mock('./mcp-handlers', () => ({
  handleListTransactions: vi.fn(),
  handleListGrantees: vi.fn(),
  handleShowGrantee: vi.fn(),
  handleAggregateTransactions: vi.fn(),
}));

vi.mock('./transactions', () => ({
  loadTransactions: vi.fn(),
}));

import { handleListTransactions, handleListGrantees, handleShowGrantee, handleAggregateTransactions } from './mcp-handlers';
import { loadTransactions } from './transactions';

// Suppress console.error during tests to reduce noise from expected error logs
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const mockTransactions: Transaction[] = [
  {
    'Transaction ID': '1',
    'Charity': 'Test Charity',
    'Amount': '1,000.00',
  },
];

// Helper to create mock NextRequest
function createMockRequest(options: {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  url?: string;
}): NextRequest {
  const url = options.url || 'http://localhost:3000/api/mcp';
  const headers = new Headers(options.headers || {});
  
  const request = new NextRequest(url, {
    method: options.method || 'GET',
    headers,
  });

  // Mock json() and text() methods
  if (options.body) {
    request.json = vi.fn().mockResolvedValue(options.body);
    request.text = vi.fn().mockResolvedValue(JSON.stringify(options.body));
  } else {
    request.json = vi.fn().mockResolvedValue({});
    request.text = vi.fn().mockResolvedValue('');
  }

  return request;
}

describe('validateApiKey', () => {
  beforeEach(() => {
    delete process.env.MCP_API_KEY;
  });

  it('should return true when no API key is set', () => {
    const request = createMockRequest({});
    expect(validateApiKey(request)).toBe(true);
  });

  it('should return true when API key matches Bearer token', () => {
    process.env.MCP_API_KEY = 'test-key-123';
    const request = createMockRequest({
      headers: { authorization: 'Bearer test-key-123' },
    });
    expect(validateApiKey(request)).toBe(true);
  });

  it('should return false when Bearer token does not match', () => {
    process.env.MCP_API_KEY = 'test-key-123';
    const request = createMockRequest({
      headers: { authorization: 'Bearer wrong-key' },
    });
    expect(validateApiKey(request)).toBe(false);
  });

  it('should return true when API key matches x-api-key header', () => {
    process.env.MCP_API_KEY = 'test-key-123';
    const request = createMockRequest({
      headers: { 'x-api-key': 'test-key-123' },
    });
    expect(validateApiKey(request)).toBe(true);
  });

  it('should return false when x-api-key does not match', () => {
    process.env.MCP_API_KEY = 'test-key-123';
    const request = createMockRequest({
      headers: { 'x-api-key': 'wrong-key' },
    });
    expect(validateApiKey(request)).toBe(false);
  });

  it('should prefer Bearer token over x-api-key', () => {
    process.env.MCP_API_KEY = 'test-key-123';
    const request = createMockRequest({
      headers: {
        authorization: 'Bearer test-key-123',
        'x-api-key': 'wrong-key',
      },
    });
    expect(validateApiKey(request)).toBe(true);
  });

  it('should return false when no auth headers provided but API key is set', () => {
    process.env.MCP_API_KEY = 'test-key-123';
    const request = createMockRequest({});
    expect(validateApiKey(request)).toBe(false);
  });
});

describe('handleMCPGet', () => {
  beforeEach(() => {
    delete process.env.MCP_API_KEY;
  });

  it('should return tools list when authorized', async () => {
    const request = createMockRequest({});
    const response = await handleMCPGet(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.tools).toEqual(TOOLS);
    expect(data.tools).toHaveLength(4);
  });

  it('should return 401 when unauthorized', async () => {
    process.env.MCP_API_KEY = 'test-key-123';
    const request = createMockRequest({}); // No auth header
    const response = await handleMCPGet(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });
});

describe('handleMCPPost', () => {
  beforeEach(() => {
    delete process.env.MCP_API_KEY;
    vi.mocked(loadTransactions).mockReturnValue(mockTransactions);
    vi.mocked(handleListTransactions).mockReturnValue({
      content: [{ type: 'text', text: JSON.stringify([]) }],
    });
    vi.mocked(handleListGrantees).mockReturnValue({
      content: [{ type: 'text', text: JSON.stringify([]) }],
    });
    vi.mocked(handleShowGrantee).mockReturnValue({
      content: [{ type: 'text', text: JSON.stringify({}) }],
    });
  });

  it('should return 401 when unauthorized', async () => {
    process.env.MCP_API_KEY = 'test-key-123';
    const request = createMockRequest({
      method: 'POST',
      body: { name: 'list_transactions', arguments: {} },
    });
    const response = await handleMCPPost(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  describe('MCP Protocol Format', () => {
    it('should handle initialize method', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: {
          jsonrpc: '2.0',
          method: 'initialize',
          id: 1,
          params: { protocolVersion: '2024-11-05' },
        },
      });

      const response = await handleMCPPost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.jsonrpc).toBe('2.0');
      expect(data.id).toBe(1);
      expect(data.result.protocolVersion).toBe('2024-11-05');
      expect(data.result.serverInfo.name).toBe('bic-grants');
      expect(data.result.serverInfo.version).toBe('1.0.0');
    });

    it('should use default protocol version when not provided', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: {
          jsonrpc: '2.0',
          method: 'initialize',
          id: 1,
          params: {},
        },
      });

      const response = await handleMCPPost(request);
      const data = await response.json();

      expect(data.result.protocolVersion).toBe('2024-11-05');
    });

    it('should handle tools/list method', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: {
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 2,
        },
      });

      const response = await handleMCPPost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.jsonrpc).toBe('2.0');
      expect(data.id).toBe(2);
      expect(data.result.tools).toEqual(TOOLS);
    });

    it('should handle tools/call method with structuredContent when outputSchema exists', async () => {
      const mockResult = {
        content: [{ type: 'text' as const, text: JSON.stringify([{ id: 1 }]) }],
      };
      vi.mocked(handleListTransactions).mockReturnValue(mockResult);

      const request = createMockRequest({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: {
          jsonrpc: '2.0',
          method: 'tools/call',
          id: 3,
          params: {
            name: 'list_transactions',
            arguments: { year: 2024 },
          },
        },
      });

      const response = await handleMCPPost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.jsonrpc).toBe('2.0');
      expect(data.id).toBe(3);
      // Should have structuredContent when outputSchema is defined
      expect(data.result).toHaveProperty('structuredContent');
      expect(data.result.structuredContent).toEqual([{ id: 1 }]);
      // Should also have content for backward compatibility
      expect(data.result).toHaveProperty('content');
      expect(data.result.content).toEqual(mockResult.content);
      expect(handleListTransactions).toHaveBeenCalledWith(mockTransactions, { year: 2024 });
    });

    it('should return error when tool name is missing in tools/call', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: {
          jsonrpc: '2.0',
          method: 'tools/call',
          id: 4,
          params: {
            arguments: { year: 2024 },
          },
        },
      });

      const response = await handleMCPPost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.jsonrpc).toBe('2.0');
      expect(data.error.code).toBe(-32602);
      expect(data.error.message).toContain('tool name is required');
    });

    it('should return error for unknown tool in tools/call', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: {
          jsonrpc: '2.0',
          method: 'tools/call',
          id: 5,
          params: {
            name: 'unknown_tool',
            arguments: {},
          },
        },
      });

      const response = await handleMCPPost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.jsonrpc).toBe('2.0');
      expect(data.error.code).toBe(-32601);
      expect(data.error.message).toContain('Unknown tool');
    });

    it('should return error for unknown MCP method', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: {
          jsonrpc: '2.0',
          method: 'unknown_method',
          id: 6,
        },
      });

      const response = await handleMCPPost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.jsonrpc).toBe('2.0');
      expect(data.error.code).toBe(-32601);
      expect(data.error.message).toContain('Unknown method');
    });

    it('should handle error from handler execution', async () => {
      vi.mocked(handleListTransactions).mockImplementation(() => {
        throw new Error('Handler error');
      });

      const request = createMockRequest({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: {
          jsonrpc: '2.0',
          method: 'tools/call',
          id: 7,
          params: {
            name: 'list_transactions',
            arguments: {},
          },
        },
      });

      const response = await handleMCPPost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.jsonrpc).toBe('2.0');
      expect(data.error.code).toBe(-32603);
      expect(data.error.message).toContain('Internal error');
    });
  });

  describe('Simple Format', () => {
    it('should handle simple format with name and arguments', async () => {
      const mockResult = {
        content: [{ type: 'text' as const, text: JSON.stringify([]) }],
      };
      vi.mocked(handleListGrantees).mockReturnValue(mockResult);

      const request = createMockRequest({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: {
          name: 'list_grantees',
          arguments: { sort_by: 'name' },
        },
      });

      const response = await handleMCPPost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockResult);
      expect(handleListGrantees).toHaveBeenCalledWith(mockTransactions, { sort_by: 'name' });
    });

    it('should handle simple format with show_grantee', async () => {
      const mockResult = {
        content: [{ type: 'text' as const, text: JSON.stringify({ metadata: {} }) }],
      };
      vi.mocked(handleShowGrantee).mockReturnValue(mockResult);

      const request = createMockRequest({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: {
          name: 'show_grantee',
          arguments: { charity: 'Test Charity' },
        },
      });

      const response = await handleMCPPost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockResult);
      expect(handleShowGrantee).toHaveBeenCalledWith(mockTransactions, { charity: 'Test Charity' });
    });

    it('should return error when tool name is missing', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: {},
      });

      const response = await handleMCPPost(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Tool name or method is required');
    });

    it('should return error for unknown tool in simple format', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: {
          name: 'unknown_tool',
          arguments: {},
        },
      });

      const response = await handleMCPPost(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Unknown tool');
      // Use the actual available tools from MCP_TOOLS (single source of truth)
      expect(data.available).toEqual(expect.arrayContaining(['list_transactions', 'list_grantees', 'show_grantee', 'aggregate_transactions']));
      expect(data.available.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Tool Handler Validation', () => {
    it('should have handlers for all tools defined in MCP_TOOLS', () => {
      // This test ensures we catch missing handlers at test time
      const availableTools = getAvailableToolNames();
      expect(availableTools.length).toBeGreaterThan(0);
      expect(availableTools).toContain('list_transactions');
      expect(availableTools).toContain('list_grantees');
      expect(availableTools).toContain('show_grantee');
      expect(availableTools).toContain('aggregate_transactions');
      
      // Verify all tools in MCP_TOOLS are callable (handled by validateToolHandlers on module load)
      // If this test passes, it means validateToolHandlers() didn't throw
      expect(MCP_TOOLS.length).toBe(availableTools.length);
    });

    it('should return correct list of available tool names', () => {
      const toolNames = getAvailableToolNames();
      expect(toolNames).toEqual(MCP_TOOLS.map(tool => tool.name));
    });

    it('should handle error from handler execution in simple format', async () => {
      vi.mocked(handleListTransactions).mockImplementation(() => {
        throw new Error('Handler error');
      });

      const request = createMockRequest({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: {
          name: 'list_transactions',
          arguments: {},
        },
      });

      const response = await handleMCPPost(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(data.details).toBe('Handler error');
    });
  });

  describe('Request Parsing', () => {
    it('should parse JSON body from content-type application/json', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { name: 'list_transactions', arguments: {} },
      });

      await handleMCPPost(request);
      expect(request.json).toHaveBeenCalled();
    });

    it('should parse JSON from text body', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: { name: 'list_transactions', arguments: {} },
      });

      await handleMCPPost(request);
      expect(request.text).toHaveBeenCalled();
    });

    it('should handle empty body', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: {},
        body: {},
      });

      const response = await handleMCPPost(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Tool name or method is required');
    });

    it('should handle invalid JSON gracefully', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: null,
      });
      request.text = vi.fn().mockResolvedValue('invalid json');

      const response = await handleMCPPost(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Tool name or method is required');
    });
  });

  describe('All Tool Types', () => {
    it('should call handleListTransactions for list_transactions', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: { name: 'list_transactions', arguments: { year: 2024 } },
      });

      await handleMCPPost(request);
      expect(handleListTransactions).toHaveBeenCalledWith(mockTransactions, { year: 2024 });
    });

    it('should call handleListGrantees for list_grantees', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: { name: 'list_grantees', arguments: { sort_by: 'total_amount' } },
      });

      await handleMCPPost(request);
      expect(handleListGrantees).toHaveBeenCalledWith(mockTransactions, { sort_by: 'total_amount' });
    });

    it('should call handleShowGrantee for show_grantee', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: { name: 'show_grantee', arguments: { charity: 'Test' } },
      });

      await handleMCPPost(request);
      expect(handleShowGrantee).toHaveBeenCalledWith(mockTransactions, { charity: 'Test' });
    });
  });

  describe('Tool Handler Validation', () => {
    it('should have handlers for all tools defined in MCP_TOOLS', () => {
      // This test ensures we catch missing handlers at test time
      // The validateToolHandlers() function runs on module load and will throw if handlers are missing
      // If this test passes, it means validateToolHandlers() didn't throw
      const availableTools = getAvailableToolNames();
      expect(availableTools.length).toBeGreaterThan(0);
      expect(availableTools).toContain('list_transactions');
      expect(availableTools).toContain('list_grantees');
      expect(availableTools).toContain('show_grantee');
      expect(availableTools).toContain('aggregate_transactions');
      
      // Verify all tools in MCP_TOOLS are callable
      expect(MCP_TOOLS.length).toBe(availableTools.length);
    });

    it('should return correct list of available tool names', () => {
      const toolNames = getAvailableToolNames();
      expect(toolNames).toEqual(MCP_TOOLS.map(tool => tool.name));
    });
  });
});

