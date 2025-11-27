import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseCSVLine, loadTransactions, loadTransactionsFromFile, writeTransactions } from './transactions';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('parseCSVLine', () => {
  it('should parse simple CSV line', () => {
    expect(parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c']);
    expect(parseCSVLine('1,2,3')).toEqual(['1', '2', '3']);
  });

  it('should handle quoted fields with commas', () => {
    expect(parseCSVLine('"a,b",c,"d,e"')).toEqual(['a,b', 'c', 'd,e']);
    expect(parseCSVLine('"Test, Inc.",1000,"Address, City"')).toEqual([
      'Test, Inc.',
      '1000',
      'Address, City',
    ]);
  });

  it('should handle escaped quotes', () => {
    expect(parseCSVLine('"a""b",c')).toEqual(['a"b', 'c']);
    expect(parseCSVLine('"He said ""Hello""",world')).toEqual([
      'He said "Hello"',
      'world',
    ]);
  });

  it('should handle mixed quoted and unquoted fields', () => {
    expect(parseCSVLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
    expect(parseCSVLine('"a,b",c,d')).toEqual(['a,b', 'c', 'd']);
  });

  it('should trim whitespace', () => {
    expect(parseCSVLine(' a , b , c ')).toEqual(['a', 'b', 'c']);
    // Note: parseCSVLine trims all values, including quoted ones
    expect(parseCSVLine('" a,b " , c ')).toEqual(['a,b', 'c']);
  });

  it('should handle empty fields', () => {
    expect(parseCSVLine('a,,c')).toEqual(['a', '', 'c']);
    expect(parseCSVLine(',,')).toEqual(['', '', '']);
  });

  it('should handle single field', () => {
    expect(parseCSVLine('a')).toEqual(['a']);
    expect(parseCSVLine('"a,b"')).toEqual(['a,b']);
  });

  it('should handle trailing comma', () => {
    expect(parseCSVLine('a,b,')).toEqual(['a', 'b', '']);
  });
});

describe('loadTransactions', () => {
  let testDataDir: string;

  beforeEach(() => {
    testDataDir = join(tmpdir(), `bic-test-${Date.now()}`);
    mkdirSync(testDataDir, { recursive: true });
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
    expect(transactions[0]['Transaction ID']).toBe('1');
    expect(transactions[0].Charity).toBe('Test Charity');
    // Note: parseCSVLine trims trailing spaces
    expect(transactions[0].Amount).toBe('1,000.00');
    expect(transactions[0]['Sent Date']).toBe('10/2/24');
    expect(transactions[1].Charity).toBe('Another Charity');
  });

  it('should handle CSV files with quoted fields containing commas', () => {
    const csvContent = `Transaction ID,Charity,Charity Address,Amount
1,"Test, Inc.","123 Main St, City, State","1,000.00 "`;

    writeFileSync(join(testDataDir, 'test.csv'), csvContent);
    const transactions = loadTransactions(testDataDir);

    expect(transactions).toHaveLength(1);
    expect(transactions[0].Charity).toBe('Test, Inc.');
    expect(transactions[0]['Charity Address']).toBe('123 Main St, City, State');
  });

  it('should find header row starting with "Transaction ID"', () => {
    const csvContent = `Some other line
Another line
Transaction ID,Charity,Amount
1,Test Charity,"1,000.00 "`;

    writeFileSync(join(testDataDir, 'test.csv'), csvContent);
    const transactions = loadTransactions(testDataDir);

    expect(transactions).toHaveLength(1);
    expect(transactions[0].Charity).toBe('Test Charity');
  });

  it('should skip files without "Transaction ID" header', () => {
    const csvContent = `Name,Value
Test,1000`;

    writeFileSync(join(testDataDir, 'test.csv'), csvContent);
    const transactions = loadTransactions(testDataDir);

    expect(transactions).toHaveLength(0);
  });

  it('should load multiple CSV files', () => {
    const csv1 = `Transaction ID,Charity,Amount
1,Charity A,"1,000.00 "`;

    const csv2 = `Transaction ID,Charity,Amount
2,Charity B,"2,000.00 "`;

    writeFileSync(join(testDataDir, 'file1.csv'), csv1);
    writeFileSync(join(testDataDir, 'file2.csv'), csv2);

    const transactions = loadTransactions(testDataDir);

    expect(transactions).toHaveLength(2);
    expect(transactions.some(t => t.Charity === 'Charity A')).toBe(true);
    expect(transactions.some(t => t.Charity === 'Charity B')).toBe(true);
  });

  it('should ignore non-CSV files', () => {
    const csvContent = `Transaction ID,Charity,Amount
1,Test Charity,"1,000.00 "`;

    writeFileSync(join(testDataDir, 'test.csv'), csvContent);
    writeFileSync(join(testDataDir, 'test.txt'), 'Not a CSV file');
    writeFileSync(join(testDataDir, 'test.xlsx'), 'Excel file');

    const transactions = loadTransactions(testDataDir);

    expect(transactions).toHaveLength(1);
  });

  it('should skip empty rows', () => {
    const csvContent = `Transaction ID,Charity,Amount
1,Test Charity,"1,000.00 "

2,Another Charity,"2,000.00 "`;

    writeFileSync(join(testDataDir, 'test.csv'), csvContent);
    const transactions = loadTransactions(testDataDir);

    expect(transactions).toHaveLength(2);
  });

  it('should handle rows with missing values', () => {
    const csvContent = `Transaction ID,Charity,Amount,Sent Date
1,Test Charity,"1,000.00 ",
2,,"2,000.00 ","10/2/24"`;

    writeFileSync(join(testDataDir, 'test.csv'), csvContent);
    const transactions = loadTransactions(testDataDir);

    expect(transactions).toHaveLength(2);
    expect(transactions[0]['Sent Date']).toBe('');
    expect(transactions[1].Charity).toBe('');
  });

  it('should handle empty CSV files', () => {
    writeFileSync(join(testDataDir, 'empty.csv'), '');
    const transactions = loadTransactions(testDataDir);

    expect(transactions).toHaveLength(0);
  });

  it('should handle CSV files with only header', () => {
    const csvContent = `Transaction ID,Charity,Amount`;

    writeFileSync(join(testDataDir, 'header-only.csv'), csvContent);
    const transactions = loadTransactions(testDataDir);

    expect(transactions).toHaveLength(0);
  });

  it('should trim header names', () => {
    const csvContent = `"Transaction ID" , "Charity" , "Amount"
1,Test Charity,"1,000.00 "`;

    writeFileSync(join(testDataDir, 'test.csv'), csvContent);
    const transactions = loadTransactions(testDataDir);

    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toHaveProperty('Transaction ID');
    expect(transactions[0]).toHaveProperty('Charity');
    expect(transactions[0]).toHaveProperty('Amount');
  });

  it('should use default data directory when not provided', () => {
    // This test verifies the function doesn't crash with default path
    // Actual data loading depends on project structure
    expect(() => loadTransactions()).not.toThrow();
  });

  it('should handle CSV files with extra columns', () => {
    const csvContent = `Transaction ID,Charity,Amount,Extra Field
1,Test Charity,"1,000.00 ",extra value`;

    writeFileSync(join(testDataDir, 'test.csv'), csvContent);
    const transactions = loadTransactions(testDataDir);

    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toHaveProperty('Extra Field');
    expect(transactions[0]['Extra Field']).toBe('extra value');
  });

  it('should handle CSV files with fewer columns than headers', () => {
    const csvContent = `Transaction ID,Charity,Amount,Sent Date
1,Test Charity,"1,000.00 "`;

    writeFileSync(join(testDataDir, 'test.csv'), csvContent);
    const transactions = loadTransactions(testDataDir);

    expect(transactions).toHaveLength(1);
    expect(transactions[0]['Sent Date']).toBe('');
  });
});

describe('loadTransactionsFromFile', () => {
  let testDataDir: string;

  beforeEach(() => {
    testDataDir = join(tmpdir(), `bic-test-${Date.now()}`);
    mkdirSync(testDataDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDataDir, { recursive: true, force: true });
  });

  it('should load transactions from a specific CSV file', () => {
    const csvContent = `Transaction ID,Charity,Amount,Sent Date
1,Test Charity,"1,000.00 ","10/2/24"
2,Another Charity,"2,500.00 ","11/15/24"`;

    const filePath = join(testDataDir, 'test.csv');
    writeFileSync(filePath, csvContent);
    const transactions = loadTransactionsFromFile(filePath);

    expect(transactions).toHaveLength(2);
    expect(transactions[0]['Transaction ID']).toBe('1');
    expect(transactions[0].Charity).toBe('Test Charity');
    expect(transactions[0].Amount).toBe('1,000.00');
    expect(transactions[1].Charity).toBe('Another Charity');
  });

  it('should handle CSV files with header rows before data', () => {
    const csvContent = `Table 1
Grant Activity,,,,,,,,,,,,,,,,,,,
Beloved In Christ,,,,,,,,,,,,,,,,,,,
Transaction ID,Charity,Amount
1,Test Charity,"1,000.00 "`;

    const filePath = join(testDataDir, 'test.csv');
    writeFileSync(filePath, csvContent);
    const transactions = loadTransactionsFromFile(filePath);

    expect(transactions).toHaveLength(1);
    expect(transactions[0]['Transaction ID']).toBe('1');
    expect(transactions[0].Charity).toBe('Test Charity');
  });

  it('should return empty array for file without Transaction ID header', () => {
    const csvContent = `Name,Value
Test,1000`;

    const filePath = join(testDataDir, 'test.csv');
    writeFileSync(filePath, csvContent);
    const transactions = loadTransactionsFromFile(filePath);

    expect(transactions).toHaveLength(0);
  });

  it('should return empty array for empty file', () => {
    const filePath = join(testDataDir, 'empty.csv');
    writeFileSync(filePath, '');
    const transactions = loadTransactionsFromFile(filePath);

    expect(transactions).toHaveLength(0);
  });

  it('should handle file with quoted fields containing commas', () => {
    const csvContent = `Transaction ID,Charity,Charity Address,Amount
1,"Test, Inc.","123 Main St, City, State","1,000.00 "`;

    const filePath = join(testDataDir, 'test.csv');
    writeFileSync(filePath, csvContent);
    const transactions = loadTransactionsFromFile(filePath);

    expect(transactions).toHaveLength(1);
    expect(transactions[0].Charity).toBe('Test, Inc.');
    expect(transactions[0]['Charity Address']).toBe('123 Main St, City, State');
  });

  it('should handle non-existent file gracefully', () => {
    const filePath = join(testDataDir, 'nonexistent.csv');
    const transactions = loadTransactionsFromFile(filePath);

    expect(transactions).toHaveLength(0);
  });
});

describe('writeTransactions', () => {
  let testDataDir: string;

  beforeEach(() => {
    testDataDir = join(tmpdir(), `bic-test-${Date.now()}`);
    mkdirSync(testDataDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDataDir, { recursive: true, force: true });
  });

  it('should write transactions to CSV file with proper format', () => {
    const transactions = [
      {
        'Transaction ID': '1',
        'Charity': 'Test Charity',
        'Amount': '1,000.00 ',
        'Sent Date': '10/2/24',
      },
      {
        'Transaction ID': '2',
        'Charity': 'Another Charity',
        'Amount': '2,500.00 ',
        'Sent Date': '11/15/24',
      },
    ];

    const filePath = join(testDataDir, 'output.csv');
    writeTransactions(filePath, transactions);

    expect(existsSync(filePath)).toBe(true);
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    // Should have header rows + header + 2 data rows
    expect(lines.length).toBeGreaterThanOrEqual(5);
    expect(lines[0]).toBe('Table 1');
    expect(lines[1]).toBe('Grant Activity,,,,,,,,,,,,,,,,,,,');
    expect(lines[2]).toBe('Beloved In Christ,,,,,,,,,,,,,,,,,,,');
    expect(lines[3]).toContain('Transaction ID');
    expect(lines[3]).toContain('Charity');
    expect(lines[4]).toContain('1');
    expect(lines[4]).toContain('Test Charity');
    expect(lines[5]).toContain('2');
    expect(lines[5]).toContain('Another Charity');
  });

  it('should quote fields containing commas', () => {
    const transactions = [
      {
        'Transaction ID': '1',
        'Charity': 'Test, Inc.',
        'Charity Address': '123 Main St, City, State',
        'Amount': '1,000.00 ',
      },
    ];

    const filePath = join(testDataDir, 'output.csv');
    writeTransactions(filePath, transactions);

    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('"Test, Inc."');
    expect(content).toContain('"123 Main St, City, State"');
  });

  it('should escape quotes in field values', () => {
    const transactions = [
      {
        'Transaction ID': '1',
        'Charity': 'Test "Quote" Charity',
        'Amount': '1,000.00 ',
      },
    ];

    const filePath = join(testDataDir, 'output.csv');
    writeTransactions(filePath, transactions);

    const content = readFileSync(filePath, 'utf-8');
    // Quotes should be escaped as ""
    expect(content).toContain('"Test ""Quote"" Charity"');
  });

  it('should put Transaction ID first in header row', () => {
    const transactions = [
      {
        'Charity': 'Test Charity',
        'Transaction ID': '1',
        'Amount': '1,000.00 ',
      },
    ];

    const filePath = join(testDataDir, 'output.csv');
    writeTransactions(filePath, transactions);

    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const headerLine = lines[3]; // Header row is 4th line (index 3)
    
    expect(headerLine.split(',')[0]).toBe('Transaction ID');
  });

  it('should handle transactions with different fields', () => {
    const transactions = [
      {
        'Transaction ID': '1',
        'Charity': 'Charity A',
        'Amount': '1,000.00 ',
      },
      {
        'Transaction ID': '2',
        'Charity': 'Charity B',
        'Amount': '2,000.00 ',
        'Extra Field': 'extra value',
      },
    ];

    const filePath = join(testDataDir, 'output.csv');
    writeTransactions(filePath, transactions);

    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('Extra Field');
    expect(content).toContain('extra value');
  });

  it('should handle empty string values', () => {
    const transactions = [
      {
        'Transaction ID': '1',
        'Charity': 'Test Charity',
        'Amount': '',
        'Sent Date': '',
      },
    ];

    const filePath = join(testDataDir, 'output.csv');
    writeTransactions(filePath, transactions);

    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const dataLine = lines[4]; // First data row
    
    // Should have empty fields but still be valid CSV
    expect(dataLine).toContain('1');
    expect(dataLine).toContain('Test Charity');
  });

  it('should handle null and undefined values', () => {
    const transactions = [
      {
        'Transaction ID': '1',
        'Charity': 'Test Charity',
        'Amount': null as any,
        'Sent Date': undefined as any,
      },
    ];

    const filePath = join(testDataDir, 'output.csv');
    writeTransactions(filePath, transactions);

    const content = readFileSync(filePath, 'utf-8');
    // Should not crash and should write empty strings for null/undefined
    expect(content).toContain('1');
    expect(content).toContain('Test Charity');
  });

  it('should throw error for empty transactions array', () => {
    const filePath = join(testDataDir, 'output.csv');
    
    expect(() => {
      writeTransactions(filePath, []);
    }).toThrow('Cannot write empty transactions array');
    
    // File should not be created
    expect(existsSync(filePath)).toBe(false);
  });

  it('should write file that can be read back correctly', () => {
    const originalTransactions = [
      {
        'Transaction ID': '1',
        'Charity': 'Test Charity',
        'Amount': '1,000.00 ',
        'Sent Date': '10/2/24',
      },
      {
        'Transaction ID': '2',
        'Charity': 'Another Charity',
        'Amount': '2,500.00 ',
        'Sent Date': '11/15/24',
      },
    ];

    const filePath = join(testDataDir, 'output.csv');
    writeTransactions(filePath, originalTransactions);

    // Read it back
    const loadedTransactions = loadTransactionsFromFile(filePath);

    expect(loadedTransactions).toHaveLength(2);
    expect(loadedTransactions[0]['Transaction ID']).toBe('1');
    expect(loadedTransactions[0].Charity).toBe('Test Charity');
    expect(loadedTransactions[1]['Transaction ID']).toBe('2');
    expect(loadedTransactions[1].Charity).toBe('Another Charity');
  });

  it('should preserve amount formatting with trailing spaces', () => {
    const transactions = [
      {
        'Transaction ID': '1',
        'Charity': 'Test Charity',
        'Amount': '1,000.00 ',
      },
    ];

    const filePath = join(testDataDir, 'output.csv');
    writeTransactions(filePath, transactions);

    const content = readFileSync(filePath, 'utf-8');
    // Amount should be quoted because it contains a comma
    expect(content).toContain('"1,000.00 "');
  });
});

