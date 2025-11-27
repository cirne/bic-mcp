import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Transaction } from './filters';

// Simple CSV line parser that handles quoted fields
export function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  
  return values;
}

// Load transactions from a specific CSV file
function loadTransactionsFromFile(filePath: string): Transaction[] {
  const transactions: Transaction[] = [];
  
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) return transactions;
    
    // Find the header row (starts with "Transaction ID")
    let headerIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('Transaction ID')) {
        headerIndex = i;
        break;
      }
    }
    
    if (headerIndex === -1) return transactions;
    
    // Parse header
    const headers = parseCSVLine(lines[headerIndex]).map(h => h.trim().replace(/^"|"$/g, ''));
    
    // Parse rows (start after header)
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === 0 || values[0] === '') continue;
      
      const transaction: Transaction = {};
      headers.forEach((header, index) => {
        transaction[header] = values[index] || '';
      });
      transactions.push(transaction);
    }
  } catch (error) {
    console.error(`Error loading transactions from ${filePath}:`, error);
  }
  
  return transactions;
}

// Load transactions from CSV files
export function loadTransactions(dataDir: string = join(process.cwd(), 'data')): Transaction[] {
  const transactions: Transaction[] = [];
  
  try {
    const files = readdirSync(dataDir).filter(file => file.endsWith('.csv'));
    
    for (const file of files) {
      const filePath = join(dataDir, file);
      const fileTransactions = loadTransactionsFromFile(filePath);
      transactions.push(...fileTransactions);
    }
  } catch (error) {
    console.error('Error loading transactions:', error);
  }
  
  return transactions;
}

// Export helper for loading from specific file
export { loadTransactionsFromFile };

// Escape a CSV field value (add quotes if needed, escape quotes)
function escapeCSVField(value: string): string {
  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Write transactions to a CSV file
export function writeTransactions(filePath: string, transactions: Transaction[]): void {
  if (transactions.length === 0) {
    throw new Error('Cannot write empty transactions array');
  }

  // Get all unique headers from all transactions
  const allHeaders = new Set<string>();
  transactions.forEach(transaction => {
    Object.keys(transaction).forEach(key => allHeaders.add(key));
  });

  // Convert to array and ensure "Transaction ID" is first
  const headers = Array.from(allHeaders);
  if (headers.includes('Transaction ID')) {
    headers.splice(headers.indexOf('Transaction ID'), 1);
    headers.unshift('Transaction ID');
  }

  // Build CSV content
  const lines: string[] = [];
  
  // Add header rows (matching original format)
  lines.push('Table 1');
  lines.push('Grant Activity,,,,,,,,,,,,,,,,,,,');
  lines.push('Beloved In Christ,,,,,,,,,,,,,,,,,,,');
  
  // Add column header row
  lines.push(headers.map(escapeCSVField).join(','));
  
  // Add transaction rows
  transactions.forEach(transaction => {
    const row = headers.map(header => {
      const value = transaction[header];
      // Handle null/undefined/boolean values
      const stringValue = value === null || value === undefined ? '' : String(value);
      return escapeCSVField(stringValue);
    });
    lines.push(row.join(','));
  });

  // Write to file
  writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
}

