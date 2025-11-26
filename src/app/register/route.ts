import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/mcp-api-handler';

// Handle MCP server registration
export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    
    // Return registration success response
    // Note: The actual MCP endpoint requires a GUID: /{guid}/mcp
    const guid = process.env.MCP_GUID || 'your-guid-here';
    return NextResponse.json({
      status: 'registered',
      serverUrl: new URL(`/${guid}/mcp`, request.url).toString(),
      note: 'Replace {guid} in the URL with your MCP_GUID environment variable',
    });
  } catch (error) {
    console.error('Error handling registration:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

