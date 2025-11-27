import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import XLSX from 'xlsx';
import { formatExcelDate, formatCellValue, parseXLSX } from './update-transactions.js';
import { Transaction } from '../src/lib/filters.js';

describe('formatExcelDate', () => {
  it('should format Excel date serial to M/D/YY format', () => {
    // Excel serial 45932 = October 2, 2025
    expect(formatExcelDate(45932)).toBe('10/2/25');
    
    // Excel serial 45925 = September 25, 2025
    expect(formatExcelDate(45925)).toBe('9/25/25');
    
    // Excel serial 45908 = September 8, 2025
    expect(formatExcelDate(45908)).toBe('9/8/25');
  });

  it('should handle single digit months and days', () => {
    // Excel serial 1 = January 1, 1900 (but Excel bug makes it Jan 1, 1900)
    // Actually Excel epoch starts at 1, so serial 2 = Jan 1, 1900
    const result = formatExcelDate(2);
    expect(result).toMatch(/^\d+\/\d+\/\d+$/); // Should be in M/D/YY format
  });

  it('should handle dates in 2000s', () => {
    // Excel serial 44927 = January 1, 2023
    expect(formatExcelDate(44927)).toBe('1/1/23');
  });
});

describe('formatCellValue', () => {
  it('should format date cells as M/D/YY', () => {
    const dateCell: XLSX.CellObject = { t: 'n', v: 45932 }; // Oct 2, 2025
    expect(formatCellValue(dateCell, 'Sent Date')).toBe('10/2/25');
    expect(formatCellValue(dateCell, 'Cleared Date')).toBe('10/2/25');
    expect(formatCellValue(dateCell, 'Requested Payment Date')).toBe('10/2/25');
  });

  it('should format amount cells with commas and trailing space', () => {
    const amountCell: XLSX.CellObject = { t: 'n', v: 1000 };
    expect(formatCellValue(amountCell, 'Amount')).toBe('1,000.00 ');
    
    const largeAmountCell: XLSX.CellObject = { t: 'n', v: 500000 };
    expect(formatCellValue(largeAmountCell, 'Amount')).toBe('500,000.00 ');
    
    const decimalAmountCell: XLSX.CellObject = { t: 'n', v: 1234.56 };
    expect(formatCellValue(decimalAmountCell, 'Amount')).toBe('1,234.56 ');
  });

  it('should not format currency amount fields', () => {
    const currencyCell: XLSX.CellObject = { t: 'n', v: 1000 };
    expect(formatCellValue(currencyCell, 'Foreign Currency Amount')).toBe('1000');
  });

  it('should convert non-date, non-amount cells to string', () => {
    const textCell: XLSX.CellObject = { t: 's', v: 'Test Charity' };
    expect(formatCellValue(textCell, 'Charity')).toBe('Test Charity');
    
    const numberCell: XLSX.CellObject = { t: 'n', v: 12345 };
    expect(formatCellValue(numberCell, 'Transaction ID')).toBe('12345');
  });

  it('should handle null/empty cells', () => {
    expect(formatCellValue(null, 'Any Field')).toBe('');
  });

  it('should not format numbers in date fields that are too large', () => {
    // Numbers > 100000 are likely not Excel dates
    const largeNumberCell: XLSX.CellObject = { t: 'n', v: 200000 };
    expect(formatCellValue(largeNumberCell, 'Sent Date')).toBe('200000');
  });
});

describe('parseXLSX', () => {
  let testDataDir: string;

  beforeEach(() => {
    testDataDir = join(tmpdir(), `bic-xlsx-test-${Date.now()}`);
    mkdirSync(testDataDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDataDir, { recursive: true, force: true });
  });

  function createTestXLSX(filePath: string, data: any[][]): void {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, filePath);
  }

  it('should parse XLSX file with Transaction ID header', () => {
    const data = [
      ['Transaction ID', 'Charity', 'Amount', 'Sent Date'],
      ['1', 'Test Charity', 1000, 45932], // Oct 2, 2025
      ['2', 'Another Charity', 2500, 45925], // Sep 25, 2025
    ];

    const filePath = join(testDataDir, 'test.xlsx');
    createTestXLSX(filePath, data);

    const transactions = parseXLSX(filePath);

    expect(transactions).toHaveLength(2);
    expect(transactions[0]['Transaction ID']).toBe('1');
    expect(transactions[0].Charity).toBe('Test Charity');
    expect(transactions[0].Amount).toBe('1,000.00 ');
    expect(transactions[0]['Sent Date']).toBe('10/2/25');
    expect(transactions[1]['Transaction ID']).toBe('2');
    expect(transactions[1].Charity).toBe('Another Charity');
  });

  it('should format dates correctly from Excel serial numbers', () => {
    const data = [
      ['Transaction ID', 'Sent Date', 'Cleared Date', 'Requested Payment Date'],
      ['1', 45932, 45933, 45930], // Various dates in Oct 2025
    ];

    const filePath = join(testDataDir, 'test.xlsx');
    createTestXLSX(filePath, data);

    const transactions = parseXLSX(filePath);

    expect(transactions).toHaveLength(1);
    expect(transactions[0]['Sent Date']).toBe('10/2/25');
    expect(transactions[0]['Cleared Date']).toBe('10/3/25');
    expect(transactions[0]['Requested Payment Date']).toBe('9/30/25');
  });

  it('should format amounts correctly', () => {
    const data = [
      ['Transaction ID', 'Amount', 'Foreign Currency Amount'],
      ['1', 1000, 1000],
      ['2', 500000, 500000],
      ['3', 1234.56, 1234.56],
    ];

    const filePath = join(testDataDir, 'test.xlsx');
    createTestXLSX(filePath, data);

    const transactions = parseXLSX(filePath);

    expect(transactions).toHaveLength(3);
    expect(transactions[0].Amount).toBe('1,000.00 ');
    expect(transactions[0]['Foreign Currency Amount']).toBe('1000');
    expect(transactions[1].Amount).toBe('500,000.00 ');
    expect(transactions[2].Amount).toBe('1,234.56 ');
  });

  it('should find Transaction ID header in non-first row', () => {
    const data = [
      ['Table 1'],
      ['Grant Activity'],
      ['Beloved In Christ'],
      ['Transaction ID', 'Charity', 'Amount'],
      ['1', 'Test Charity', 1000],
    ];

    const filePath = join(testDataDir, 'test.xlsx');
    createTestXLSX(filePath, data);

    const transactions = parseXLSX(filePath);

    expect(transactions).toHaveLength(1);
    expect(transactions[0]['Transaction ID']).toBe('1');
    expect(transactions[0].Charity).toBe('Test Charity');
  });

  it('should skip rows without Transaction ID', () => {
    const data = [
      ['Transaction ID', 'Charity', 'Amount'],
      ['1', 'Test Charity', 1000],
      ['', '', ''], // Empty row
      ['2', 'Another Charity', 2000],
    ];

    const filePath = join(testDataDir, 'test.xlsx');
    createTestXLSX(filePath, data);

    const transactions = parseXLSX(filePath);

    expect(transactions).toHaveLength(2);
    expect(transactions[0]['Transaction ID']).toBe('1');
    expect(transactions[1]['Transaction ID']).toBe('2');
  });

  it('should handle XLSX file without Transaction ID header', () => {
    const data = [
      ['Name', 'Value'],
      ['Test', 1000],
    ];

    const filePath = join(testDataDir, 'test.xlsx');
    createTestXLSX(filePath, data);

    expect(() => parseXLSX(filePath)).toThrow('Could not find sheet with "Transaction ID" header');
  });

  it('should handle multiple sheets and use first with Transaction ID', () => {
    const workbook = XLSX.utils.book_new();
    
    // First sheet without Transaction ID
    const sheet1 = XLSX.utils.aoa_to_sheet([['Name', 'Value'], ['Test', 1000]]);
    XLSX.utils.book_append_sheet(workbook, sheet1, 'Sheet1');
    
    // Second sheet with Transaction ID
    const sheet2 = XLSX.utils.aoa_to_sheet([
      ['Transaction ID', 'Charity', 'Amount'],
      ['1', 'Test Charity', 1000],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet2, 'Sheet2');
    
    const filePath = join(testDataDir, 'test.xlsx');
    XLSX.writeFile(workbook, filePath);

    const transactions = parseXLSX(filePath);

    expect(transactions).toHaveLength(1);
    expect(transactions[0]['Transaction ID']).toBe('1');
  });

  it('should handle quoted fields with commas in XLSX', () => {
    const data = [
      ['Transaction ID', 'Charity', 'Charity Address'],
      ['1', 'Test, Inc.', '123 Main St, City, State'],
    ];

    const filePath = join(testDataDir, 'test.xlsx');
    createTestXLSX(filePath, data);

    const transactions = parseXLSX(filePath);

    expect(transactions).toHaveLength(1);
    expect(transactions[0].Charity).toBe('Test, Inc.');
    expect(transactions[0]['Charity Address']).toBe('123 Main St, City, State');
  });

  it('should handle empty XLSX file', () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    
    const filePath = join(testDataDir, 'empty.xlsx');
    XLSX.writeFile(workbook, filePath);

    expect(() => parseXLSX(filePath)).toThrow('Could not find sheet with "Transaction ID" header');
  });

  it('should handle XLSX with all common grant fields', () => {
    const data = [
      [
        'Transaction ID',
        'Charity',
        'Amount',
        'Sent Date',
        'Cleared Date',
        'Grant Status',
        'Grant Purpose',
        'EIN',
      ],
      [
        '12345',
        'Test Charity',
        100000,
        45932, // Oct 2, 2025
        45933, // Oct 3, 2025
        'Payment Cleared',
        'General support',
        '12-3456789',
      ],
    ];

    const filePath = join(testDataDir, 'test.xlsx');
    createTestXLSX(filePath, data);

    const transactions = parseXLSX(filePath);

    expect(transactions).toHaveLength(1);
    expect(transactions[0]['Transaction ID']).toBe('12345');
    expect(transactions[0].Charity).toBe('Test Charity');
    expect(transactions[0].Amount).toBe('100,000.00 ');
    expect(transactions[0]['Sent Date']).toBe('10/2/25');
    expect(transactions[0]['Cleared Date']).toBe('10/3/25');
    expect(transactions[0]['Grant Status']).toBe('Payment Cleared');
    expect(transactions[0]['Grant Purpose']).toBe('General support');
    expect(transactions[0].EIN).toBe('12-3456789');
  });
});

