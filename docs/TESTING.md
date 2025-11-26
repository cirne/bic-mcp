# Local Testing Guide

This guide helps you test the MCP server locally and expose it via ngrok for ChatGPT Desktop integration.

## Prerequisites

- Node.js 20+ (see `.nvmrc`)
- ngrok installed locally
- CSV data files in the `data/` directory

## Step 1: Start the Development Server

In one terminal:

```bash
npm run dev
```

The server will start on `http://localhost:3000`

## Step 2: Test the MCP Endpoint Locally

### Test GET (List Tools)

```bash
curl http://localhost:3000/api/mcp
```

### Test POST (Call a Tool)

```bash
# List top grantees
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "name": "list_grantees",
    "arguments": {
      "sort_by": "total_amount",
      "sort_order": "desc"
    }
  }'
```

```bash
# List transactions
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "name": "list_transactions",
    "arguments": {
      "year": 2024,
      "min_amount": 25000
    }
  }'
```

## Step 3: Expose via ngrok

In another terminal:

```bash
# Option 1: Use the helper script
./start-ngrok.sh

# Option 2: Run ngrok directly
ngrok http 3000
```

ngrok will display a URL like:
```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:3000
```

## Step 4: Test via ngrok URL

Replace `YOUR_NGROK_URL` with your actual ngrok URL:

```bash
# Test GET
curl https://YOUR_NGROK_URL.ngrok-free.app/api/mcp

# Test POST
curl -X POST https://YOUR_NGROK_URL.ngrok-free.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "name": "list_grantees",
    "arguments": {
      "sort_by": "total_amount",
      "sort_order": "desc"
    }
  }'
```

**Note:** If you set `MCP_API_KEY` environment variable, you'll need to include it:

```bash
curl https://YOUR_NGROK_URL.ngrok-free.app/api/mcp \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Step 5: Configure ChatGPT Desktop

1. **Enable Developer Mode** in ChatGPT Desktop:
   - Settings → Apps & Connectors → Advanced settings → Toggle Developer mode

2. **Create Connector**:
   - Settings → Connectors → Create
   - **Name**: `BIC Grants (Local)`
   - **Connector URL**: `https://YOUR_NGROK_URL.ngrok-free.app/api/mcp`
   - **API Key** (if using): Add your API key if you set `MCP_API_KEY`

3. **Test in ChatGPT**:
   - Start a new chat
   - Enable your connector
   - Try: "List the top 10 grantees by total amount"

## Troubleshooting

### ngrok URL changes on restart

- ngrok free tier gives you a new URL each time
- Update the connector URL in ChatGPT Desktop when ngrok restarts
- Consider ngrok paid plan for static domains

### CORS or Connection Issues

- Make sure Next.js dev server is running
- Check ngrok is forwarding correctly: `curl http://localhost:4040/api/tunnels`
- Verify the ngrok URL is accessible in a browser

### API Key Issues

- If you set `MCP_API_KEY`, make sure to include it in requests
- For testing without API key, don't set the environment variable

### Data Not Loading

- Verify CSV files are in the `data/` directory
- Check server logs for loading errors
- Ensure CSV files have proper headers (including "Transaction ID")

## Environment Variables

Create a `.env.local` file (not committed to git) for local testing:

```bash
# Optional: Set API key for testing auth
MCP_API_KEY=test-key-123

# Optional: Custom data directory
DATA_DIR=./data
```

## Next Steps

Once local testing works:
1. Deploy to Vercel (see [DEPLOY.md](./DEPLOY.md))
2. Configure ChatGPT Desktop with production URL (see [CHATGPT_SETUP.md](./CHATGPT_SETUP.md))

