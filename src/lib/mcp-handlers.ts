import { Transaction } from './filters';
import {
  matchesYear,
  matchesYearRange,
  matchesCharity,
  matchesMinAmount,
  matchesMaxAmount,
  sortTransactions,
  groupTransactions,
  selectFields,
  applyFuzzySearch,
  extractYear,
} from './filters';
import {
  getAllGrantees,
  getMostRecentGrantNote,
  findGrantee,
} from './grantees';

export interface MCPToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

export function handleListTransactions(
  transactions: Transaction[],
  args: {
    search_term?: string;
    charity?: string;
    year?: number;
    min_year?: number;
    max_year?: number;
    min_amount?: number;
    max_amount?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
    group_by?: string;
    fields?: string[];
  }
): MCPToolResult {
  const {
    search_term: searchTerm,
    charity,
    year,
    min_year: minYear,
    max_year: maxYear,
    min_amount: minAmount,
    max_amount: maxAmount,
    sort_by: sortBy,
    sort_order: sortOrder = 'asc',
    group_by: groupBy,
    fields,
  } = args;

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
    matches = applyFuzzySearch(matches, searchTerm);
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
  let result: Transaction[] | Record<string, Transaction[]>;
  if (groupBy) {
    const grouped = groupTransactions(matches, groupBy);
    // If grouping, also select fields for each group
    if (fields && fields.length > 0) {
      const groupedWithFields: Record<string, Transaction[]> = {};
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

export function handleListGrantees(
  transactions: Transaction[],
  args: {
    year?: number;
    sort_by?: 'name' | 'ein' | 'recent_date' | 'total_amount';
    sort_order?: 'asc' | 'desc';
  }
): MCPToolResult {
  const {
    year,
    sort_by: sortBy = 'name',
    sort_order: sortOrder = 'asc',
  } = args;

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

  const allGrantees = getAllGrantees(transactions);

  // Build list with most recent grant note, transaction count, and total amount
  const granteeList = allGrantees
    .map(grantee => {
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
        total_amount: totalAmount,
      };
    })
    .filter(g => g !== null) as Array<{
      name: string;
      ein: string;
      most_recent_grant_note: string | null;
      transaction_count: number;
      total_amount: number;
    }>;

  // Sort the list
  granteeList.sort((a, b) => {
    let aVal: any, bVal: any;

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

      const dateA =
        transactionsA.length > 0 ? (extractYear(transactionsA[0]?.['Sent Date']) || 0) : 0;
      const dateB =
        transactionsB.length > 0 ? (extractYear(transactionsB[0]?.['Sent Date']) || 0) : 0;

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

export function handleShowGrantee(
  transactions: Transaction[],
  args: {
    charity: string;
    ein?: string;
  }
): MCPToolResult {
  const { charity: charityName, ein } = args;

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

  const grantee = findGrantee(transactions, charityName, ein);

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
  const dates = (grantee.transactions
    .map(t => extractYear(t['Sent Date']))
    .filter(d => d !== null) as number[])
    .sort((a, b) => a - b);

  const firstGrantYear = dates.length > 0 ? dates[0] : null;
  const lastGrantYear = dates.length > 0 ? dates[dates.length - 1] : null;

  // Calculate yearly totals
  const yearlyTotals: Record<number, { year: number; count: number; total_amount: number }> = {};
  grantee.transactions.forEach(transaction => {
    const year = extractYear(transaction['Sent Date']);
    if (year) {
      if (!yearlyTotals[year]) {
        yearlyTotals[year] = {
          year: year,
          count: 0,
          total_amount: 0,
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
    transactions: sortedTransactions,
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

