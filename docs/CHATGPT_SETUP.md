# Setting Up ChatGPT with BIC Grants MCP Server

This guide explains how to connect ChatGPT (Desktop, Web, or iOS) to your deployed BIC Grants MCP Server.

## Prerequisites

- ChatGPT Desktop app, Web app (chat.openai.com or chatgpt.com), or iOS app installed
- Access to your deployed MCP server URL (e.g., `https://your-project.vercel.app/{guid}/mcp` where `{guid}` is your MCP_GUID)
- Your MCP GUID (provided by the server administrator - acts as the security token)
- Your MCP API key (optional, if additional authentication is configured)

## Step 1: Enable Developer Mode

### Desktop App
1. Open ChatGPT Desktop
2. Click on your profile icon in the bottom-left corner
3. Select **Settings**
4. Navigate to **Apps & Connectors**
5. Scroll down to **Advanced settings**
6. Toggle on **Developer mode**

### Web App
1. Go to [chat.openai.com](https://chat.openai.com) or [chatgpt.com](https://chatgpt.com)
2. Click on your profile icon in the bottom-left corner
3. Select **Settings**
4. Navigate to **Apps & Connectors**
5. Scroll down to **Advanced settings**
6. Toggle on **Developer mode**

**Note for Business/Enterprise Plans:** Only admins or owners can enable Developer Mode. Navigate to **Workspace Settings** → **Permissions & Roles** → **Connected Data Developer Mode** to enable it.

### iOS App
1. Open the ChatGPT app on your iOS device
2. Navigate to **Settings**
3. Select **Apps & Connectors**
4. Tap on **Advanced Settings**
5. Toggle **Developer Mode** to the "On" position

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

## Step 4: Configure Tool Approval (Bypass Confirmations)

By default, ChatGPT requires confirmation for each tool invocation. The method to bypass these confirmations varies by platform:

**⚠️ Important:** The iOS app currently does **not** provide any option to bypass tool confirmations. Each tool invocation requires manual confirmation. This is a known limitation of the iOS app.

> **Note:** For detailed research findings and platform-specific solutions, see [MCP_APPROVAL_RESEARCH.md](./MCP_APPROVAL_RESEARCH.md)

### Option A: Desktop App (Persistent Configuration)

For ChatGPT Desktop, you can configure persistent auto-approval by editing the `mcp_config.json` configuration file.

#### Locate the Configuration File

The configuration file is located at:
- **macOS**: `~/Library/Application Support/OpenAI/ChatGPT/mcp_config.json`
- **Windows**: `%APPDATA%\OpenAI\ChatGPT\mcp_config.json`
- **Linux**: `~/.config/OpenAI/ChatGPT/mcp_config.json`

If the file doesn't exist, create it.

#### Configure Auto-Approve for BIC Grants Tools

Edit the `mcp_config.json` file and add your connector configuration with an `autoApprove` array listing all the tools you want to auto-approve:

```json
{
  "mcpServers": {
    "BIC Grants": {
      "url": "https://your-project.vercel.app/{guid}/mcp",
      "autoApprove": [
        "list_transactions",
        "list_grantees",
        "show_grantee",
        "aggregate_transactions"
      ]
    }
  }
}
```

**Important Notes:**
- Replace `{guid}` with your actual MCP_GUID
- Replace `"BIC Grants"` with the exact name you used when creating the connector in Step 2 (must match exactly, including capitalization)
- The `autoApprove` array lists all tool names that should execute without confirmation
- After editing, **restart ChatGPT Desktop** for changes to take effect
- If the connector was added through the UI, you may need to check the existing `mcp_config.json` file to see how it's stored, or add this configuration alongside any existing entries

#### Alternative: Global Approval Policy (Desktop Only)

If you want to auto-approve all tools from all MCP servers (not recommended for security), you can set a global approval policy:

```json
{
  "approval_policy": "never",
  "mcpServers": {
    "BIC Grants": {
      "url": "https://your-project.vercel.app/{guid}/mcp"
    }
  }
}
```

**Approval Policy Options:**
- `"never"`: Never prompt for approval (all tools execute automatically)
- `"on-request"`: Prompt for approval whenever a tool is requested
- `"on-failure"`: Prompt for approval only when a tool fails
- `"untrusted"`: Prompt for approval when executing commands from untrusted sources

**Security Warning:** Setting `approval_policy` to `"never"` grants full autonomy to all MCP servers. Only use this if you completely trust all connected servers. The per-server `autoApprove` approach is safer.

### Option B: Web App (Browser Extension)

For ChatGPT Web App, you can use the **"MCP Auto Accept for ChatGPT"** browser extension to automatically handle confirmation dialogs.

#### Install the Extension

1. **Chrome/Edge/Brave**: Visit the [Chrome Web Store](https://chromewebstore.google.com/detail/mcp-auto-accept-for-chatg/hgmlcoonafjeljbcndajnambopiccndg) and click "Add to Chrome"
2. **Firefox**: Search for the extension in Firefox Add-ons (if available)

#### Use the Extension

1. After installation, click the extension icon in your browser toolbar
2. Toggle the extension **On** to enable auto-accept
3. The extension will automatically:
   - Detect ChatGPT confirmation dialogs
   - Check the "don't ask again" checkbox
   - Click the confirm button

**Note:** This extension works for Chrome-based browsers. Safari on macOS/iOS does not support browser extensions in the same way.

### Option C: Session-Based "Remember Approval" (Web Only - May Not Be Available)

**Note:** As of the current ChatGPT version, the "remember approval" checkbox may not be available in all confirmation dialogs. This feature appears to be inconsistently implemented or may have been removed. **The iOS app does not have this feature at all** - confirmation dialogs only show "Confirm" and "Deny" buttons with no checkbox option.

If available on the web app:
1. When ChatGPT prompts you to confirm a tool invocation, look for a checkbox labeled **"Don't ask again"** or **"Remember this approval"**
2. Check this box before confirming
3. For the remainder of that conversation session, ChatGPT will automatically approve that tool without prompting

**Limitations:**
- Only applies to the current conversation session
- Resets when you start a new chat or refresh the page
- You must do this for each tool individually
- Not persistent across sessions
- **May not be available** - the checkbox may not appear in all confirmation dialogs
- **Not available on iOS** - iOS confirmation dialogs do not include this option

### Recommendation

- **Desktop App**: Use Option A (persistent configuration file) for the best experience - this is the only reliable way to bypass confirmations
- **Web App**: Use Option B (browser extension) for persistent auto-approval - this is the most reliable solution for web
- **iOS App**: **Unfortunately, there is currently no way to bypass tool confirmations on iOS**. Each tool invocation requires manual confirmation. This is a limitation of the iOS app at this time. Consider using the web app with the browser extension for a better experience.

### Note About Read-Only Tools

**✅ UPDATE:** All BIC Grants MCP tools are read-only (they only query data, never modify it) and now include the `readOnlyHint: true` annotation. According to OpenAI's documentation:

> "In contrast, read actions, which involve retrieving or searching for information without altering external systems, do not require such confirmations."
>
> "ChatGPT respects the `readOnlyHint` tool annotation to identify read-only tools, any tool without this hint is treated as a write action and will prompt for confirmation accordingly."

**Source**: https://platform.openai.com/docs/guides/developer-mode

**After deploying this update**, ChatGPT should recognize these tools as read-only and may not require confirmations (or require fewer confirmations). However, platform-specific limitations may still apply:
- **iOS**: May still require confirmations due to platform limitations
- **Web**: Should work better with the annotation, but browser extension is still recommended for reliability
- **Desktop**: Should work best with both the annotation and `mcp_config.json` configuration

## Step 5: Test the Connection

### Desktop/Web App
1. Start a new chat in ChatGPT
2. Click the **+** button near the message composer (or select **Developer Mode** from the Plus menu)
3. Select **More** or **Connectors**
4. Choose your **BIC Grants** connector
5. Try asking ChatGPT to use the MCP server:
   - "List the top 10 grantees by total amount"
   - "Show me all grants to [Charity Name]"
   - "Find all grants from 2024"

### iOS App
1. Start a new chat in the ChatGPT iOS app
2. Tap the **+** button or select your connector from the available options
3. Choose your **BIC Grants** connector
4. Try asking ChatGPT to use the MCP server with the same queries above

If you configured auto-approval correctly (via config file, browser extension, or "remember approval"), tool invocations should execute without confirmation prompts.

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

4. **Review Logs**: Check ChatGPT logs for connection errors (Desktop app logs or browser console for web app)

### 401 Unauthorized Error

- Verify your API key is correct
- Ensure the API key is being sent in requests (check connector configuration)
- Confirm the API key is set in Vercel environment variables

### Tools Not Available

- Ensure the connector is enabled in your current chat
- Try restarting ChatGPT (Desktop app) or refreshing the page (Web app)
- Verify the MCP server is responding correctly
- For web app, ensure Developer Mode is enabled in your account settings

## Security Notes

- **Keep your API key secure**: Don't share it publicly or commit it to version control
- **Rotate keys regularly**: Generate new API keys periodically for better security
- **Monitor usage**: Check Vercel logs to monitor API usage and detect any unauthorized access

## Getting Help

If you encounter issues:

1. Check the [DEPLOY.md](./DEPLOY.md) for server-side troubleshooting
2. Verify your MCP server is accessible via curl/Postman
3. Review ChatGPT documentation for connector setup (varies by platform)
4. Contact the server administrator for API key or access issues

