import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

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

// Load transactions from CSV files
export function loadTransactions(dataDir: string = join(process.cwd(), 'data')) {
  const transactions: Record<string, string>[] = [];
  
  try {
    const files = readdirSync(dataDir).filter(file => file.endsWith('.csv'));
    
    for (const file of files) {
      const filePath = join(dataDir, file);
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) continue;
      
      // Find the header row (starts with "Transaction ID")
      let headerIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('Transaction ID')) {
          headerIndex = i;
          break;
        }
      }
      
      if (headerIndex === -1) continue;
      
      // Parse header
      const headers = parseCSVLine(lines[headerIndex]).map(h => h.trim().replace(/^"|"$/g, ''));
      
      // Parse rows (start after header)
      for (let i = headerIndex + 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === 0 || values[0] === '') continue;
        
        const transaction: Record<string, string> = {};
        headers.forEach((header, index) => {
          transaction[header] = values[index] || '';
        });
        transactions.push(transaction);
      }
    }
  } catch (error) {
    console.error('Error loading transactions:', error);
  }
  
  return transactions;
}

