# Setting Up ChatGPT Desktop with BIC Grants MCP Server

This guide explains how to connect ChatGPT Desktop to your deployed BIC Grants MCP Server.

## Prerequisites

- ChatGPT Desktop app installed
- Access to your deployed MCP server URL (e.g., `https://your-project.vercel.app/{guid}/mcp` where `{guid}` is your MCP_GUID)
- Your MCP GUID (provided by the server administrator - acts as the security token)
- Your MCP API key (optional, if additional authentication is configured)

## Step 1: Enable Developer Mode

1. Open ChatGPT Desktop
2. Click on your profile icon in the bottom-left corner
3. Select **Settings**
4. Navigate to **Apps & Connectors**
5. Scroll down to **Advanced settings**
6. Toggle on **Developer mode**

## Step 2: Create a Connector

1. In the **Apps & Connectors** section, click **Create** (or **Add Connector**)
2. Fill in the connector details:
   - **Name**: `BIC Grants` (or any name you prefer)
   - **Description**: `MCP server for querying BIC grant transaction data` (optional)
   - **Connector URL**: `https://your-project.vercel.app/{guid}/mcp` (replace `{guid}` with your actual MCP_GUID)
   - **API Key**: Enter your MCP API key here (if the connector UI supports it)
3. Click **Create** to save the connector

## Step 3: Configure API Key Authentication

Since ChatGPT Desktop may not have a built-in API key field, you may need to configure authentication differently:

### Option A: URL Parameter (if supported)
Some MCP implementations support API keys as URL parameters:
```
https://your-project.vercel.app/{guid}/mcp?api_key=YOUR_API_KEY
```
(Replace `{guid}` with your actual MCP_GUID)

### Option B: Custom Header Configuration
If ChatGPT Desktop allows custom headers, configure:
- **Header Name**: `Authorization`
- **Header Value**: `Bearer YOUR_API_KEY`

Or:
- **Header Name**: `X-API-Key`
- **Header Value**: `YOUR_API_KEY`

## Step 4: Test the Connection

1. Start a new chat in ChatGPT Desktop
2. Click the **+** button near the message composer
3. Select **More** or **Connectors**
4. Choose your **BIC Grants** connector
5. Try asking ChatGPT to use the MCP server:
   - "List the top 10 grantees by total amount"
   - "Show me all grants to [Charity Name]"
   - "Find all grants from 2024"

## Available Tools

Once connected, ChatGPT can use these MCP tools:

### `list_transactions`
Search and filter grant transactions with advanced options.

**Example queries:**
- "Find all grants over $25,000 in 2024"
- "Show me grants to [Charity Name] sorted by date"
- "List grants with 'education' in the purpose"

### `list_grantees`
List all grantees with aggregated totals.

**Example queries:**
- "Show me the top 10 grantees by total amount"
- "List all grantees that received grants in 2024"
- "Which charities received the most grants?"

### `show_grantee`
Get detailed information about a specific grantee.

**Example queries:**
- "Show me details about [Charity Name]"
- "What grants did [Charity Name] receive?"

## Troubleshooting

### Connector Not Working

1. **Verify the URL**: Ensure the connector URL is correct and accessible
   ```bash
   curl https://your-project.vercel.app/{guid}/mcp \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```
   (Replace `{guid}` with your actual MCP_GUID)

2. **Check API Key**: Verify your API key is correct and matches the one set in Vercel

3. **Check Developer Mode**: Ensure Developer Mode is enabled in ChatGPT settings

4. **Review Logs**: Check ChatGPT Desktop logs for connection errors

### 401 Unauthorized Error

- Verify your API key is correct
- Ensure the API key is being sent in requests (check connector configuration)
- Confirm the API key is set in Vercel environment variables

### Tools Not Available

- Ensure the connector is enabled in your current chat
- Try restarting ChatGPT Desktop
- Verify the MCP server is responding correctly

## Security Notes

- **Keep your API key secure**: Don't share it publicly or commit it to version control
- **Rotate keys regularly**: Generate new API keys periodically for better security
- **Monitor usage**: Check Vercel logs to monitor API usage and detect any unauthorized access

## Getting Help

If you encounter issues:

1. Check the [DEPLOY.md](./DEPLOY.md) for server-side troubleshooting
2. Verify your MCP server is accessible via curl/Postman
3. Review ChatGPT Desktop documentation for connector setup
4. Contact the server administrator for API key or access issues

