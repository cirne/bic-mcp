#!/usr/bin/env node

import { existsSync, copyFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { loadTransactionsFromFile, writeTransactions } from '../src/lib/transactions.js';

const dataDir = join(process.cwd(), 'data');
const backupsDir = join(dataDir, 'backups');
const grantsPath = join(dataDir, 'grants.csv');
const grantsHistoricalPath = join(dataDir, 'grants.historical.csv');

console.log('Consolidating grants.csv and grants.historical.csv into a single grants.csv...\n');

// Load transactions from both files
const grants = existsSync(grantsPath) ? loadTransactionsFromFile(grantsPath) : [];
const historical = existsSync(grantsHistoricalPath) ? loadTransactionsFromFile(grantsHistoricalPath) : [];

console.log(`Loaded ${grants.length} transactions from grants.csv`);
console.log(`Loaded ${historical.length} transactions from grants.historical.csv`);

// Merge by Transaction ID (historical takes precedence if duplicate, but shouldn't be any)
const transactionMap = new Map<string, any>();

// Add historical first (older data)
historical.forEach(tx => {
  const id = String(tx['Transaction ID'] || '').trim();
  if (id) transactionMap.set(id, tx);
});

// Add grants (newer data will overwrite if duplicate)
grants.forEach(tx => {
  const id = String(tx['Transaction ID'] || '').trim();
  if (id) transactionMap.set(id, tx);
});

const merged = Array.from(transactionMap.values());

console.log(`\nMerged total: ${merged.length} unique transactions`);

// Ensure backups directory exists
if (!existsSync(backupsDir)) {
  mkdirSync(backupsDir, { recursive: true });
}

// Create backup of both files before consolidating
if (existsSync(grantsPath)) {
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
  const filename = `grants.backup.before-consolidation.${timestamp}.csv`;
  const backupPath = join(backupsDir, filename);
  copyFileSync(grantsPath, backupPath);
  console.log(`✓ Backup created: ${backupPath}`);
}

if (existsSync(grantsHistoricalPath)) {
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
  const filename = `grants.historical.backup.${timestamp}.csv`;
  const backupPath = join(backupsDir, filename);
  copyFileSync(grantsHistoricalPath, backupPath);
  console.log(`✓ Backup created: ${backupPath}`);
}

// Write merged transactions to grants.csv
writeTransactions(grantsPath, merged);
console.log(`\n✓ Successfully wrote ${merged.length} transactions to grants.csv`);

console.log('\n✓ Consolidation complete!');
console.log('\nNext steps:');
console.log('  1. Verify the data looks correct');
console.log('  2. Run tests: npm run test:run');
console.log('  3. Once verified, you can delete grants.historical.csv');
console.log('  4. Update scripts/update-transactions.ts to remove historical file references');

