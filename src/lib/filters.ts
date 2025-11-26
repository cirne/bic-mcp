import Fuse from 'fuse.js';

export type Transaction = Record<string, string | boolean | null>;

// Helper function to safely get string value from transaction field
export function getStringValue(value: string | boolean | null | undefined): string {
  if (typeof value === 'string') return value;
  return '';
}

// Helper function to extract year from a date string
export function extractYear(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  const match = dateStr.match(/\/(\d{2})$/);
  if (match) {
    const yearSuffix = parseInt(match[1]);
    // Assume years 00-30 are 2000-2030, 31-99 are 1931-1999
    return yearSuffix < 31 ? 2000 + yearSuffix : 1900 + yearSuffix;
  }
  return null;
}

// Helper function to check if a transaction matches the year filter
export function matchesYear(transaction: Transaction, year: number): boolean {
  if (!year) return true;
  
  const yearSuffix = year.toString().slice(-2); // Get last 2 digits (e.g., "24" from 2024)
  const dateFields = ['Sent Date', 'Requested Payment Date', 'Recommendation Submitted Date', 'Cleared Date'];
  
  return dateFields.some(field => {
    const date = getStringValue(transaction[field]).trim();
    if (!date) return false;
    
    // Check if date ends with /YY (e.g., "2/15/24" for 2024)
    if (date.endsWith(`/${yearSuffix}`)) {
      return true;
    }
    
    // Check for pattern M/D/YY or MM/DD/YY where YY matches
    const dateMatch = date.match(/\/(\d{2})$/);
    if (dateMatch && dateMatch[1] === yearSuffix) {
      return true;
    }
    
    return false;
  });
}

// Helper function to check if a transaction matches the year range filter
export function matchesYearRange(transaction: Transaction, minYear?: number, maxYear?: number): boolean {
  if (!minYear && !maxYear) return true;
  
  const dateFields = ['Sent Date', 'Requested Payment Date', 'Recommendation Submitted Date', 'Cleared Date'];
  const years = dateFields
    .map(field => extractYear(getStringValue(transaction[field])))
    .filter(y => y !== null) as number[];
  
  if (years.length === 0) return false;
  
  const transactionYear = Math.max(...years); // Use the latest year found
  
  if (minYear && transactionYear < minYear) return false;
  if (maxYear && transactionYear > maxYear) return false;
  
  return true;
}

// Helper function to check if a transaction matches the charity filter
export function matchesCharity(transaction: Transaction, charityName: string): boolean {
  if (!charityName) return true;
  const transactionCharity = getStringValue(transaction.Charity).toLowerCase().trim();
  return transactionCharity === charityName.toLowerCase().trim();
}

// Helper function to check if a transaction matches the min_amount filter
export function matchesMinAmount(transaction: Transaction, minAmount: number): boolean {
  if (!minAmount) return true;
  
  const amountStr = getStringValue(transaction.Amount).replace(/,/g, '').replace(/\s/g, '');
  const amount = parseFloat(amountStr) || 0;
  
  return amount >= minAmount;
}

// Helper function to check if a transaction matches the max_amount filter
export function matchesMaxAmount(transaction: Transaction, maxAmount: number): boolean {
  if (!maxAmount) return true;
  
  const amountStr = getStringValue(transaction.Amount).replace(/,/g, '').replace(/\s/g, '');
  const amount = parseFloat(amountStr) || 0;
  
  return amount <= maxAmount;
}

// Helper function to sort transactions
export function sortTransactions(transactions: Transaction[], sortBy: string, sortOrder: 'asc' | 'desc' = 'asc'): Transaction[] {
  if (!sortBy) return transactions;
  
  return [...transactions].sort((a, b): number => {
    let aVal: any = a[sortBy];
    let bVal: any = b[sortBy];
    
    // Special handling for Amount field
    if (sortBy === 'Amount') {
      const aStr = getStringValue(aVal);
      const bStr = getStringValue(bVal);
      aVal = parseFloat(aStr.replace(/,/g, '').replace(/\s/g, '')) || 0;
      bVal = parseFloat(bStr.replace(/,/g, '').replace(/\s/g, '')) || 0;
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    // Special handling for date fields
    else if (sortBy.includes('Date')) {
      const aStr = getStringValue(aVal);
      const bStr = getStringValue(bVal);
      const aYear = extractYear(aStr) || 0;
      const bYear = extractYear(bStr) || 0;
      if (aYear !== bYear) {
        return sortOrder === 'asc' ? aYear - bYear : bYear - aYear;
      }
      // If same year, compare as strings
      return sortOrder === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    }
    
    // String comparison
    else if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    
    // Convert to strings for comparison if needed
    else {
      const aStr = getStringValue(aVal);
      const bStr = getStringValue(bVal);
      return sortOrder === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    }
  });
}

// Helper function to group transactions
export function groupTransactions(transactions: Transaction[], groupBy: string): Record<string, Transaction[]> {
  if (!groupBy) return {};
  
  const grouped: Record<string, Transaction[]> = {};
  
  transactions.forEach(transaction => {
    let key: string;
    
    if (groupBy === 'year') {
      // Extract year from date fields
      const dateFields = ['Sent Date', 'Requested Payment Date', 'Recommendation Submitted Date', 'Cleared Date'];
      const years = dateFields
        .map(field => extractYear(getStringValue(transaction[field])))
        .filter(y => y !== null) as number[];
      key = years.length > 0 ? Math.max(...years).toString() : 'Unknown';
    } else {
      const value = transaction[groupBy];
      key = value !== undefined && value !== null ? String(value) : 'Unknown';
    }
    
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(transaction);
  });
  
  return grouped;
}

// Helper function to select specific fields
export function selectFields(transactions: Transaction[], fields: string[]): Transaction[] {
  if (!fields || fields.length === 0) return transactions;
  
  return transactions.map(transaction => {
    const selected: Transaction = {};
    fields.forEach(field => {
      if (transaction.hasOwnProperty(field)) {
        selected[field] = transaction[field];
      }
    });
    return selected;
  });
}

// Apply fuzzy search using Fuse.js
export function applyFuzzySearch(transactions: Transaction[], searchTerm: string): Transaction[] {
  if (!searchTerm || transactions.length === 0) return transactions;
  
  // Convert transactions to string-only format for Fuse.js
  const stringTransactions = transactions.map(t => {
    const strT: Record<string, string> = {};
    Object.keys(t).forEach(key => {
      const value = t[key];
      strT[key] = typeof value === 'string' ? value : (value === null ? '' : String(value));
    });
    return strT;
  });
  
  const fields = Object.keys(stringTransactions[0] || {});
  
  // Configure Fuse.js for fuzzy search
  const fuse = new Fuse(stringTransactions, {
    keys: fields,
    threshold: 0.4, // 0.0 = exact match, 1.0 = match anything
    ignoreLocation: true,
    includeScore: true,
  });

  const results = fuse.search(searchTerm);
  // Map back to original transactions
  return results.map(result => transactions[result.refIndex]);
}

