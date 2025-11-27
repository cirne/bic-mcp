#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Spawn the MCP server as a child process
const serverPath = join(__dirname, 'server.js');
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'inherit']
});

let requestId = 1;

// Send a JSON-RPC request
function sendRequest(method, params) {
  const request = {
    jsonrpc: '2.0',
    id: requestId++,
    method: method,
    params: params
  };
  
  const message = JSON.stringify(request) + '\n';
  server.stdin.write(message);
}

// Handle responses
let buffer = '';
server.stdout.on('data', (data) => {
  buffer += data.toString();
  
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        const response = JSON.parse(line);
        if (response.result) {
          if (response.result.content && response.result.content[0]) {
            const transactions = JSON.parse(response.result.content[0].text);
            console.log(`\nFound ${transactions.length} transactions from 2024 above $25,000:\n`);
            transactions.forEach((t, i) => {
              const amount = parseFloat((t.Amount || '').replace(/,/g, '').replace(/\s/g, '')) || 0;
              console.log(`${i + 1}. ${t.Charity} - $${amount.toLocaleString()} (Sent: ${t['Sent Date']})`);
            });
            console.log(`\nTotal: ${transactions.length} transactions`);
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }
});

server.on('error', (error) => {
  console.error('Server error:', error);
  process.exit(1);
});

server.on('exit', (code) => {
  process.exit(code);
});

// Wait for server to initialize, then test
setTimeout(() => {
  console.log('Testing: Transactions from 2024 above $25,000...\n');
  sendRequest('tools/call', {
    name: 'list_transactions',
    arguments: {
      year: 2024,
      min_amount: 25000
    }
  });
  
  setTimeout(() => {
    server.kill();
  }, 2000);
}, 1000);



