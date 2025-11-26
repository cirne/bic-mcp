# Cursor MCP Server Configuration

## Quick Setup

To configure Cursor to use this MCP server:

1. **Open Cursor Settings**:
   - Press `Cmd+,` (or go to `Cursor` > `Settings`)
   - Navigate to `Features` > `Model Context Protocol` (or search for "MCP")

2. **Add New MCP Server**:
   - Click `+ Add New MCP Server` or `Add Server`
   - Fill in the following:
     - **Name**: `bic-grants` (or any name you prefer)
     - **Command**: `node`
     - **Args**: `/Users/cirne/dev/bic-mcp/server.js`
     - **Type**: `stdio` (should be default)

3. **Save and Restart**:
   - Save the configuration
   - Restart Cursor or reload the window
   - The server should appear in your MCP servers list

## Verification

After setup, you should be able to use the `list_transactions` tool in Cursor. Try asking:
- "Search for transactions with 'Beloved'"
- "Find grants to 'Jesus Image'"

## Troubleshooting

If the server doesn't work:
1. Make sure Node.js is in your PATH (check with `which node`)
2. Verify the server path is correct: `/Users/cirne/dev/bic-mcp/server.js`
3. Check Cursor's MCP logs (usually in the Output panel or MCP section)
4. Test the server manually: `node /Users/cirne/dev/bic-mcp/server.js`


