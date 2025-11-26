import Fuse from 'fuse.js';

export type Transaction = Record<string, string>;

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
    const date = (transaction[field] || '').trim();
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
    .map(field => extractYear(transaction[field]))
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
  const transactionCharity = (transaction.Charity || '').toLowerCase().trim();
  return transactionCharity === charityName.toLowerCase().trim();
}

// Helper function to check if a transaction matches the min_amount filter
export function matchesMinAmount(transaction: Transaction, minAmount: number): boolean {
  if (!minAmount) return true;
  
  const amountStr = (transaction.Amount || '').replace(/,/g, '').replace(/\s/g, '');
  const amount = parseFloat(amountStr) || 0;
  
  return amount >= minAmount;
}

// Helper function to check if a transaction matches the max_amount filter
export function matchesMaxAmount(transaction: Transaction, maxAmount: number): boolean {
  if (!maxAmount) return true;
  
  const amountStr = (transaction.Amount || '').replace(/,/g, '').replace(/\s/g, '');
  const amount = parseFloat(amountStr) || 0;
  
  return amount <= maxAmount;
}

// Helper function to sort transactions
export function sortTransactions(transactions: Transaction[], sortBy: string, sortOrder: 'asc' | 'desc' = 'asc'): Transaction[] {
  if (!sortBy) return transactions;
  
  return [...transactions].sort((a, b) => {
    let aVal: any = a[sortBy] || '';
    let bVal: any = b[sortBy] || '';
    
    // Special handling for Amount field
    if (sortBy === 'Amount') {
      aVal = parseFloat((aVal || '').replace(/,/g, '').replace(/\s/g, '')) || 0;
      bVal = parseFloat((bVal || '').replace(/,/g, '').replace(/\s/g, '')) || 0;
    }
    
    // Special handling for date fields
    if (sortBy.includes('Date')) {
      const aYear = extractYear(aVal) || 0;
      const bYear = extractYear(bVal) || 0;
      if (aYear !== bYear) {
        return sortOrder === 'asc' ? aYear - bYear : bYear - aYear;
      }
      // If same year, compare as strings
      return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    
    // String comparison
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    
    // Numeric comparison
    return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
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
        .map(field => extractYear(transaction[field]))
        .filter(y => y !== null) as number[];
      key = years.length > 0 ? Math.max(...years).toString() : 'Unknown';
    } else {
      key = (transaction[groupBy] || 'Unknown').toString();
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
  
  const fields = Object.keys(transactions[0]);
  
  // Configure Fuse.js for fuzzy search
  const fuse = new Fuse(transactions, {
    keys: fields,
    threshold: 0.4, // 0.0 = exact match, 1.0 = match anything
    ignoreLocation: true,
    includeScore: true,
  });

  const results = fuse.search(searchTerm);
  return results.map(result => result.item);
}

