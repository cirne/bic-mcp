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
const responses = [];
let testIndex = 0;

// Test cases to run
const tests = [
  {
    name: 'List all tools',
    method: 'tools/list',
    params: {}
  },
  {
    name: 'list_transactions: Search with search_term',
    method: 'tools/call',
    params: {
      name: 'list_transactions',
      arguments: {
        search_term: 'Beloved'
      }
    }
  },
  {
    name: 'list_transactions: Filter by exact charity',
    method: 'tools/call',
    params: {
      name: 'list_transactions',
      arguments: {
        charity: 'Young Life'
      }
    }
  },
  {
    name: 'list_transactions: Filter by year (2024)',
    method: 'tools/call',
    params: {
      name: 'list_transactions',
      arguments: {
        year: 2024
      }
    }
  },
  {
    name: 'list_transactions: Filter by year range (min_year)',
    method: 'tools/call',
    params: {
      name: 'list_transactions',
      arguments: {
        min_year: 2023
      }
    }
  },
  {
    name: 'list_transactions: Filter by year range (min_year and max_year)',
    method: 'tools/call',
    params: {
      name: 'list_transactions',
      arguments: {
        min_year: 2023,
        max_year: 2024
      }
    }
  },
  {
    name: 'list_transactions: Filter by amount (min_amount)',
    method: 'tools/call',
    params: {
      name: 'list_transactions',
      arguments: {
        min_amount: 25000
      }
    }
  },
  {
    name: 'list_transactions: Filter by amount range',
    method: 'tools/call',
    params: {
      name: 'list_transactions',
      arguments: {
        min_amount: 10000,
        max_amount: 50000
      }
    }
  },
  {
    name: 'list_transactions: Combined filters (year + amount)',
    method: 'tools/call',
    params: {
      name: 'list_transactions',
      arguments: {
        year: 2024,
        min_amount: 25000
      }
    }
  },
  {
    name: 'list_transactions: Sort by Amount (desc)',
    method: 'tools/call',
    params: {
      name: 'list_transactions',
      arguments: {
        sort_by: 'Amount',
        sort_order: 'desc',
        fields: ['Charity', 'Amount', 'Sent Date']
      }
    }
  },
  {
    name: 'list_transactions: Sort by Sent Date (desc)',
    method: 'tools/call',
    params: {
      name: 'list_transactions',
      arguments: {
        sort_by: 'Sent Date',
        sort_order: 'desc',
        fields: ['Charity', 'Amount', 'Sent Date']
      }
    }
  },
  {
    name: 'list_transactions: Group by year',
    method: 'tools/call',
    params: {
      name: 'list_transactions',
      arguments: {
        group_by: 'year'
      }
    }
  },
  {
    name: 'list_transactions: Group by year with fields',
    method: 'tools/call',
    params: {
      name: 'list_transactions',
      arguments: {
        group_by: 'year',
        fields: ['Charity', 'Amount', 'Sent Date']
      }
    }
  },
  {
    name: 'list_transactions: Select specific fields',
    method: 'tools/call',
    params: {
      name: 'list_transactions',
      arguments: {
        fields: ['Charity', 'Amount', 'Sent Date', 'Grant Purpose']
      }
    }
  },
  {
    name: 'list_transactions: Error - invalid year',
    method: 'tools/call',
    params: {
      name: 'list_transactions',
      arguments: {
        year: 1800
      }
    },
    expectError: true
  },
  {
    name: 'list_grantees: List all grantees',
    method: 'tools/call',
    params: {
      name: 'list_grantees',
      arguments: {}
    }
  },
  {
    name: 'list_grantees: Sort by name',
    method: 'tools/call',
    params: {
      name: 'list_grantees',
      arguments: {
        sort_by: 'name',
        sort_order: 'asc'
      }
    }
  },
  {
    name: 'list_grantees: Sort by recent_date (desc)',
    method: 'tools/call',
    params: {
      name: 'list_grantees',
      arguments: {
        sort_by: 'recent_date',
        sort_order: 'desc'
      }
    }
  },
  {
    name: 'list_grantees: Filter by year (2024)',
    method: 'tools/call',
    params: {
      name: 'list_grantees',
      arguments: {
        year: 2024
      }
    }
  },
  {
    name: 'list_grantees: Filter by year (2023)',
    method: 'tools/call',
    params: {
      name: 'list_grantees',
      arguments: {
        year: 2023
      }
    }
  },
  {
    name: 'list_grantees: Error - invalid year',
    method: 'tools/call',
    params: {
      name: 'list_grantees',
      arguments: {
        year: 1800
      }
    },
    expectError: true
  },
  {
    name: 'show_grantee: Show specific grantee',
    method: 'tools/call',
    params: {
      name: 'show_grantee',
      arguments: {
        charity: 'Young Life'
      }
    }
  },
  {
    name: 'show_grantee: Error - grantee not found',
    method: 'tools/call',
    params: {
      name: 'show_grantee',
      arguments: {
        charity: 'Non-existent Charity Name'
      }
    },
    expectError: true
  },
  {
    name: 'show_grantee: Error - missing charity parameter',
    method: 'tools/call',
    params: {
      name: 'show_grantee',
      arguments: {}
    },
    expectError: true
  }
];

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
        responses.push(response);
        
        // Process response
        if (response.id && response.id <= tests.length) {
          const test = tests[response.id - 1];
          if (test) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`Test ${response.id}: ${test.name}`);
            console.log('='.repeat(60));
            
            if (response.error) {
              console.log('❌ ERROR:', response.error.message || JSON.stringify(response.error));
              if (!test.expectError) {
                console.log('⚠️  Unexpected error!');
              } else {
                console.log('✅ Expected error received');
              }
            } else if (response.result) {
              if (test.expectError) {
                console.log('⚠️  Expected error but got success!');
              } else {
                console.log('✅ Success');
                
                // Pretty print results for certain tools
                if (response.result.content && response.result.content[0]) {
                  try {
                    const data = JSON.parse(response.result.content[0].text);
                    
                    if (test.method === 'tools/list') {
                      console.log(`\nFound ${data.tools.length} tools:`);
                      data.tools.forEach(tool => {
                        console.log(`  - ${tool.name}: ${tool.description}`);
                      });
                    } else if (test.params.name === 'list_transactions') {
                      if (Array.isArray(data)) {
                        console.log(`\nFound ${data.length} transactions`);
                        if (data.length > 0 && data.length <= 5) {
                          console.log('\nSample transactions:');
                          data.slice(0, 3).forEach((t, i) => {
                            const amount = parseFloat((t.Amount || '').replace(/,/g, '').replace(/\s/g, '')) || 0;
                            console.log(`  ${i + 1}. ${t.Charity || 'N/A'} - $${amount.toLocaleString()} (${t['Sent Date'] || 'N/A'})`);
                          });
                        }
                      } else if (typeof data === 'object') {
                        // Grouped results
                        const groups = Object.keys(data);
                        console.log(`\nGrouped into ${groups.length} groups:`);
                        groups.forEach(group => {
                          const items = Array.isArray(data[group]) ? data[group] : [];
                          console.log(`  ${group}: ${items.length} transactions`);
                        });
                      }
                    } else if (test.params.name === 'list_grantees') {
                      if (Array.isArray(data)) {
                        console.log(`\nFound ${data.length} grantees`);
                        if (data.length > 0) {
                          console.log('\nSample grantees:');
                          data.slice(0, 5).forEach((g, i) => {
                            const total = g.total_amount || 0;
                            console.log(`  ${i + 1}. ${g.name} (EIN: ${g.ein})`);
                            console.log(`     Transactions: ${g.transaction_count}, Total: $${total.toLocaleString()}`);
                          });
                          
                          // Calculate totals
                          const totalTransactions = data.reduce((sum, g) => sum + (g.transaction_count || 0), 0);
                          const totalAmount = data.reduce((sum, g) => sum + (g.total_amount || 0), 0);
                          console.log(`\n  Summary: ${totalTransactions} total transactions, $${totalAmount.toLocaleString()} total amount`);
                        }
                      }
                    } else if (test.params.name === 'show_grantee') {
                      if (data.metadata) {
                        console.log(`\nGrantee: ${data.metadata.name}`);
                        console.log(`  EIN: ${data.metadata.ein}`);
                        console.log(`  Total Grants: ${data.metadata.total_grants}`);
                        console.log(`  Total Amount: $${data.metadata.total_amount.toLocaleString()}`);
                        console.log(`  Year Range: ${data.metadata.first_grant_year || 'N/A'} - ${data.metadata.last_grant_year || 'N/A'}`);
                        
                        if (data.yearly_totals && data.yearly_totals.length > 0) {
                          console.log('\n  Yearly Totals:');
                          data.yearly_totals.slice(0, 5).forEach(yt => {
                            console.log(`    ${yt.year}: ${yt.count} grants, $${yt.total_amount.toLocaleString()}`);
                          });
                        }
                        
                        if (data.transactions) {
                          console.log(`\n  Transaction History: ${data.transactions.length} transactions`);
                        }
                      }
                    }
                  } catch (e) {
                    console.log('Response data:', response.result.content[0].text.substring(0, 200));
                  }
                }
              }
            }
          }
        }
        
        // Run next test
        if (testIndex < tests.length) {
          setTimeout(() => {
            const test = tests[testIndex];
            sendRequest(test.method, test.params);
            testIndex++;
          }, 500);
        } else {
          // All tests complete
          setTimeout(() => {
            console.log(`\n${'='.repeat(60)}`);
            console.log('All tests complete!');
            console.log('='.repeat(60));
            server.kill();
          }, 500);
        }
      } catch (e) {
        // Ignore parse errors for non-JSON lines
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

// Wait for server to initialize, then start tests
setTimeout(() => {
  console.log('=== Starting Comprehensive MCP Server Tests ===');
  console.log(`Running ${tests.length} test cases...\n`);
  
  // Start with first test
  const test = tests[testIndex];
  sendRequest(test.method, test.params);
  testIndex++;
}, 1000);
