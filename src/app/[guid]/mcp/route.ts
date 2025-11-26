import { NextRequest } from 'next/server';
import { handleMCPGet, handleMCPPost } from '@/lib/mcp-api-handler';

// Validate GUID matches the configured one
function validateGuid(guid: string): boolean {
  const configuredGuid = process.env.MCP_GUID;
  if (!configuredGuid) {
    // If no GUID is configured, reject all requests for security
    return false;
  }
  return guid === configuredGuid;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ guid: string }> }) {
  const { guid } = await params;
  if (!validateGuid(guid)) {
    return new Response('Not Found', { status: 404 });
  }
  return handleMCPGet(request);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ guid: string }> }) {
  const { guid } = await params;
  if (!validateGuid(guid)) {
    return new Response('Not Found', { status: 404 });
  }
  return handleMCPPost(request);
}

