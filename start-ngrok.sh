#!/bin/bash

# Start ngrok tunnel to expose local Next.js server
# Make sure Next.js dev server is running on port 3000 first

echo "Starting ngrok tunnel for http://localhost:3000"
echo "Your MCP endpoint will be available at: https://<ngrok-url>/api/mcp"
echo ""
echo "Press Ctrl+C to stop ngrok"
echo ""

ngrok http 3000

