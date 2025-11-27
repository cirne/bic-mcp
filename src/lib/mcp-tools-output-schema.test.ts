import { describe, it, expect, vi } from 'vitest';
import {
  handleListTransactions,
  handleListGrantees,
  handleShowGrantee,
  handleAggregateTransactions,
} from './mcp-handlers';
import { MCP_TOOLS } from './mcp-tools';
import type { Transaction } from './filters';

// Mock the grantee-metadata module
vi.mock('./grantee-metadata', () => ({
  getGranteeCategory: vi.fn((charity: string, ein: string) => {
    if (charity === 'Test Charity' && ein === '12-3456789') {
      return 'Evangelism';
    }
    if (charity === 'Another Charity' && ein === '98-7654321') {
      return 'Matthew 25';
    }
    return null;
  }),
  getGranteeNotes: vi.fn(() => 'Test notes'),
  getGranteeInternational: vi.fn(() => false),
  getGranteeIsBeloved: vi.fn(() => false),
}));

const mockTransactions: Transaction[] = [
  {
    'Transaction ID': '1',
    'Charity': 'Test Charity',
    'EIN': '12-3456789',
    'Charity Address': '123 Main St',
    'Amount': '5,000.00',
    'Sent Date': '10/2/24',
    'Grant Purpose': 'Test grant purpose',
    'Special Note': 'Test note',
    'Grant Status': 'Payment Cleared',
  },
  {
    'Transaction ID': '2',
    'Charity': 'Another Charity',
    'EIN': '98-7654321',
    'Charity Address': '456 Oak Ave',
    'Amount': '10,000.00',
    'Sent Date': '11/15/24',
    'Grant Purpose': 'Another grant purpose',
    'Grant Status': 'Payment Cleared',
  },
];

// Helper function to validate output against schema
function validateOutputSchema(
  output: any,
  schema: any,
  path: string = 'root'
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (schema.type === 'array') {
    if (!Array.isArray(output)) {
      errors.push(`${path}: Expected array, got ${typeof output}`);
      return { valid: false, errors };
    }
    if (schema.items) {
      output.forEach((item, index) => {
        const itemResult = validateOutputSchema(item, schema.items, `${path}[${index}]`);
        if (!itemResult.valid) {
          errors.push(...itemResult.errors);
        }
      });
    }
  } else if (schema.type === 'object') {
    if (typeof output !== 'object' || output === null || Array.isArray(output)) {
      errors.push(`${path}: Expected object, got ${typeof output}`);
      return { valid: false, errors };
    }

    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in output)) {
          errors.push(`${path}: Missing required field "${field}"`);
        }
      }
    }

    // Check properties
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in output) {
          const value = output[key];
          const propResult = validateOutputSchema(value, propSchema as any, `${path}.${key}`);
          if (!propResult.valid) {
            errors.push(...propResult.errors);
          }
        }
      }
    }
  } else if (schema.type) {
    // Handle union types (e.g., ['string', 'null'])
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actualType = output === null ? 'null' : typeof output;
    
    if (!types.includes(actualType)) {
      errors.push(`${path}: Expected type ${types.join(' or ')}, got ${actualType}`);
    }
  }

  // Handle oneOf schemas
  if (schema.oneOf) {
    let matched = false;
    for (const subSchema of schema.oneOf) {
      const result = validateOutputSchema(output, subSchema, path);
      if (result.valid) {
        matched = true;
        break;
      }
    }
    if (!matched) {
      errors.push(`${path}: Output does not match any of the oneOf schemas`);
    }
  }

  return { valid: errors.length === 0, errors };
}

describe('Output Schema Validation', () => {
  describe('list_transactions output schema', () => {
    it('should match outputSchema for array response (no group_by)', () => {
      const result = handleListTransactions(mockTransactions, {});
      const output = JSON.parse(result.content[0].text);
      const tool = MCP_TOOLS.find(t => t.name === 'list_transactions');
      
      // outputSchema is conditionally included based on ENABLE_OUTPUT_SCHEMA flag
      if (tool?.outputSchema) {
        const validation = validateOutputSchema(output, tool.outputSchema);
        expect(validation.valid).toBe(true);
        if (!validation.valid) {
          console.error('Validation errors:', validation.errors);
        }
      } else {
        // If outputSchema is disabled, just verify the output is valid JSON
        expect(Array.isArray(output)).toBe(true);
      }
    });

    it('should match outputSchema for grouped response (with group_by)', () => {
      const result = handleListTransactions(mockTransactions, {
        group_by: 'Charity',
      });
      const output = JSON.parse(result.content[0].text);
      const tool = MCP_TOOLS.find(t => t.name === 'list_transactions');
      
      // outputSchema is conditionally included based on ENABLE_OUTPUT_SCHEMA flag
      if (tool?.outputSchema) {
        const validation = validateOutputSchema(output, tool.outputSchema);
        expect(validation.valid).toBe(true);
        if (!validation.valid) {
          console.error('Validation errors:', validation.errors);
        }
      } else {
        // If outputSchema is disabled, just verify the output is an object (grouped)
        expect(typeof output).toBe('object');
        expect(Array.isArray(output)).toBe(false);
      }
    });

    it('should include all required transaction fields', () => {
      const result = handleListTransactions(mockTransactions, {});
      const output = JSON.parse(result.content[0].text);
      
      expect(Array.isArray(output)).toBe(true);
      if (output.length > 0) {
        const transaction = output[0];
        expect(transaction).toHaveProperty('Transaction ID');
        expect(transaction).toHaveProperty('Charity');
        expect(transaction).toHaveProperty('Amount');
        expect(transaction).toHaveProperty('Sent Date');
        expect(transaction).toHaveProperty('Category');
        expect(transaction).toHaveProperty('International');
        expect(transaction).toHaveProperty('Is Beloved');
        expect(typeof transaction.International).toBe('boolean');
        expect(typeof transaction['Is Beloved']).toBe('boolean');
      }
    });
  });

  describe('list_grantees output schema', () => {
    it('should match outputSchema', () => {
      const result = handleListGrantees(mockTransactions, {});
      const output = JSON.parse(result.content[0].text);
      const tool = MCP_TOOLS.find(t => t.name === 'list_grantees');
      
      // outputSchema is conditionally included based on ENABLE_OUTPUT_SCHEMA flag
      if (tool?.outputSchema) {
        const validation = validateOutputSchema(output, tool.outputSchema);
        expect(validation.valid).toBe(true);
        if (!validation.valid) {
          console.error('Validation errors:', validation.errors);
        }
      } else {
        // If outputSchema is disabled, just verify the output is an array
        expect(Array.isArray(output)).toBe(true);
      }
    });

    it('should include all required grantee fields', () => {
      const result = handleListGrantees(mockTransactions, {});
      const output = JSON.parse(result.content[0].text);
      
      expect(Array.isArray(output)).toBe(true);
      if (output.length > 0) {
        const grantee = output[0];
        expect(grantee).toHaveProperty('name');
        expect(grantee).toHaveProperty('ein');
        expect(grantee).toHaveProperty('international');
        expect(grantee).toHaveProperty('is_beloved');
        expect(grantee).toHaveProperty('most_recent_grant_note');
        expect(grantee).toHaveProperty('transaction_count');
        expect(grantee).toHaveProperty('total_amount');
        expect(typeof grantee.name).toBe('string');
        expect(typeof grantee.ein).toBe('string');
        expect(typeof grantee.international).toBe('boolean');
        expect(typeof grantee.is_beloved).toBe('boolean');
        expect(typeof grantee.most_recent_grant_note).toBe('string');
        expect(typeof grantee.transaction_count).toBe('number');
        expect(typeof grantee.total_amount).toBe('number');
      }
    });
  });

  describe('show_grantee output schema', () => {
    it('should match outputSchema', () => {
      const result = handleShowGrantee(mockTransactions, {
        charity: 'Test Charity',
      });
      const output = JSON.parse(result.content[0].text);
      const tool = MCP_TOOLS.find(t => t.name === 'show_grantee');
      
      // outputSchema is conditionally included based on ENABLE_OUTPUT_SCHEMA flag
      if (tool?.outputSchema) {
        const validation = validateOutputSchema(output, tool.outputSchema);
        expect(validation.valid).toBe(true);
        if (!validation.valid) {
          console.error('Validation errors:', validation.errors);
        }
      } else {
        // If outputSchema is disabled, just verify the output is an object with expected structure
        expect(typeof output).toBe('object');
        expect(output).toHaveProperty('metadata');
      }
    });

    it('should include all required top-level fields', () => {
      const result = handleShowGrantee(mockTransactions, {
        charity: 'Test Charity',
      });
      const output = JSON.parse(result.content[0].text);
      
      expect(output).toHaveProperty('metadata');
      expect(output).toHaveProperty('status_breakdown');
      expect(output).toHaveProperty('yearly_totals');
      expect(output).toHaveProperty('transactions');
    });

    it('should have correct metadata structure', () => {
      const result = handleShowGrantee(mockTransactions, {
        charity: 'Test Charity',
      });
      const output = JSON.parse(result.content[0].text);
      
      const metadata = output.metadata;
      expect(metadata).toHaveProperty('name');
      expect(metadata).toHaveProperty('ein');
      expect(metadata).toHaveProperty('address');
      expect(metadata).toHaveProperty('category');
      expect(metadata).toHaveProperty('notes');
      expect(metadata).toHaveProperty('international');
      expect(metadata).toHaveProperty('is_beloved');
      expect(metadata).toHaveProperty('total_grants');
      expect(metadata).toHaveProperty('cleared_grants');
      expect(metadata).toHaveProperty('non_cleared_grants');
      expect(metadata).toHaveProperty('total_amount');
      expect(metadata).toHaveProperty('first_grant_year');
      expect(metadata).toHaveProperty('last_grant_year');
      expect(typeof metadata.name).toBe('string');
      expect(typeof metadata.ein).toBe('string');
      expect(typeof metadata.address).toBe('string');
      expect(['string', 'object']).toContain(typeof metadata.category); // string or null
      expect(['string', 'object']).toContain(typeof metadata.notes); // string or null
      expect(typeof metadata.international).toBe('boolean');
      expect(typeof metadata.is_beloved).toBe('boolean');
      expect(typeof metadata.total_grants).toBe('number');
      expect(typeof metadata.cleared_grants).toBe('number');
      expect(typeof metadata.non_cleared_grants).toBe('number');
      expect(typeof metadata.total_amount).toBe('number');
      expect(['number', 'object']).toContain(typeof metadata.first_grant_year); // number or null
      expect(['number', 'object']).toContain(typeof metadata.last_grant_year); // number or null
    });

    it('should have correct status_breakdown structure', () => {
      const result = handleShowGrantee(mockTransactions, {
        charity: 'Test Charity',
      });
      const output = JSON.parse(result.content[0].text);
      
      expect(Array.isArray(output.status_breakdown)).toBe(true);
      if (output.status_breakdown.length > 0) {
        const status = output.status_breakdown[0];
        expect(status).toHaveProperty('status');
        expect(status).toHaveProperty('count');
        expect(status).toHaveProperty('total_amount');
        expect(typeof status.status).toBe('string');
        expect(typeof status.count).toBe('number');
        expect(typeof status.total_amount).toBe('number');
      }
    });

    it('should have correct yearly_totals structure', () => {
      const result = handleShowGrantee(mockTransactions, {
        charity: 'Test Charity',
      });
      const output = JSON.parse(result.content[0].text);
      
      expect(Array.isArray(output.yearly_totals)).toBe(true);
      if (output.yearly_totals.length > 0) {
        const yearly = output.yearly_totals[0];
        expect(yearly).toHaveProperty('year');
        expect(yearly).toHaveProperty('count');
        expect(yearly).toHaveProperty('total_amount');
        expect(typeof yearly.year).toBe('number');
        expect(typeof yearly.count).toBe('number');
        expect(typeof yearly.total_amount).toBe('number');
      }
    });

    it('should have correct transactions array structure', () => {
      const result = handleShowGrantee(mockTransactions, {
        charity: 'Test Charity',
      });
      const output = JSON.parse(result.content[0].text);
      
      expect(Array.isArray(output.transactions)).toBe(true);
      if (output.transactions.length > 0) {
        const transaction = output.transactions[0];
        expect(transaction).toHaveProperty('Transaction ID');
        expect(transaction).toHaveProperty('Charity');
        expect(transaction).toHaveProperty('Amount');
        expect(transaction).toHaveProperty('Sent Date');
      }
    });
  });

  describe('aggregate_transactions output schema', () => {
    it('should match outputSchema for category grouping', () => {
      const result = handleAggregateTransactions(mockTransactions, {
        group_by: 'category',
      });
      const output = JSON.parse(result.content[0].text);
      const tool = MCP_TOOLS.find(t => t.name === 'aggregate_transactions');
      
      // outputSchema is conditionally included based on ENABLE_OUTPUT_SCHEMA flag
      if (tool?.outputSchema) {
        const validation = validateOutputSchema(output, tool.outputSchema);
        expect(validation.valid).toBe(true);
        if (!validation.valid) {
          console.error('Validation errors:', validation.errors);
        }
      } else {
        // If outputSchema is disabled, just verify the output is an array
        expect(Array.isArray(output)).toBe(true);
      }
    });

    it('should match outputSchema for grantee grouping', () => {
      const result = handleAggregateTransactions(mockTransactions, {
        group_by: 'grantee',
      });
      const output = JSON.parse(result.content[0].text);
      const tool = MCP_TOOLS.find(t => t.name === 'aggregate_transactions');
      
      // outputSchema is conditionally included based on ENABLE_OUTPUT_SCHEMA flag
      if (tool?.outputSchema) {
        const validation = validateOutputSchema(output, tool.outputSchema);
        expect(validation.valid).toBe(true);
        if (!validation.valid) {
          console.error('Validation errors:', validation.errors);
        }
      } else {
        // If outputSchema is disabled, just verify the output is an array
        expect(Array.isArray(output)).toBe(true);
      }
    });

    it('should match outputSchema for year grouping', () => {
      const result = handleAggregateTransactions(mockTransactions, {
        group_by: 'year',
      });
      const output = JSON.parse(result.content[0].text);
      const tool = MCP_TOOLS.find(t => t.name === 'aggregate_transactions');
      
      // outputSchema is conditionally included based on ENABLE_OUTPUT_SCHEMA flag
      if (tool?.outputSchema) {
        const validation = validateOutputSchema(output, tool.outputSchema);
        expect(validation.valid).toBe(true);
        if (!validation.valid) {
          console.error('Validation errors:', validation.errors);
        }
      } else {
        // If outputSchema is disabled, just verify the output is an array
        expect(Array.isArray(output)).toBe(true);
      }
    });

    it('should match outputSchema for status grouping', () => {
      const transactionsWithStatus: Transaction[] = [
        ...mockTransactions,
        {
          'Transaction ID': '3',
          'Charity': 'Pending Charity',
          'EIN': '11-1111111',
          'Amount': '20,000.00',
          'Sent Date': '12/1/24',
          'Grant Status': 'Pending',
        },
      ];
      const result = handleAggregateTransactions(transactionsWithStatus, {
        group_by: 'status',
      });
      const output = JSON.parse(result.content[0].text);
      const tool = MCP_TOOLS.find(t => t.name === 'aggregate_transactions');
      
      // outputSchema is conditionally included based on ENABLE_OUTPUT_SCHEMA flag
      if (tool?.outputSchema) {
        const validation = validateOutputSchema(output, tool.outputSchema);
        expect(validation.valid).toBe(true);
        if (!validation.valid) {
          console.error('Validation errors:', validation.errors);
        }
      } else {
        // If outputSchema is disabled, just verify the output is an array
        expect(Array.isArray(output)).toBe(true);
      }
    });

    it('should have correct structure for category grouping', () => {
      const result = handleAggregateTransactions(mockTransactions, {
        group_by: 'category',
      });
      const output = JSON.parse(result.content[0].text);
      
      expect(Array.isArray(output)).toBe(true);
      if (output.length > 0) {
        const item = output[0];
        expect(item).toHaveProperty('category');
        expect(item).toHaveProperty('count');
        expect(item).toHaveProperty('total_amount');
        expect(typeof item.category).toBe('string');
        expect(typeof item.count).toBe('number');
        expect(typeof item.total_amount).toBe('number');
      }
    });

    it('should have correct structure for grantee grouping', () => {
      const result = handleAggregateTransactions(mockTransactions, {
        group_by: 'grantee',
      });
      const output = JSON.parse(result.content[0].text);
      
      expect(Array.isArray(output)).toBe(true);
      if (output.length > 0) {
        const item = output[0];
        expect(item).toHaveProperty('grantee');
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('count');
        expect(item).toHaveProperty('total_amount');
        expect(typeof item.grantee).toBe('string');
        expect(typeof item.name).toBe('string');
        expect(typeof item.count).toBe('number');
        expect(typeof item.total_amount).toBe('number');
      }
    });

    it('should have correct structure for year grouping', () => {
      const result = handleAggregateTransactions(mockTransactions, {
        group_by: 'year',
      });
      const output = JSON.parse(result.content[0].text);
      
      expect(Array.isArray(output)).toBe(true);
      if (output.length > 0) {
        const item = output[0];
        expect(item).toHaveProperty('year');
        expect(item).toHaveProperty('count');
        expect(item).toHaveProperty('total_amount');
        expect(typeof item.year).toBe('string');
        expect(typeof item.count).toBe('number');
        expect(typeof item.total_amount).toBe('number');
      }
    });

    it('should have correct structure for status grouping', () => {
      const transactionsWithStatus: Transaction[] = [
        ...mockTransactions,
        {
          'Transaction ID': '3',
          'Charity': 'Pending Charity',
          'EIN': '11-1111111',
          'Amount': '20,000.00',
          'Sent Date': '12/1/24',
          'Grant Status': 'Pending',
        },
      ];
      const result = handleAggregateTransactions(transactionsWithStatus, {
        group_by: 'status',
      });
      const output = JSON.parse(result.content[0].text);
      
      expect(Array.isArray(output)).toBe(true);
      if (output.length > 0) {
        const item = output[0];
        expect(item).toHaveProperty('status');
        expect(item).toHaveProperty('count');
        expect(item).toHaveProperty('total_amount');
        expect(typeof item.status).toBe('string');
        expect(typeof item.count).toBe('number');
        expect(typeof item.total_amount).toBe('number');
      }
    });

    it('should have correct structure for is_beloved grouping', () => {
      const result = handleAggregateTransactions(mockTransactions, {
        group_by: 'is_beloved',
      });
      const output = JSON.parse(result.content[0].text);
      
      expect(Array.isArray(output)).toBe(true);
      if (output.length > 0) {
        const item = output[0];
        expect(item).toHaveProperty('is_beloved');
        expect(item).toHaveProperty('count');
        expect(item).toHaveProperty('total_amount');
        expect(typeof item.is_beloved).toBe('string');
        expect(['true', 'false']).toContain(item.is_beloved);
        expect(typeof item.count).toBe('number');
        expect(typeof item.total_amount).toBe('number');
      }
    });

    it('should have correct structure for international grouping', () => {
      const result = handleAggregateTransactions(mockTransactions, {
        group_by: 'international',
      });
      const output = JSON.parse(result.content[0].text);
      
      expect(Array.isArray(output)).toBe(true);
      if (output.length > 0) {
        const item = output[0];
        expect(item).toHaveProperty('international');
        expect(item).toHaveProperty('count');
        expect(item).toHaveProperty('total_amount');
        expect(typeof item.international).toBe('string');
        expect(['true', 'false']).toContain(item.international);
        expect(typeof item.count).toBe('number');
        expect(typeof item.total_amount).toBe('number');
      }
    });
  });

  describe('Tool annotations', () => {
    it('should have readOnlyHint annotation for all tools', () => {
      for (const tool of MCP_TOOLS) {
        expect(tool.annotations).toBeDefined();
        expect(tool.annotations).toHaveProperty('readOnlyHint', true);
      }
    });

    it('should have annotations object with correct structure', () => {
      for (const tool of MCP_TOOLS) {
        expect(tool.annotations).toBeDefined();
        expect(typeof tool.annotations).toBe('object');
        expect(tool.annotations.readOnlyHint).toBe(true);
      }
    });
  });

  describe('Output schema definitions exist', () => {
    it('should have outputSchema for all tools when enabled', () => {
      // outputSchema is conditionally included based on ENABLE_OUTPUT_SCHEMA flag
      // This test only passes when ENABLE_OUTPUT_SCHEMA is true
      const hasOutputSchema = MCP_TOOLS.some(tool => tool.outputSchema !== undefined);
      if (hasOutputSchema) {
        for (const tool of MCP_TOOLS) {
          expect(tool.outputSchema).toBeDefined();
          expect(tool.outputSchema).not.toBeNull();
        }
      } else {
        // Skip test if outputSchema is disabled
        expect(true).toBe(true);
      }
    });

    it('should have valid outputSchema structure for list_transactions', () => {
      const tool = MCP_TOOLS.find(t => t.name === 'list_transactions');
      if (tool?.outputSchema) {
        expect(tool.outputSchema).toHaveProperty('oneOf');
        expect(Array.isArray(tool.outputSchema.oneOf)).toBe(true);
        expect(tool.outputSchema.oneOf.length).toBeGreaterThan(0);
      } else {
        // Skip if outputSchema is disabled
        expect(true).toBe(true);
      }
    });

    it('should have valid outputSchema structure for list_grantees', () => {
      const tool = MCP_TOOLS.find(t => t.name === 'list_grantees');
      if (tool?.outputSchema) {
        expect(tool.outputSchema).toHaveProperty('type', 'array');
        expect(tool.outputSchema).toHaveProperty('items');
        expect(tool.outputSchema.items).toHaveProperty('type', 'object');
        expect(tool.outputSchema.items).toHaveProperty('properties');
        expect(tool.outputSchema.items).toHaveProperty('required');
      } else {
        // Skip if outputSchema is disabled
        expect(true).toBe(true);
      }
    });

    it('should have valid outputSchema structure for show_grantee', () => {
      const tool = MCP_TOOLS.find(t => t.name === 'show_grantee');
      if (tool?.outputSchema) {
        expect(tool.outputSchema).toHaveProperty('type', 'object');
        expect(tool.outputSchema).toHaveProperty('properties');
        expect(tool.outputSchema).toHaveProperty('required');
        expect(Array.isArray(tool.outputSchema.required)).toBe(true);
        expect(tool.outputSchema.required).toContain('metadata');
        expect(tool.outputSchema.required).toContain('status_breakdown');
        expect(tool.outputSchema.required).toContain('yearly_totals');
        expect(tool.outputSchema.required).toContain('transactions');
      } else {
        // Skip if outputSchema is disabled
        expect(true).toBe(true);
      }
    });

    it('should have valid outputSchema structure for aggregate_transactions', () => {
      const tool = MCP_TOOLS.find(t => t.name === 'aggregate_transactions');
      if (tool?.outputSchema) {
        expect(tool.outputSchema).toHaveProperty('type', 'array');
        expect(tool.outputSchema).toHaveProperty('items');
        expect(tool.outputSchema.items).toHaveProperty('oneOf');
        expect(Array.isArray(tool.outputSchema.items.oneOf)).toBe(true);
        expect(tool.outputSchema.items.oneOf.length).toBeGreaterThan(0);
      } else {
        // Skip if outputSchema is disabled
        expect(true).toBe(true);
      }
    });

    it('should include outputSchema when tools are serialized (for MCP client)', () => {
      // Simulate what gets sent to MCP clients
      const toolsJson = JSON.stringify(MCP_TOOLS);
      const toolsParsed = JSON.parse(toolsJson);
      
      // outputSchema is conditionally included
      const hasOutputSchema = toolsParsed.some((tool: any) => tool.outputSchema !== undefined);
      if (hasOutputSchema) {
        for (const tool of toolsParsed) {
          expect(tool.outputSchema).toBeDefined();
          expect(tool.outputSchema).not.toBeNull();
        }
      } else {
        // Skip if outputSchema is disabled
        expect(true).toBe(true);
      }
    });

    it('should have outputSchema with proper JSON Schema structure', () => {
      for (const tool of MCP_TOOLS) {
        if (tool.outputSchema) {
          // All schemas should have a type or oneOf
          const hasType = 'type' in tool.outputSchema;
          const hasOneOf = 'oneOf' in tool.outputSchema;
          expect(hasType || hasOneOf).toBe(true);
        }
        // Skip tools without outputSchema (when ENABLE_OUTPUT_SCHEMA is false)
      }
    });
  });
});
