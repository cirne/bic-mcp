#!/usr/bin/env node

import { readdirSync, statSync, unlinkSync, copyFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve, extname } from 'path';
import { homedir } from 'os';
import XLSX from 'xlsx';
import { loadTransactionsFromFile, writeTransactions } from '../src/lib/transactions.js';
import { Transaction } from '../src/lib/filters.js';

// Parse command line arguments
function parseArgs(): { filename?: string; delete: boolean; latest: boolean; help: boolean } {
  const args = process.argv.slice(2);
  const result = { filename: undefined as string | undefined, delete: false, latest: false, help: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--delete') {
      result.delete = true;
    } else if (arg === '--latest') {
      result.latest = true;
    } else if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (!arg.startsWith('--') && !arg.startsWith('-')) {
      // Not a flag, treat as filename
      result.filename = arg;
    }
  }

  return result;
}

// Show usage information
function showHelp() {
  console.log(`
Usage: npm run data-update [options] [filename]

Options:
  --delete    Delete the XLSX file after successful processing
  --latest    When multiple files found, use most recently modified (skip prompt)
  --help, -h  Show this help message

Examples:
  npm run data-update                           # Auto-detect file from ~/Downloads
  npm run data-update -- --latest               # Use latest file if multiple found
  npm run data-update -- --delete               # Delete file after processing
  npm run data-update -- path/to/file.xlsx      # Use explicit file path
  npm run data-update -- --latest --delete      # Use latest and delete after
`);
}

// Find Grant Activity XLSX files in Downloads directory
function findGrantActivityFiles(downloadsDir: string): string[] {
  if (!existsSync(downloadsDir)) {
    return [];
  }

  try {
    const files = readdirSync(downloadsDir);
    return files
      .filter(file => {
        const lowerFile = file.toLowerCase();
        return (
          lowerFile.startsWith('grant activity') &&
          lowerFile.endsWith('.xlsx') &&
          extname(file) === '.xlsx'
        );
      })
      .map(file => join(downloadsDir, file));
  } catch (error) {
    console.error(`Error reading Downloads directory: ${error}`);
    return [];
  }
}

// Prompt user to select a file
async function promptFileSelection(files: string[]): Promise<string | null> {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log('\nMultiple Grant Activity files found:');
    files.forEach((file, index) => {
      const stats = statSync(file);
      console.log(`  ${index + 1}. ${file} (modified: ${stats.mtime.toISOString()})`);
    });
    console.log('  0. Cancel');

    rl.question('\nSelect a file (1-' + files.length + ', or 0 to cancel): ', (answer) => {
      rl.close();
      const index = parseInt(answer, 10);
      if (index === 0) {
        resolve(null);
      } else if (index >= 1 && index <= files.length) {
        resolve(files[index - 1]);
      } else {
        console.error('Invalid selection');
        resolve(null);
      }
    });
  });
}

// Get the most recently modified file
function getLatestFile(files: string[]): string {
  return files.reduce((latest, current) => {
    const latestStats = statSync(latest);
    const currentStats = statSync(current);
    return currentStats.mtime > latestStats.mtime ? current : latest;
  });
}

// Create backup of grants.csv
function createBackup(grantsPath: string): string {
  const dataDir = join(process.cwd(), 'data');
  const backupsDir = join(dataDir, 'backups');
  
  // Ensure backups directory exists
  if (!existsSync(backupsDir)) {
    mkdirSync(backupsDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
  const filename = `grants.backup.${timestamp}.csv`;
  const backupPath = join(backupsDir, filename);
  
  copyFileSync(grantsPath, backupPath);
  console.log(`✓ Backup created: ${backupPath}`);
  return backupPath;
}

// Format Excel date serial number to M/D/YY format
export function formatExcelDate(serial: number): string {
  // Excel epoch is January 1, 1900, but Excel incorrectly treats 1900 as a leap year
  // So we need to account for that
  const excelEpoch = new Date(1900, 0, 1);
  const daysSinceEpoch = serial - 2; // Subtract 2 because Excel counts from Jan 1, 1900 incorrectly
  const date = new Date(excelEpoch.getTime() + daysSinceEpoch * 24 * 60 * 60 * 1000);
  
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  
  // Format as M/D/YY (2-digit year)
  const yy = year % 100;
  return `${month}/${day}/${yy}`;
}

// Format cell value based on its type and header
export function formatCellValue(cell: XLSX.CellObject | null, header: string): string {
  if (!cell) return '';
  
  // Check if it's a date field
  const dateFields = ['date', 'sent date', 'cleared date', 'recommendation submitted date', 'requested payment date'];
  const isDateField = dateFields.some(df => header.toLowerCase().includes(df));
  
  // Check if cell is a date type or a number that looks like an Excel date serial
  if (isDateField && cell.t === 'n' && typeof cell.v === 'number') {
    // Excel dates are typically between 1 (Jan 1, 1900) and ~50000 (year 2037)
    // Regular numbers in date fields are usually much smaller
    if (cell.v > 1 && cell.v < 100000) {
      try {
        return formatExcelDate(cell.v);
      } catch (e) {
        // If formatting fails, fall through to default formatting
      }
    }
  }
  
  // Format amount fields
  if (header.toLowerCase().includes('amount') && !header.toLowerCase().includes('currency')) {
    return formatAmountValue(cell.v, header);
  }
  
  // Default: convert to string
  return String(cell.v || '');
}

// Format amount value to match CSV format (with commas and trailing space)
function formatAmountValue(value: any, header: string): string {
  const stringValue = String(value || '');
  
  // Check if this is an amount field
  if (header.toLowerCase().includes('amount') && !header.toLowerCase().includes('currency')) {
    // If it's already a formatted string with commas, preserve it
    if (stringValue.includes(',')) {
      // Ensure trailing space
      return stringValue.trim() + ' ';
    }
    
    // If it's a number, format it
    const numValue = typeof value === 'number' ? value : parseFloat(stringValue);
    if (!isNaN(numValue)) {
      // Format with 2 decimal places, add commas, and trailing space
      return numValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ';
    }
  }
  
  return stringValue;
}

// Parse XLSX file and extract transactions
export function parseXLSX(filePath: string): Transaction[] {
  const workbook = XLSX.readFile(filePath);
  
  // Find the first sheet with "Transaction ID" header
  let targetSheet: XLSX.WorkSheet | null = null;
  let sheetName: string | null = null;
  let headerRowIndex = -1;
  
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    
    // Check first few rows for "Transaction ID"
    for (let row = 0; row <= Math.min(10, range.e.r); row++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: 0 });
      const cell = sheet[cellAddress];
      if (cell && cell.v && String(cell.v).includes('Transaction ID')) {
        targetSheet = sheet;
        sheetName = name;
        headerRowIndex = row;
        break;
      }
    }
    if (targetSheet) break;
  }
  
  if (!targetSheet || !sheetName || headerRowIndex === -1) {
    throw new Error('Could not find sheet with "Transaction ID" header');
  }
  
  // Get header row
  const range = XLSX.utils.decode_range(targetSheet['!ref'] || 'A1');
  const headerRow: string[] = [];
  for (let col = 0; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: headerRowIndex, c: col });
    const cell = targetSheet[cellAddress];
    headerRow.push(cell ? String(cell.v || '').trim() : '');
  }
  
  // Convert sheet data to transactions
  const transactions: Transaction[] = [];
  for (let row = headerRowIndex + 1; row <= range.e.r; row++) {
    const transaction: Transaction = {};
    let hasTransactionId = false;
    
    for (let col = 0; col < headerRow.length; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = targetSheet[cellAddress];
      const header = headerRow[col];
      
      if (header) {
        // Format the cell value (handles dates, amounts, etc.)
        const formattedValue = formatCellValue(cell, header);
        transaction[header] = formattedValue;
        
        if (header === 'Transaction ID' && formattedValue.trim()) {
          hasTransactionId = true;
        }
      }
    }
    
    // Only add transaction if it has a Transaction ID
    if (hasTransactionId) {
      transactions.push(transaction);
    }
  }
  
  return transactions;
}

// Merge transactions by Transaction ID
function mergeTransactions(
  existing: Transaction[],
  newTransactions: Transaction[]
): Transaction[] {
  const transactionMap = new Map<string, Transaction>();
  
  // Add all existing transactions to map
  existing.forEach(transaction => {
    const id = String(transaction['Transaction ID'] || '').trim();
    if (id) {
      transactionMap.set(id, transaction);
    }
  });
  
  // Update/add new transactions
  newTransactions.forEach(transaction => {
    const id = String(transaction['Transaction ID'] || '').trim();
    if (id) {
      transactionMap.set(id, transaction);
    }
  });
  
  return Array.from(transactionMap.values());
}

// Main function
async function main() {
  const args = parseArgs();
  
  if (args.help) {
    showHelp();
    process.exit(0);
  }
  
  const dataDir = join(process.cwd(), 'data');
  const grantsPath = join(dataDir, 'grants.csv');
  
  // Determine which XLSX file to use
  let xlsxPath: string | null = null;
  
  if (args.filename) {
    // Explicit filename provided
    xlsxPath = resolve(args.filename);
    if (!existsSync(xlsxPath)) {
      console.error(`Error: File not found: ${xlsxPath}`);
      process.exit(1);
    }
  } else {
    // Auto-detect from Downloads
    const downloadsDir = join(homedir(), 'Downloads');
    const files = findGrantActivityFiles(downloadsDir);
    
    if (files.length === 0) {
      console.error('Error: No Grant Activity XLSX files found in ~/Downloads');
      console.error('Please download a file or provide a filename: npm run data-update -- path/to/file.xlsx');
      process.exit(1);
    } else if (files.length === 1) {
      xlsxPath = files[0];
      console.log(`✓ Using file: ${xlsxPath}`);
    } else {
      // Multiple files found
      if (args.latest) {
        xlsxPath = getLatestFile(files);
        console.log(`✓ Using latest file: ${xlsxPath}`);
      } else {
        xlsxPath = await promptFileSelection(files);
        if (!xlsxPath) {
          console.log('Cancelled');
          process.exit(0);
        }
      }
    }
  }
  
  if (!xlsxPath) {
    console.error('Error: No file selected');
    process.exit(1);
  }
  
  // Verify grants.csv exists
  if (!existsSync(grantsPath)) {
    console.error(`Error: grants.csv not found at ${grantsPath}`);
    process.exit(1);
  }
  
  try {
    // Create backup
    createBackup(grantsPath);
    
    // Load existing transactions
    console.log('Loading existing transactions...');
    const existingGrants = loadTransactionsFromFile(grantsPath);
    console.log(`  Found ${existingGrants.length} transactions in grants.csv`);
    
    // Parse XLSX
    console.log(`Parsing XLSX file: ${xlsxPath}`);
    const newTransactions = parseXLSX(xlsxPath);
    console.log(`  Found ${newTransactions.length} transactions in XLSX`);
    
    // Merge transactions
    console.log('Merging transactions...');
    const merged = mergeTransactions(existingGrants, newTransactions);
    console.log(`  Total transactions after merge: ${merged.length}`);
    console.log(`  Added/updated: ${newTransactions.length} transactions`);
    
    // Write back to grants.csv
    console.log(`Writing to ${grantsPath}...`);
    writeTransactions(grantsPath, merged);
    console.log('✓ Successfully updated grants.csv');
    
    // Delete XLSX file if requested
    if (args.delete) {
      console.log(`Deleting ${xlsxPath}...`);
      unlinkSync(xlsxPath);
      console.log('✓ File deleted');
    }
    
    console.log('\n✓ Update complete!');
  } catch (error) {
    console.error('\n✗ Error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Only run main if this file is executed directly (not imported)
// Check if this module is being run directly by comparing import.meta.url with the script path
const isMainModule = import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/') || '') || 
                     process.argv[1]?.includes('update-transactions.ts');

if (isMainModule) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

