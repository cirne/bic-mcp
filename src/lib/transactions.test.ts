import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseCSVLine, loadTransactions } from './transactions';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
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

