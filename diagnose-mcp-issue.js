#!/usr/bin/env node

/**
 * Diagnostic script to compare MCP tool responses and identify issues
 */

const BASE_URL = 'https://bic-mcp.vercel.app/b40824d4-266f-490b-83ee-7fe5c5a85ef9/mcp';

async function testTool(name, args) {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Math.floor(Math.random() * 1000),
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  });

  const data = await response.json();
  return { status: response.status, data };
}

async function diagnose() {
  console.log('=== MCP Tool Response Diagnosis ===\n');

  const tests = [
    { name: 'show_grantee', args: { charity: 'Pine Cove' }, expectedType: 'object' },
    { name: 'list_grantees', args: { year: 2025 }, expectedType: 'array' },
    { name: 'aggregate_transactions', args: { group_by: 'is_beloved', year: 2025 }, expectedType: 'array' },
    { name: 'list_transactions', args: { charity: 'Pine Cove', year: 2025 }, expectedType: 'array' },
  ];

  for (const test of tests) {
    console.log(`\nTesting: ${test.name}`);
    console.log('─'.repeat(50));
    
    try {
      const { status, data } = await testTool(test.name, test.args);
      
      console.log(`HTTP Status: ${status}`);
      console.log(`Has error: ${!!data.error}`);
      
      if (data.error) {
        console.log(`Error: ${JSON.stringify(data.error, null, 2)}`);
        continue;
      }

      const result = data.result;
      if (!result) {
        console.log('❌ No result field');
        continue;
      }

      const hasContent = result.hasOwnProperty('content');
      const hasStructuredContent = result.hasOwnProperty('structuredContent');
      
      console.log(`Has content field: ${hasContent}`);
      console.log(`Has structuredContent field: ${hasStructuredContent}`);

      if (hasContent) {
        const content = result.content;
        console.log(`Content type: ${Array.isArray(content) ? 'array' : typeof content}`);
        if (Array.isArray(content)) {
          console.log(`Content length: ${content.length}`);
          if (content.length > 0) {
            console.log(`Content[0] type: ${content[0]?.type || 'N/A'}`);
            console.log(`Content[0] has text: ${!!content[0]?.text}`);
            if (content[0]?.text) {
              try {
                const parsed = JSON.parse(content[0].text);
                console.log(`Content[0].text parses to: ${Array.isArray(parsed) ? 'array' : typeof parsed}`);
              } catch (e) {
                console.log(`Content[0].text parse error: ${e.message}`);
              }
            }
          }
        }
      }

      if (hasStructuredContent) {
        const sc = result.structuredContent;
        const scType = Array.isArray(sc) ? 'array' : sc === null ? 'null' : typeof sc;
        console.log(`structuredContent type: ${scType}`);
        if (Array.isArray(sc)) {
          console.log(`structuredContent length: ${sc.length}`);
        } else if (sc && typeof sc === 'object') {
          console.log(`structuredContent keys: ${Object.keys(sc).join(', ')}`);
        }
      }

      // Check if content matches structuredContent
      if (hasContent && hasStructuredContent) {
        try {
          const contentText = result.content?.[0]?.text;
          if (contentText) {
            const parsedContent = JSON.parse(contentText);
            const sc = result.structuredContent;
            const matches = JSON.stringify(parsedContent) === JSON.stringify(sc);
            console.log(`Content matches structuredContent: ${matches}`);
            if (!matches) {
              console.log('⚠️  MISMATCH: content and structuredContent differ!');
            }
          }
        } catch (e) {
          console.log(`Could not compare: ${e.message}`);
        }
      }

      // Validate expected type
      if (hasStructuredContent) {
        const sc = result.structuredContent;
        const actualType = Array.isArray(sc) ? 'array' : sc === null ? 'null' : typeof sc;
        const expectedType = test.expectedType;
        if (actualType !== expectedType && sc !== null) {
          console.log(`⚠️  Type mismatch: expected ${expectedType}, got ${actualType}`);
        } else {
          console.log(`✅ Type matches: ${actualType}`);
        }
      }

      // Check MCP protocol compliance
      const issues = [];
      if (!hasStructuredContent && !hasContent) {
        issues.push('Missing both content and structuredContent');
      }
      if (hasStructuredContent && !hasContent) {
        issues.push('Has structuredContent but missing content (MCP spec requires both)');
      }
      if (hasContent && !hasStructuredContent) {
        issues.push('Has content but missing structuredContent (tool has outputSchema)');
      }

      if (issues.length > 0) {
        console.log('\n❌ Protocol Issues:');
        issues.forEach(issue => console.log(`  - ${issue}`));
      } else {
        console.log('\n✅ Protocol compliant');
      }

    } catch (error) {
      console.log(`❌ Test failed: ${error.message}`);
      console.error(error);
    }
  }

  console.log('\n=== Diagnosis Complete ===');
}

diagnose().catch(console.error);
