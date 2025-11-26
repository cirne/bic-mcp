# Testing Recommendations for BIC MCP Server

## Current State Review

### Existing Tests
- **`test.js`**: Comprehensive integration test suite (27 test cases) that spawns the stdio server and tests all MCP tools
- **`test-client.js`**: Simple client test for basic functionality
- **`test-filter.js`**: Quick filter test for specific queries

### Current Approach
- Manual integration tests using Node.js child processes
- Tests spawn the actual MCP server and communicate via stdio
- No unit tests for individual functions
- No test framework - just plain Node.js scripts

### Code Structure
- **`src/lib/transactions.ts`**: CSV loading and parsing logic
- **`src/lib/filters.ts`**: Filtering, sorting, grouping, and search functions
- **`src/lib/grantees.ts`**: Grantee aggregation and lookup functions
- **`src/lib/mcp-handlers.ts`**: MCP tool handlers (integration layer)
- **`server/server.ts`**: Stdio server setup

---

## Recommended Testing Framework: **Vitest**

### Why Vitest?

1. **TypeScript Native**: Works seamlessly with TypeScript without extra configuration
2. **ES Modules**: Full support for ES modules (your project uses `"type": "module"`)
3. **Fast**: Uses Vite's fast build system
4. **Simple Setup**: Minimal configuration needed
5. **Great DX**: Excellent error messages, watch mode, coverage built-in
6. **Jest-Compatible API**: Easy migration path if you know Jest
7. **Next.js Compatible**: Works well with Next.js projects

### Alternative: Node.js Built-in Test Runner

If you want **zero dependencies**, Node.js 18+ includes a built-in test runner:
- ✅ No dependencies
- ✅ Simple API
- ❌ Less features (no watch mode, limited mocking)
- ❌ Newer, less mature

**Recommendation**: Use Vitest for better developer experience.

---

## Test Organization Structure

### Recommended Structure

```
bic-mcp/
├── src/
│   ├── lib/
│   │   ├── transactions.ts
│   │   ├── transactions.test.ts          # Unit tests
│   │   ├── filters.ts
│   │   ├── filters.test.ts               # Unit tests
│   │   ├── grantees.ts
│   │   ├── grantees.test.ts              # Unit tests
│   │   ├── mcp-handlers.ts
│   │   └── mcp-handlers.test.ts          # Integration tests
│   └── ...
├── server/
│   ├── server.ts
│   └── server.test.ts                    # Server integration tests
├── __tests__/                            # Optional: E2E tests
│   └── e2e/
│       └── mcp-server.test.ts            # Full server E2E tests
├── test.js                               # Keep existing manual tests
├── test-client.js                        # Keep existing manual tests
└── test-filter.js                        # Keep existing manual tests
```

### Test File Naming Convention

- **Unit/Integration tests**: `*.test.ts` (co-located with source files)
- **E2E tests**: `__tests__/e2e/*.test.ts` (separate directory)
- **Manual tests**: Keep existing `test*.js` files for manual verification

---

## Setup Instructions

### 1. Install Vitest

```bash
npm install --save-dev vitest @vitest/ui
```

### 2. Create `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules', '.next', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '**/*.test.ts',
        '**/*.config.ts',
        '.next/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
```

### 3. Update `package.json` Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest --watch",
    "test:e2e": "vitest run __tests__/e2e",
    "test:manual": "node test.js"
  }
}
```

---

## Example Test Structure

### Unit Test Example: `filters.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  extractYear,
  matchesYear,
  matchesYearRange,
  matchesCharity,
  matchesMinAmount,
  matchesMaxAmount,
  sortTransactions,
  groupTransactions,
  selectFields,
  applyFuzzySearch,
} from './filters';
import type { Transaction } from './filters';

describe('extractYear', () => {
  it('should extract year from M/D/YY format', () => {
    expect(extractYear('10/2/25')).toBe(2025);
    expect(extractYear('1/15/24')).toBe(2024);
    expect(extractYear('12/31/30')).toBe(2030);
    expect(extractYear('1/1/31')).toBe(1931);
  });

  it('should return null for invalid dates', () => {
    expect(extractYear('')).toBeNull();
    expect(extractYear(undefined)).toBeNull();
    expect(extractYear('invalid')).toBeNull();
  });
});

describe('matchesYear', () => {
  const transaction: Transaction = {
    'Sent Date': '10/2/24',
    'Amount': '1,000.00 ',
  };

  it('should match transactions from the specified year', () => {
    expect(matchesYear(transaction, 2024)).toBe(true);
    expect(matchesYear(transaction, 2023)).toBe(false);
  });
});

describe('matchesMinAmount', () => {
  it('should filter by minimum amount', () => {
    const transaction: Transaction = {
      'Amount': '5,000.00 ',
    };
    expect(matchesMinAmount(transaction, 1000)).toBe(true);
    expect(matchesMinAmount(transaction, 10000)).toBe(false);
  });
});

describe('sortTransactions', () => {
  it('should sort by Amount descending', () => {
    const transactions: Transaction[] = [
      { 'Amount': '1,000.00 ' },
      { 'Amount': '5,000.00 ' },
      { 'Amount': '2,500.00 ' },
    ];
    const sorted = sortTransactions(transactions, 'Amount', 'desc');
    expect(parseFloat(sorted[0].Amount.replace(/,/g, ''))).toBe(5000);
  });
});
```

### Unit Test Example: `transactions.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { parseCSVLine, loadTransactions } from './transactions';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('parseCSVLine', () => {
  it('should parse simple CSV line', () => {
    expect(parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('should handle quoted fields with commas', () => {
    expect(parseCSVLine('"a,b",c,"d,e"')).toEqual(['a,b', 'c', 'd,e']);
  });

  it('should handle escaped quotes', () => {
    expect(parseCSVLine('"a""b",c')).toEqual(['a"b', 'c']);
  });
});

describe('loadTransactions', () => {
  let testDataDir: string;

  beforeEach(() => {
    testDataDir = join(tmpdir(), `bic-test-${Date.now()}`);
    mkdirSync(testDataDir);
  });

  afterEach(() => {
    rmSync(testDataDir, { recursive: true, force: true });
  });

  it('should load transactions from CSV file', () => {
    const csvContent = `Transaction ID,Charity,Amount,Sent Date
1,Test Charity,"1,000.00 ","10/2/24"
2,Another Charity,"2,500.00 ","11/15/24"`;

    writeFileSync(join(testDataDir, 'test.csv'), csvContent);
    const transactions = loadTransactions(testDataDir);

    expect(transactions).toHaveLength(2);
    expect(transactions[0].Charity).toBe('Test Charity');
  });
});
```

### Integration Test Example: `mcp-handlers.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  handleListTransactions,
  handleListGrantees,
  handleShowGrantee,
} from './mcp-handlers';
import type { Transaction } from './filters';

const mockTransactions: Transaction[] = [
  {
    'Transaction ID': '1',
    'Charity': 'Test Charity',
    'EIN': '12-3456789',
    'Amount': '5,000.00 ',
    'Sent Date': '10/2/24',
    'Grant Purpose': 'Test grant',
  },
  {
    'Transaction ID': '2',
    'Charity': 'Another Charity',
    'EIN': '98-7654321',
    'Amount': '10,000.00 ',
    'Sent Date': '11/15/24',
    'Grant Purpose': 'Another grant',
  },
];

describe('handleListTransactions', () => {
  it('should return all transactions when no filters', () => {
    const result = handleListTransactions(mockTransactions, {});
    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveLength(2);
  });

  it('should filter by charity', () => {
    const result = handleListTransactions(mockTransactions, {
      charity: 'Test Charity',
    });
    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveLength(1);
    expect(data[0].Charity).toBe('Test Charity');
  });

  it('should validate year parameter', () => {
    const result = handleListTransactions(mockTransactions, {
      year: 1800, // Invalid
    });
    expect(result.isError).toBe(true);
  });
});

describe('handleListGrantees', () => {
  it('should return all grantees', () => {
    const result = handleListGrantees(mockTransactions, {});
    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveLength(2);
    expect(data[0]).toHaveProperty('name');
    expect(data[0]).toHaveProperty('total_amount');
  });

  it('should sort by total_amount descending', () => {
    const result = handleListGrantees(mockTransactions, {
      sort_by: 'total_amount',
      sort_order: 'desc',
    });
    const data = JSON.parse(result.content[0].text);
    expect(data[0].total_amount).toBeGreaterThanOrEqual(data[1].total_amount);
  });
});

describe('handleShowGrantee', () => {
  it('should return grantee details', () => {
    const result = handleShowGrantee(mockTransactions, {
      charity: 'Test Charity',
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.metadata.name).toBe('Test Charity');
    expect(data.transactions).toHaveLength(1);
  });

  it('should return error for non-existent grantee', () => {
    const result = handleShowGrantee(mockTransactions, {
      charity: 'Non-existent',
    });
    expect(result.isError).toBe(true);
  });
});
```

---

## Test Categories

### 1. Unit Tests (Fast, Isolated)
- **Location**: Co-located with source files (`*.test.ts`)
- **Purpose**: Test individual functions in isolation
- **Examples**:
  - `extractYear()` function
  - `matchesYear()` function
  - `parseCSVLine()` function
  - `getAllGrantees()` function

### 2. Integration Tests (Medium Speed)
- **Location**: `src/lib/mcp-handlers.test.ts`
- **Purpose**: Test MCP handlers with real data flow
- **Examples**:
  - `handleListTransactions()` with various filters
  - `handleListGrantees()` with sorting
  - `handleShowGrantee()` with different inputs

### 3. E2E Tests (Slower, Full System)
- **Location**: `__tests__/e2e/mcp-server.test.ts` (optional)
- **Purpose**: Test full server via stdio (like current `test.js`)
- **Examples**:
  - Full MCP protocol communication
  - Server startup and shutdown
  - Multiple sequential requests

### 4. Manual Tests (Keep Existing)
- **Location**: Root directory (`test.js`, `test-client.js`, `test-filter.js`)
- **Purpose**: Manual verification and debugging
- **Keep**: These are useful for manual testing and debugging

---

## Migration Strategy

### Phase 1: Setup (Week 1)
1. ✅ Install Vitest
2. ✅ Create `vitest.config.ts`
3. ✅ Update `package.json` scripts
4. ✅ Add test files structure

### Phase 2: Unit Tests (Week 1-2)
1. Write tests for `filters.ts` (highest value, most complex logic)
2. Write tests for `transactions.ts` (CSV parsing is critical)
3. Write tests for `grantees.ts` (aggregation logic)

### Phase 3: Integration Tests (Week 2)
1. Write tests for `mcp-handlers.ts`
2. Test error cases and edge cases

### Phase 4: E2E Tests (Optional, Week 3)
1. Convert `test.js` to Vitest E2E test (optional)
2. Or keep as manual test script

---

## Running Tests

```bash
# Run all tests in watch mode (development)
npm test

# Run all tests once
npm run test:run

# Run with UI (great for debugging)
npm run test:ui

# Run with coverage
npm run test:coverage

# Run only E2E tests
npm run test:e2e

# Run manual integration tests (existing)
npm run test:manual
```

---

## Best Practices

### 1. Test Organization
- ✅ One test file per source file
- ✅ Group related tests with `describe()` blocks
- ✅ Use descriptive test names: `it('should filter by year when year is provided')`

### 2. Test Data
- ✅ Use fixtures for complex test data
- ✅ Create minimal mock data for unit tests
- ✅ Use real CSV files for integration tests (in `__tests__/fixtures/`)

### 3. Coverage Goals
- **Aim for**: 80%+ coverage on business logic (`src/lib/`)
- **Don't worry about**: Server setup code, config files

### 4. Test Speed
- ✅ Unit tests should be fast (< 100ms each)
- ✅ Integration tests can be slower (< 1s each)
- ✅ E2E tests can be slowest (< 5s each)

---

## Summary

**Recommended Framework**: **Vitest**

**Test Organization**:
- Unit tests: `src/lib/*.test.ts` (co-located)
- Integration tests: `src/lib/mcp-handlers.test.ts`
- E2E tests: `__tests__/e2e/*.test.ts` (optional)
- Manual tests: Keep existing `test*.js` files

**Next Steps**:
1. Install Vitest: `npm install --save-dev vitest @vitest/ui`
2. Create `vitest.config.ts`
3. Write first test: `src/lib/filters.test.ts`
4. Gradually add more tests following the examples above

This structure gives you:
- ✅ Fast unit tests for quick feedback
- ✅ Integration tests for MCP handlers
- ✅ Optional E2E tests for full system verification
- ✅ Manual tests for debugging and manual verification

