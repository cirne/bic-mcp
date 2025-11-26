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

In the Vercel project settings, add the following environment variable:

- **`MCP_API_KEY`**: A secure random string to protect your MCP endpoint
  - Generate a secure key: `openssl rand -hex 32`
  - This key will be required in the `Authorization: Bearer <key>` header or `X-API-Key` header
  - Share this key with authorized users who need access to the MCP server

### 3. Deploy

1. Vercel will automatically build and deploy on push to your main branch
2. Or click "Deploy" to deploy immediately
3. Wait for the build to complete

### 4. Get Your MCP Server URL

After deployment, your MCP server will be available at:
```
https://your-project.vercel.app/api/mcp
```

## Testing the Deployment

### Test the MCP Endpoint

```bash
# List available tools
curl https://your-project.vercel.app/api/mcp \
  -H "Authorization: Bearer YOUR_API_KEY"

# Call a tool
curl https://your-project.vercel.app/api/mcp \
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
| `MCP_API_KEY` | No* | API key for securing the MCP endpoint. If not set, endpoint is publicly accessible (not recommended for production) |
| `DATA_DIR` | No | Custom path to data directory (defaults to `./data`) |

*Required for production deployments

