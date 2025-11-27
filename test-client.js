#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Spawn the MCP server as a child process
const serverPath = join(__dirname, 'server.js');
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'inherit'] // stdin, stdout, stderr
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
  console.log('Sending:', message.trim());
  server.stdin.write(message);
}

// Handle responses
let buffer = '';
server.stdout.on('data', (data) => {
  buffer += data.toString();
  
  // Process complete JSON-RPC messages (separated by newlines)
  const lines = buffer.split('\n');
  buffer = lines.pop() || ''; // Keep incomplete line in buffer
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        const response = JSON.parse(line);
        console.log('\nReceived:', JSON.stringify(response, null, 2));
      } catch (e) {
        console.log('Raw output:', line);
      }
    }
  }
});

server.on('error', (error) => {
  console.error('Server error:', error);
  process.exit(1);
});

server.on('exit', (code) => {
  console.log(`\nServer exited with code ${code}`);
  process.exit(code);
});

// Wait a moment for server to initialize, then test
setTimeout(() => {
  console.log('=== Testing MCP Server ===\n');
  
  // Test 1: List tools
  console.log('1. Listing available tools...');
  sendRequest('tools/list', {});
  
  setTimeout(() => {
    // Test 2: Call list_transactions
    console.log('\n2. Searching for transactions with "Beloved"...');
    sendRequest('tools/call', {
      name: 'list_transactions',
      arguments: {
        search_term: 'Beloved'
      }
    });
    
    setTimeout(() => {
      // Test 3: Another search
      console.log('\n3. Searching for transactions with "Jesus"...');
      sendRequest('tools/call', {
        name: 'list_transactions',
        arguments: {
          search_term: 'Jesus'
        }
      });
      
      setTimeout(() => {
        console.log('\n=== Tests complete, shutting down ===');
        server.kill();
      }, 2000);
    }, 2000);
  }, 2000);
}, 1000);




