#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Fuse from 'fuse.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load transactions from CSV files
function loadTransactions() {
  const transactions = [];
  const dataDir = join(__dirname, 'data');
  
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
        
        const transaction = {};
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

// Simple CSV line parser that handles quoted fields
function parseCSVLine(line) {
  const values = [];
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

// Load transactions on startup
let transactions = loadTransactions();

// Create MCP server
const server = new Server(
  {
    name: 'bic-grants',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_transactions',
        description: 'Search for grant transactions with advanced filtering, sorting, and grouping options.',
        inputSchema: {
          type: 'object',
          properties: {
            search_term: {
              type: 'string',
              description: 'Optional: The search term to find matching transactions using fuzzy, case-insensitive search across all fields',
            },
            charity: {
              type: 'string',
              description: 'Optional: Filter by exact charity name (case-insensitive)',
            },
            year: {
              type: 'number',
              description: 'Optional: Filter transactions by exact year (e.g., 2025). Checks all date fields.',
            },
            min_year: {
              type: 'number',
              description: 'Optional: Filter transactions from this year onwards (e.g., 2023 for "since 2023")',
            },
            max_year: {
              type: 'number',
              description: 'Optional: Filter transactions up to this year',
            },
            min_amount: {
              type: 'number',
              description: 'Optional: Filter transactions with amount greater than or equal to this value (e.g., 25000)',
            },
            max_amount: {
              type: 'number',
              description: 'Optional: Filter transactions with amount less than or equal to this value',
            },
            sort_by: {
              type: 'string',
              description: 'Optional: Field to sort by (e.g., "Sent Date", "Amount"). Default: no sorting',
            },
            sort_order: {
              type: 'string',
              enum: ['asc', 'desc'],
              description: 'Optional: Sort order - "asc" or "desc". Default: "asc"',
            },
            group_by: {
              type: 'string',
              description: 'Optional: Field to group results by (e.g., "year" extracts year from date fields, or any field name). Returns grouped object.',
            },
            fields: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional: Array of field names to include in response (e.g., ["Sent Date", "Amount", "Grant Purpose"]). If not provided, returns all fields.',
            },
          },
          required: [],
        },
      },
      {
        name: 'list_grantees',
        description: 'List all unique grantees (charities) with summary data including name, EIN, most recent grant note, transaction count, and total amount. This tool provides aggregated summary data for each grantee, making it ideal for answering questions about top grantees, largest recipients, or grantee rankings. Supports sorting by total amount, name, EIN, or most recent grant date. Optionally filter to only grantees that received grants in a specific year.',
        inputSchema: {
          type: 'object',
          properties: {
            year: {
              type: 'number',
              description: 'Optional: Filter to only grantees that received grants in this year (e.g., 2024). If provided, transaction count and total amount will be scoped to this year only.',
            },
            sort_by: {
              type: 'string',
              enum: ['name', 'ein', 'recent_date', 'total_amount'],
              description: 'Optional: Sort grantees by name, EIN, most recent grant date, or total amount. Default: name',
            },
            sort_order: {
              type: 'string',
              enum: ['asc', 'desc'],
              description: 'Optional: Sort order - "asc" or "desc". Default: "asc"',
            },
          },
          required: [],
        },
      },
      {
        name: 'show_grantee',
        description: 'Show detailed information about a specific grantee including metadata and all transaction history.',
        inputSchema: {
          type: 'object',
          properties: {
            charity: {
              type: 'string',
              description: 'Required: Exact charity name to look up',
            },
            ein: {
              type: 'string',
              description: 'Optional: EIN (Employer Identification Number) to help identify the grantee if name is ambiguous',
            },
          },
          required: ['charity'],
        },
      },
    ],
  };
});

// Helper function to check if a transaction matches the year filter
function matchesYear(transaction, year) {
  if (!year) return true;
  
  const yearSuffix = year.toString().slice(-2); // Get last 2 digits (e.g., "24" from 2024)
  const dateFields = ['Sent Date', 'Requested Payment Date', 'Recommendation Submitted Date', 'Cleared Date'];
  
  return dateFields.some(field => {
    const date = (transaction[field] || '').trim();
    if (!date) return false;
    
    // Check if date ends with /YY (e.g., "2/15/24" for 2024)
    // Or if date contains /YY/ but ensure it's not followed by another digit (e.g., avoid matching "2/24/25")
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

// Helper function to extract year from a date string
function extractYear(dateStr) {
  if (!dateStr) return null;
  const match = dateStr.match(/\/(\d{2})$/);
  if (match) {
    const yearSuffix = parseInt(match[1]);
    // Assume years 00-30 are 2000-2030, 31-99 are 1931-1999
    return yearSuffix < 31 ? 2000 + yearSuffix : 1900 + yearSuffix;
  }
  return null;
}

// Helper function to check if a transaction matches the year range filter
function matchesYearRange(transaction, minYear, maxYear) {
  if (!minYear && !maxYear) return true;
  
  const dateFields = ['Sent Date', 'Requested Payment Date', 'Recommendation Submitted Date', 'Cleared Date'];
  const years = dateFields
    .map(field => extractYear(transaction[field]))
    .filter(y => y !== null);
  
  if (years.length === 0) return false;
  
  const transactionYear = Math.max(...years); // Use the latest year found
  
  if (minYear && transactionYear < minYear) return false;
  if (maxYear && transactionYear > maxYear) return false;
  
  return true;
}

// Helper function to check if a transaction matches the charity filter
function matchesCharity(transaction, charityName) {
  if (!charityName) return true;
  const transactionCharity = (transaction.Charity || '').toLowerCase().trim();
  return transactionCharity === charityName.toLowerCase().trim();
}

// Helper function to check if a transaction matches the min_amount filter
function matchesMinAmount(transaction, minAmount) {
  if (!minAmount) return true;
  
  const amountStr = (transaction.Amount || '').replace(/,/g, '').replace(/\s/g, '');
  const amount = parseFloat(amountStr) || 0;
  
  return amount >= minAmount;
}

// Helper function to check if a transaction matches the max_amount filter
function matchesMaxAmount(transaction, maxAmount) {
  if (!maxAmount) return true;
  
  const amountStr = (transaction.Amount || '').replace(/,/g, '').replace(/\s/g, '');
  const amount = parseFloat(amountStr) || 0;
  
  return amount <= maxAmount;
}

// Helper function to sort transactions
function sortTransactions(transactions, sortBy, sortOrder = 'asc') {
  if (!sortBy) return transactions;
  
  return [...transactions].sort((a, b) => {
    let aVal = a[sortBy] || '';
    let bVal = b[sortBy] || '';
    
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
function groupTransactions(transactions, groupBy) {
  if (!groupBy) return transactions;
  
  const grouped = {};
  
  transactions.forEach(transaction => {
    let key;
    
    if (groupBy === 'year') {
      // Extract year from date fields
      const dateFields = ['Sent Date', 'Requested Payment Date', 'Recommendation Submitted Date', 'Cleared Date'];
      const years = dateFields
        .map(field => extractYear(transaction[field]))
        .filter(y => y !== null);
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
function selectFields(transactions, fields) {
  if (!fields || fields.length === 0) return transactions;
  
  return transactions.map(transaction => {
    const selected = {};
    fields.forEach(field => {
      if (transaction.hasOwnProperty(field)) {
        selected[field] = transaction[field];
      }
    });
    return selected;
  });
}

// Helper function to get all unique grantees
function getAllGrantees() {
  const granteeMap = new Map();
  
  transactions.forEach(transaction => {
    const charity = (transaction.Charity || '').trim();
    const ein = (transaction.EIN || '').trim();
    
    if (!charity) return; // Skip transactions without charity name
    
    // Use charity name + EIN as unique key (EIN might be empty for some)
    const key = `${charity}|${ein}`;
    
    if (!granteeMap.has(key)) {
      granteeMap.set(key, {
        name: charity,
        ein: ein,
        address: (transaction['Charity Address'] || '').trim(),
        transactions: []
      });
    }
    
    granteeMap.get(key).transactions.push(transaction);
  });
  
  return Array.from(granteeMap.values());
}

// Helper function to get most recent grant note for a grantee
function getMostRecentGrantNote(granteeTransactions) {
  if (!granteeTransactions || granteeTransactions.length === 0) return null;
  
  // Sort by Sent Date (most recent first)
  const sorted = [...granteeTransactions].sort((a, b) => {
    const dateA = extractYear(a['Sent Date']) || 0;
    const dateB = extractYear(b['Sent Date']) || 0;
    if (dateB !== dateA) return dateB - dateA;
    // If same year, compare dates as strings
    return (b['Sent Date'] || '').localeCompare(a['Sent Date'] || '');
  });
  
  const mostRecent = sorted[0];
  return mostRecent['Grant Purpose'] || mostRecent['Special Note'] || null;
}

// Helper function to find grantee by name and optionally EIN
function findGrantee(charityName, ein) {
  const allGrantees = getAllGrantees();
  
  // First try exact match with EIN if provided
  if (ein) {
    const exactMatch = allGrantees.find(g => 
      g.name.toLowerCase() === charityName.toLowerCase() && 
      g.ein === ein
    );
    if (exactMatch) return exactMatch;
  }
  
  // Try exact name match
  const nameMatch = allGrantees.find(g => 
    g.name.toLowerCase() === charityName.toLowerCase()
  );
  
  if (nameMatch) return nameMatch;
  
  // Try fuzzy match
  const fuzzyMatch = allGrantees.find(g => 
    g.name.toLowerCase().includes(charityName.toLowerCase()) ||
    charityName.toLowerCase().includes(g.name.toLowerCase())
  );
  
  return fuzzyMatch || null;
}

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'list_transactions') {
    const searchTerm = args?.search_term;
    const charity = args?.charity;
    const year = args?.year;
    const minYear = args?.min_year;
    const maxYear = args?.max_year;
    const minAmount = args?.min_amount;
    const maxAmount = args?.max_amount;
    const sortBy = args?.sort_by;
    const sortOrder = args?.sort_order || 'asc';
    const groupBy = args?.group_by;
    const fields = args?.fields;
    
    // Validate inputs
    if (searchTerm !== undefined && typeof searchTerm !== 'string') {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: search_term must be a string if provided',
          },
        ],
        isError: true,
      };
    }
    
    if (charity !== undefined && typeof charity !== 'string') {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: charity must be a string if provided',
          },
        ],
        isError: true,
      };
    }
    
    if (year !== undefined && (typeof year !== 'number' || year < 1900 || year > 2100)) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: year must be a valid number between 1900 and 2100',
          },
        ],
        isError: true,
      };
    }
    
    if (minYear !== undefined && (typeof minYear !== 'number' || minYear < 1900 || minYear > 2100)) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: min_year must be a valid number between 1900 and 2100',
          },
        ],
        isError: true,
      };
    }
    
    if (maxYear !== undefined && (typeof maxYear !== 'number' || maxYear < 1900 || maxYear > 2100)) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: max_year must be a valid number between 1900 and 2100',
          },
        ],
        isError: true,
      };
    }
    
    if (minAmount !== undefined && (typeof minAmount !== 'number' || minAmount < 0)) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: min_amount must be a non-negative number',
          },
        ],
        isError: true,
      };
    }
    
    if (maxAmount !== undefined && (typeof maxAmount !== 'number' || maxAmount < 0)) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: max_amount must be a non-negative number',
          },
        ],
        isError: true,
      };
    }

    let matches = transactions;

    // Apply exact charity filter first (most specific)
    if (charity !== undefined) {
      matches = matches.filter(t => matchesCharity(t, charity));
    }

    // Apply year filter (exact year)
    if (year !== undefined) {
      matches = matches.filter(t => matchesYear(t, year));
    }

    // Apply year range filter (min_year/max_year)
    if (minYear !== undefined || maxYear !== undefined) {
      matches = matches.filter(t => matchesYearRange(t, minYear, maxYear));
    }

    // Apply amount filters
    if (minAmount !== undefined) {
      matches = matches.filter(t => matchesMinAmount(t, minAmount));
    }
    
    if (maxAmount !== undefined) {
      matches = matches.filter(t => matchesMaxAmount(t, maxAmount));
    }

    // Apply fuzzy search if search_term is provided
    if (searchTerm) {
      const fields = matches.length > 0 ? Object.keys(matches[0]) : [];
      
      // Configure Fuse.js for fuzzy search
      const fuse = new Fuse(matches, {
        keys: fields,
        threshold: 0.4, // 0.0 = exact match, 1.0 = match anything
        ignoreLocation: true,
        includeScore: true,
      });

      const results = fuse.search(searchTerm);
      matches = results.map(result => result.item);
    }

    // Apply sorting
    if (sortBy) {
      matches = sortTransactions(matches, sortBy, sortOrder);
    }

    // Apply field selection
    if (fields && fields.length > 0) {
      matches = selectFields(matches, fields);
    }

    // Apply grouping (after sorting and field selection)
    let result;
    if (groupBy) {
      const grouped = groupTransactions(matches, groupBy);
      // If grouping, also select fields for each group
      if (fields && fields.length > 0) {
        const groupedWithFields = {};
        Object.keys(grouped).forEach(key => {
          groupedWithFields[key] = selectFields(grouped[key], fields);
        });
        result = groupedWithFields;
      } else {
        result = grouped;
      }
    } else {
      result = matches;
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  if (name === 'list_grantees') {
    const year = args?.year;
    const sortBy = args?.sort_by || 'name';
    const sortOrder = args?.sort_order || 'asc';
    
    // Validate year parameter
    if (year !== undefined && (typeof year !== 'number' || year < 1900 || year > 2100)) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: year must be a valid number between 1900 and 2100',
          },
        ],
        isError: true,
      };
    }
    
    const allGrantees = getAllGrantees();
    
    // Build list with most recent grant note, transaction count, and total amount
    const granteeList = allGrantees.map(grantee => {
      // Filter transactions by year if year is provided
      let relevantTransactions = grantee.transactions;
      if (year !== undefined) {
        relevantTransactions = grantee.transactions.filter(t => matchesYear(t, year));
      }
      
      // Skip grantees that have no transactions in the filtered set
      if (relevantTransactions.length === 0) {
        return null;
      }
      
      // Calculate total amount for filtered transactions
      const totalAmount = relevantTransactions.reduce((sum, t) => {
        const amountStr = (t.Amount || '').replace(/,/g, '').replace(/\s/g, '');
        return sum + (parseFloat(amountStr) || 0);
      }, 0);
      
      // Get most recent grant note from filtered transactions (or all if no year filter)
      const mostRecentNote = getMostRecentGrantNote(relevantTransactions);
      
      return {
        name: grantee.name,
        ein: grantee.ein || '(no EIN)',
        most_recent_grant_note: mostRecentNote || '(no notes)',
        transaction_count: relevantTransactions.length,
        total_amount: totalAmount
      };
    }).filter(g => g !== null); // Remove grantees with no transactions in filtered set
    
    // Sort the list
    granteeList.sort((a, b) => {
      let aVal, bVal;
      
      if (sortBy === 'name') {
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
      } else if (sortBy === 'ein') {
        aVal = a.ein;
        bVal = b.ein;
      } else if (sortBy === 'total_amount') {
        aVal = a.total_amount || 0;
        bVal = b.total_amount || 0;
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      } else if (sortBy === 'recent_date') {
        // Find most recent transaction date for each grantee
        const granteeA = allGrantees.find(g => g.name === a.name && g.ein === a.ein);
        const granteeB = allGrantees.find(g => g.name === b.name && g.ein === b.ein);
        
        // Use filtered transactions if year is provided
        let transactionsA = granteeA ? granteeA.transactions : [];
        let transactionsB = granteeB ? granteeB.transactions : [];
        
        if (year !== undefined) {
          transactionsA = transactionsA.filter(t => matchesYear(t, year));
          transactionsB = transactionsB.filter(t => matchesYear(t, year));
        }
        
        // Sort transactions by date (most recent first) to get the most recent date
        transactionsA.sort((t1, t2) => {
          const date1 = extractYear(t1['Sent Date']) || 0;
          const date2 = extractYear(t2['Sent Date']) || 0;
          if (date2 !== date1) return date2 - date1;
          return (t2['Sent Date'] || '').localeCompare(t1['Sent Date'] || '');
        });
        
        transactionsB.sort((t1, t2) => {
          const date1 = extractYear(t1['Sent Date']) || 0;
          const date2 = extractYear(t2['Sent Date']) || 0;
          if (date2 !== date1) return date2 - date1;
          return (t2['Sent Date'] || '').localeCompare(t1['Sent Date'] || '');
        });
        
        const dateA = transactionsA.length > 0 
          ? extractYear(transactionsA[0]?.['Sent Date']) || 0 
          : 0;
        const dateB = transactionsB.length > 0
          ? extractYear(transactionsB[0]?.['Sent Date']) || 0
          : 0;
        
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      }
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(granteeList, null, 2),
        },
      ],
    };
  }

  if (name === 'show_grantee') {
    const charityName = args?.charity;
    const ein = args?.ein;
    
    if (!charityName || typeof charityName !== 'string') {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: charity is required and must be a string',
          },
        ],
        isError: true,
      };
    }
    
    const grantee = findGrantee(charityName, ein);
    
    if (!grantee) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: Grantee "${charityName}" not found${ein ? ` with EIN ${ein}` : ''}`,
          },
        ],
        isError: true,
      };
    }
    
    // Calculate totals and statistics
    const totalAmount = grantee.transactions.reduce((sum, t) => {
      const amountStr = (t.Amount || '').replace(/,/g, '').replace(/\s/g, '');
      return sum + (parseFloat(amountStr) || 0);
    }, 0);
    
    // Get date range
    const dates = grantee.transactions
      .map(t => extractYear(t['Sent Date']))
      .filter(d => d !== null)
      .sort((a, b) => a - b);
    
    const firstGrantYear = dates.length > 0 ? dates[0] : null;
    const lastGrantYear = dates.length > 0 ? dates[dates.length - 1] : null;
    
    // Calculate yearly totals
    const yearlyTotals = {};
    grantee.transactions.forEach(transaction => {
      const year = extractYear(transaction['Sent Date']);
      if (year) {
        if (!yearlyTotals[year]) {
          yearlyTotals[year] = {
            year: year,
            count: 0,
            total_amount: 0
          };
        }
        yearlyTotals[year].count += 1;
        const amountStr = (transaction.Amount || '').replace(/,/g, '').replace(/\s/g, '');
        yearlyTotals[year].total_amount += parseFloat(amountStr) || 0;
      }
    });
    
    // Convert to array and sort by year (most recent first)
    const yearlyTotalsArray = Object.values(yearlyTotals).sort((a, b) => b.year - a.year);
    
    // Sort transactions by date (most recent first)
    const sortedTransactions = [...grantee.transactions].sort((a, b) => {
      const dateA = extractYear(a['Sent Date']) || 0;
      const dateB = extractYear(b['Sent Date']) || 0;
      if (dateB !== dateA) return dateB - dateA;
      return (b['Sent Date'] || '').localeCompare(a['Sent Date'] || '');
    });
    
    const result = {
      metadata: {
        name: grantee.name,
        ein: grantee.ein || '(no EIN)',
        address: grantee.address || '(no address)',
        total_grants: grantee.transactions.length,
        total_amount: totalAmount,
        first_grant_year: firstGrantYear,
        last_grant_year: lastGrantYear,
      },
      yearly_totals: yearlyTotalsArray,
      transactions: sortedTransactions
    };
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: `Unknown tool: ${name}`,
      },
    ],
    isError: true,
  };
});

// Start server with stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('BIC Grants MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

