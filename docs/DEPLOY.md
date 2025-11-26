# Deploying to Vercel

This guide walks you through deploying the BIC Grants MCP Server to Vercel.

## Prerequisites

- A Vercel account ([sign up here](https://vercel.com/signup))
- Git repository with your code
- Node.js 20+ (specified in `.nvmrc`)

## Deployment Steps

### 1. Connect Repository to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your Git repository
4. Vercel will auto-detect Next.js

### 2. Configure Environment Variables

In the Vercel project settings, add the following environment variables:

- **`MCP_GUID`** (Required): A GUID used in the endpoint path `/{guid}/mcp`
  - Generate a GUID: `node -e "console.log(require('crypto').randomUUID())"`
  - This acts as a security token - only requests with the correct GUID in the path will work
  - Share this GUID with authorized users who need access to the MCP server
  - Example: `db7779a6-cd30-466a-a564-00c44fd06e76`

- **`MCP_API_KEY`** (Optional): A secure random string for additional authentication
  - Generate a secure key: `openssl rand -hex 32`
  - This key will be required in the `Authorization: Bearer <key>` header or `X-API-Key` header
  - Share this key with authorized users who need access to the MCP server

### 3. Deploy

1. Vercel will automatically build and deploy on push to your main branch
2. Or click "Deploy" to deploy immediately
3. Wait for the build to complete

### 4. Get Your MCP Server URL

After deployment, you can get your MCP server URL in two ways:

#### Option A: Check Status Endpoint

Visit the status endpoint to verify configuration (does NOT expose the GUID):
```
https://your-project.vercel.app/api/status
```

This will return a JSON response indicating:
- Whether the GUID is configured (but not the actual GUID value)
- Configuration status
- Instructions on how to get your GUID from Vercel

Example response:
```json
{
  "status": "configured",
  "hasGuid": true,
  "hasApiKey": true,
  "endpointFormat": "{baseUrl}/{guid}/mcp",
  "baseUrl": "https://your-project.vercel.app",
  "instructions": "MCP endpoint is configured. Get your GUID from Vercel environment variables to construct the full URL.",
  "howToGetGuid": [
    "1. Go to your Vercel project dashboard",
    "2. Navigate to Settings → Environment Variables",
    "3. Find and copy your MCP_GUID value",
    "4. Construct your endpoint URL: {baseUrl}/{MCP_GUID}/mcp"
  ],
  "note": "Keep your GUID secret - it acts as a security token. Do not expose it publicly."
}
```

**Note**: The status endpoint does NOT expose your GUID for security reasons. You must get it from Vercel's environment variables.

#### Option B: Construct URL Manually

1. Go to your Vercel project settings
2. Navigate to **Settings** → **Environment Variables**
3. Find your `MCP_GUID` value
4. Construct the URL: `https://your-project.vercel.app/{your-guid}/mcp`

**Important**: Keep your GUID secret! Anyone with the GUID can access your MCP endpoint.

## Testing the Deployment

### Test the MCP Endpoint

```bash
# List available tools (replace {guid} with your MCP_GUID)
curl https://your-project.vercel.app/{guid}/mcp \
  -H "Authorization: Bearer YOUR_API_KEY"

# Call a tool
curl https://your-project.vercel.app/{guid}/mcp \
  -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "list_grantees",
    "arguments": {
      "sort_by": "total_amount",
      "sort_order": "desc"
    }
  }'
```

## Updating Data Files

To update the CSV data files:

1. Update files in the `data/` directory
2. Commit and push to your repository
3. Vercel will automatically rebuild and redeploy
4. The new data will be loaded on the next request

## Troubleshooting

### Build Fails

- Ensure all dependencies are in `package.json`
- Check that Node.js version matches `.nvmrc`
- Review build logs in Vercel dashboard

### API Returns 401 Unauthorized

- Verify `MCP_API_KEY` is set in Vercel environment variables
- Check that you're sending the API key in the request header:
  - `Authorization: Bearer <key>` or
  - `X-API-Key: <key>`

### Data Not Loading

- Verify CSV files are in the `data/` directory
- Check that files have `.csv` extension
- Ensure CSV files have proper headers (including "Transaction ID")

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `MCP_GUID` | **Yes** | GUID used in the endpoint path `/{guid}/mcp`. Acts as a security token. Generate with: `node -e "console.log(require('crypto').randomUUID())"` |
| `MCP_API_KEY` | No* | API key for additional authentication. If not set, only GUID is required (GUID still provides security) |
| `DATA_DIR` | No | Custom path to data directory (defaults to `./data`) |

*Optional - GUID provides primary security layer

## Quick Reference: Getting Your Endpoint URL

After deployment, get your GUID from Vercel (the status endpoint does NOT expose it):

1. **Vercel Dashboard** (recommended):
   - Go to your project → Settings → Environment Variables
   - Find and copy your `MCP_GUID` value
   - Construct: `https://your-project.vercel.app/{MCP_GUID}/mcp`

2. **Vercel CLI**:
   ```bash
   vercel env pull .env.local
   # Then check MCP_GUID in .env.local
   ```

3. **Verify configuration** (doesn't show GUID):
   ```bash
   curl https://your-project.vercel.app/api/status
   ```
   This confirms the GUID is set but doesn't reveal it.

**Security**: Never expose your GUID publicly. Only share it with authorized users who need access to the MCP server.

