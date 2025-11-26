import { NextRequest, NextResponse } from 'next/server';

// Status endpoint to verify MCP server configuration
// Note: Does NOT expose the GUID for security reasons
export async function GET(request: NextRequest) {
  const guid = process.env.MCP_GUID;
  const hasApiKey = !!process.env.MCP_API_KEY;
  
  // Get the base URL from the request
  const baseUrl = new URL(request.url).origin;
  
  return NextResponse.json({
    status: guid ? 'configured' : 'not_configured',
    hasGuid: !!guid,
    hasApiKey: hasApiKey,
    endpointFormat: '{baseUrl}/{guid}/mcp',
    baseUrl: baseUrl,
    instructions: guid 
      ? 'MCP endpoint is configured. Get your GUID from Vercel environment variables to construct the full URL.'
      : 'MCP_GUID environment variable is not set. Please set it in your deployment environment.',
    howToGetGuid: [
      '1. Go to your Vercel project dashboard',
      '2. Navigate to Settings → Environment Variables',
      '3. Find and copy your MCP_GUID value',
      '4. Construct your endpoint URL: {baseUrl}/{MCP_GUID}/mcp',
    ],
    note: 'Keep your GUID secret - it acts as a security token. Do not expose it publicly.',
  });
}

