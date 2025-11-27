import { Transaction } from './filters';
import {
  matchesYear,
  matchesYearRange,
  matchesCharity,
  matchesMinAmount,
  matchesMaxAmount,
  matchesGrantStatus,
  sortTransactions,
  groupTransactions,
  selectFields,
  applyFuzzySearch,
  extractYear,
  getStringValue,
} from './filters';
import {
  getAllGrantees,
  getMostRecentGrantNote,
  findGrantee,
} from './grantees';
import { getGranteeCategory, getGranteeInternational, getGranteeIsBeloved, getGranteeNotes } from './grantee-metadata';

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
    category?: string;
    grant_status?: string;
    year?: number;
    min_year?: number;
    max_year?: number;
    min_amount?: number;
    max_amount?: number;
    is_beloved?: boolean | null;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
    group_by?: string;
    fields?: string[];
  }
): MCPToolResult {
  const {
    search_term: searchTerm,
    charity,
    category,
    grant_status: grantStatus,
    year,
    min_year: minYear,
    max_year: maxYear,
    min_amount: minAmount,
    max_amount: maxAmount,
    is_beloved: isBeloved,
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

  if (grantStatus !== undefined && typeof grantStatus !== 'string') {
    return {
      content: [
        {
          type: 'text',
          text: 'Error: grant_status must be a string if provided',
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

  // Apply grant_status filter
  if (grantStatus !== undefined) {
    matches = matches.filter(t => matchesGrantStatus(t, grantStatus));
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

  // Apply category filter if provided (before adding Category field)
  if (category !== undefined) {
    matches = matches.filter(t => {
      const charityName = getStringValue(t.Charity).trim();
      const ein = getStringValue(t.EIN).trim();
      const granteeCategory = getGranteeCategory(charityName, ein);
      return granteeCategory?.toLowerCase() === category.toLowerCase();
    });
  }

  // Apply is_beloved filter if provided (before adding Is Beloved field)
  // undefined or null means include everything (beloved and non-beloved)
  if (isBeloved !== undefined && isBeloved !== null) {
    matches = matches.filter(t => {
      const charityName = getStringValue(t.Charity).trim();
      const ein = getStringValue(t.EIN).trim();
      const granteeIsBeloved = getGranteeIsBeloved(charityName, ein);
      return granteeIsBeloved === isBeloved;
    });
  }

  // Add category, international, and is_beloved fields to each transaction
  matches = matches.map(transaction => {
    const charity = getStringValue(transaction.Charity).trim();
    const ein = getStringValue(transaction.EIN).trim();
    const category = getGranteeCategory(charity, ein);
    const international = getGranteeInternational(charity, ein);
    const isBelovedValue = getGranteeIsBeloved(charity, ein);
    
    return {
      ...transaction,
      Category: category || null,
      International: international,
      'Is Beloved': isBelovedValue,
    };
  });

  // Apply sorting
  if (sortBy) {
    matches = sortTransactions(matches, sortBy, sortOrder);
  }

  // Apply field selection
  if (fields && fields.length > 0) {
    matches = selectFields(matches, fields);
    // Always ensure Category, International, and Is Beloved are included
    matches = matches.map(transaction => {
      const charity = getStringValue(transaction.Charity).trim();
      const ein = getStringValue(transaction.EIN).trim();
      if (!transaction.Category) {
        const category = getGranteeCategory(charity, ein);
        transaction.Category = category || null;
      }
      if (transaction.International === undefined) {
        const international = getGranteeInternational(charity, ein);
        transaction.International = international;
      }
      if (transaction['Is Beloved'] === undefined) {
        const isBelovedValue = getGranteeIsBeloved(charity, ein);
        transaction['Is Beloved'] = isBelovedValue;
      }
      return transaction;
    });
  }

  // Apply grouping (after sorting and field selection)
  let result: Transaction[] | Record<string, Transaction[]>;
  if (groupBy) {
    const grouped = groupTransactions(matches, groupBy);
    // If grouping, also select fields for each group
    if (fields && fields.length > 0) {
      const groupedWithFields: Record<string, Transaction[]> = {};
      Object.keys(grouped).forEach(key => {
        let groupTransactions = selectFields(grouped[key], fields);
        // Always ensure Category, International, and Is Beloved are included
        groupTransactions = groupTransactions.map(transaction => {
          const charity = getStringValue(transaction.Charity).trim();
          const ein = getStringValue(transaction.EIN).trim();
          if (!transaction.Category) {
            const category = getGranteeCategory(charity, ein);
            transaction.Category = category || null;
          }
          if (transaction.International === undefined) {
            const international = getGranteeInternational(charity, ein);
            transaction.International = international;
          }
          if (transaction['Is Beloved'] === undefined) {
            const isBelovedValue = getGranteeIsBeloved(charity, ein);
            transaction['Is Beloved'] = isBelovedValue;
          }
          return transaction;
        });
        groupedWithFields[key] = groupTransactions;
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
    category?: string;
    is_beloved?: boolean | null;
    sort_by?: 'name' | 'ein' | 'recent_date' | 'total_amount';
    sort_order?: 'asc' | 'desc';
  }
): MCPToolResult {
  const {
    year,
    category,
    is_beloved: isBeloved,
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

      // Filter by category if provided
      if (category !== undefined) {
        const granteeCategory = getGranteeCategory(grantee.name, grantee.ein);
        if (granteeCategory?.toLowerCase() !== category.toLowerCase()) {
          return null;
        }
      }

      // Filter by is_beloved if provided
      // undefined or null means include everything (beloved and non-beloved)
      if (isBeloved !== undefined && isBeloved !== null && grantee.is_beloved !== isBeloved) {
        return null;
      }

      // Calculate total amount for filtered transactions
      const totalAmount = relevantTransactions.reduce((sum, t) => {
        const amountStr = getStringValue(t.Amount).replace(/,/g, '').replace(/\s/g, '');
        return sum + (parseFloat(amountStr) || 0);
      }, 0);

      // Get most recent grant note from filtered transactions (or all if no year filter)
      const mostRecentNote = getMostRecentGrantNote(relevantTransactions);

      return {
        name: grantee.name,
        ein: grantee.ein || '(no EIN)',
        international: grantee.international,
        is_beloved: grantee.is_beloved,
        most_recent_grant_note: mostRecentNote || '(no notes)',
        transaction_count: relevantTransactions.length,
        total_amount: totalAmount,
      };
    })
    .filter(g => g !== null) as Array<{
      name: string;
      ein: string;
      international: boolean;
      is_beloved: boolean;
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
        const date1Str = getStringValue(t1['Sent Date']);
        const date2Str = getStringValue(t2['Sent Date']);
        const date1 = extractYear(date1Str) || 0;
        const date2 = extractYear(date2Str) || 0;
        if (date2 !== date1) return date2 - date1;
        return date2Str.localeCompare(date1Str);
      });

      transactionsB.sort((t1, t2) => {
        const date1Str = getStringValue(t1['Sent Date']);
        const date2Str = getStringValue(t2['Sent Date']);
        const date1 = extractYear(date1Str) || 0;
        const date2 = extractYear(date2Str) || 0;
        if (date2 !== date1) return date2 - date1;
        return date2Str.localeCompare(date1Str);
      });

      const dateA =
        transactionsA.length > 0 ? (extractYear(getStringValue(transactionsA[0]?.['Sent Date'])) || 0) : 0;
      const dateB =
        transactionsB.length > 0 ? (extractYear(getStringValue(transactionsB[0]?.['Sent Date'])) || 0) : 0;

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

  // Separate cleared and non-cleared transactions
  const clearedTransactions = grantee.transactions.filter(
    t => getStringValue(t['Grant Status']) === 'Payment Cleared'
  );
  const nonClearedTransactions = grantee.transactions.filter(
    t => getStringValue(t['Grant Status']) !== 'Payment Cleared'
  );

  // Calculate totals and statistics (only from cleared transactions)
  const totalAmount = clearedTransactions.reduce((sum, t) => {
    const amountStr = getStringValue(t.Amount).replace(/,/g, '').replace(/\s/g, '');
    return sum + (parseFloat(amountStr) || 0);
  }, 0);

  // Get date range from cleared transactions
  const dates = (clearedTransactions
    .map(t => extractYear(getStringValue(t['Sent Date'])))
    .filter(d => d !== null) as number[])
    .sort((a, b) => a - b);

  const firstGrantYear = dates.length > 0 ? dates[0] : null;
  const lastGrantYear = dates.length > 0 ? dates[dates.length - 1] : null;

  // Calculate yearly totals (only from cleared transactions)
  const yearlyTotals: Record<number, { year: number; count: number; total_amount: number }> = {};
  clearedTransactions.forEach(transaction => {
    const year = extractYear(getStringValue(transaction['Sent Date']));
    if (year) {
      if (!yearlyTotals[year]) {
        yearlyTotals[year] = {
          year: year,
          count: 0,
          total_amount: 0,
        };
      }
      yearlyTotals[year].count += 1;
      const amountStr = getStringValue(transaction.Amount).replace(/,/g, '').replace(/\s/g, '');
      yearlyTotals[year].total_amount += parseFloat(amountStr) || 0;
    }
  });

  // Convert to array and sort by year (most recent first)
  const yearlyTotalsArray = Object.values(yearlyTotals).sort((a, b) => b.year - a.year);

  // Calculate status breakdown
  const statusBreakdown: Record<string, { count: number; total_amount: number }> = {};
  grantee.transactions.forEach(transaction => {
    const status = getStringValue(transaction['Grant Status']) || '(no status)';
    if (!statusBreakdown[status]) {
      statusBreakdown[status] = {
        count: 0,
        total_amount: 0,
      };
    }
    statusBreakdown[status].count += 1;
    const amountStr = getStringValue(transaction.Amount).replace(/,/g, '').replace(/\s/g, '');
    statusBreakdown[status].total_amount += parseFloat(amountStr) || 0;
  });

  // Convert status breakdown to array, sorted by status name
  const statusBreakdownArray = Object.entries(statusBreakdown)
    .map(([status, data]) => ({
      status,
      ...data,
    }))
    .sort((a, b) => a.status.localeCompare(b.status));

  // Sort transactions by date (most recent first)
  const sortedTransactions = [...grantee.transactions].sort((a, b) => {
    const dateAStr = getStringValue(a['Sent Date']);
    const dateBStr = getStringValue(b['Sent Date']);
    const dateA = extractYear(dateAStr) || 0;
    const dateB = extractYear(dateBStr) || 0;
    if (dateB !== dateA) return dateB - dateA;
    return dateBStr.localeCompare(dateAStr);
  });

  const category = getGranteeCategory(grantee.name, grantee.ein);
  const notes = getGranteeNotes(grantee.name, grantee.ein);
  
  const result = {
    metadata: {
      name: grantee.name,
      ein: grantee.ein || '(no EIN)',
      address: grantee.address || '(no address)',
      category: category || null,
      notes: notes || null,
      international: grantee.international,
      is_beloved: grantee.is_beloved,
      total_grants: grantee.transactions.length,
      cleared_grants: clearedTransactions.length,
      non_cleared_grants: nonClearedTransactions.length,
      total_amount: totalAmount, // Only cleared transactions
      first_grant_year: firstGrantYear,
      last_grant_year: lastGrantYear,
    },
    status_breakdown: statusBreakdownArray,
    yearly_totals: yearlyTotalsArray, // Only cleared transactions
    transactions: sortedTransactions, // All transactions (cleared and non-cleared)
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

export function handleAggregateTransactions(
  transactions: Transaction[],
  args: {
    group_by: 'category' | 'grantee' | 'year' | 'international' | 'is_beloved' | 'status';
    year?: number;
    min_year?: number;
    max_year?: number;
    min_amount?: number;
    max_amount?: number;
    category?: string;
    charity?: string;
    is_beloved?: boolean | null;
    sort_by?: 'count' | 'total_amount' | 'name';
    sort_order?: 'asc' | 'desc';
  }
): MCPToolResult {
  const {
    group_by: groupBy,
    year,
    min_year: minYear,
    max_year: maxYear,
    min_amount: minAmount,
    max_amount: maxAmount,
    category,
    charity,
    is_beloved: isBeloved,
    sort_by: sortBy = 'total_amount',
    sort_order: sortOrder = 'desc',
  } = args;

  // Validate group_by
  if (!groupBy || !['category', 'grantee', 'year', 'international', 'is_beloved', 'status'].includes(groupBy)) {
    return {
      content: [
        {
          type: 'text',
          text: 'Error: group_by must be one of: category, grantee, year, international, is_beloved, status',
        },
      ],
      isError: true,
    };
  }

  // Filter transactions
  let matches = [...transactions];

  // Filter by year
  if (year !== undefined) {
    matches = matches.filter(t => matchesYear(t, year));
  }

  // Filter by year range
  if (minYear !== undefined || maxYear !== undefined) {
    matches = matches.filter(t => matchesYearRange(t, minYear, maxYear));
  }

  // Filter by amount
  if (minAmount !== undefined) {
    matches = matches.filter(t => matchesMinAmount(t, minAmount));
  }
  if (maxAmount !== undefined) {
    matches = matches.filter(t => matchesMaxAmount(t, maxAmount));
  }

  // Filter by charity
  if (charity !== undefined) {
    matches = matches.filter(t => matchesCharity(t, charity));
  }

  // Filter by category (if grouping by something else)
  if (category !== undefined && groupBy !== 'category') {
    matches = matches.filter(t => {
      const charityName = getStringValue(t.Charity).trim();
      const ein = getStringValue(t.EIN).trim();
      const granteeCategory = getGranteeCategory(charityName, ein);
      return granteeCategory?.toLowerCase() === category.toLowerCase();
    });
  }

  // Filter by is_beloved (if grouping by something else)
  // undefined or null means include everything (beloved and non-beloved)
  if (isBeloved !== undefined && isBeloved !== null && groupBy !== 'is_beloved') {
    matches = matches.filter(t => {
      const charityName = getStringValue(t.Charity).trim();
      const ein = getStringValue(t.EIN).trim();
      const granteeIsBeloved = getGranteeIsBeloved(charityName, ein);
      return granteeIsBeloved === isBeloved;
    });
  }

  // Only include Payment Cleared grants (unless grouping by status, in which case include all statuses)
  if (groupBy !== 'status') {
    matches = matches.filter(t => getStringValue(t['Grant Status']) === 'Payment Cleared');
  }

  // Aggregate by group_by field
  const aggregated: Record<string, { count: number; total_amount: number; name?: string }> = {};

  matches.forEach(transaction => {
    let key: string;
    let name: string | undefined;

    if (groupBy === 'category') {
      const charityName = getStringValue(transaction.Charity).trim();
      const ein = getStringValue(transaction.EIN).trim();
      const granteeCategory = getGranteeCategory(charityName, ein);
      key = granteeCategory || 'Unknown';
    } else if (groupBy === 'grantee') {
      const charityName = getStringValue(transaction.Charity).trim();
      const ein = getStringValue(transaction.EIN).trim();
      key = `${charityName}|${ein || '(no EIN)'}`;
      name = charityName;
    } else if (groupBy === 'year') {
      const year = extractYear(getStringValue(transaction['Sent Date']));
      key = year ? year.toString() : 'Unknown';
    } else if (groupBy === 'international') {
      const charityName = getStringValue(transaction.Charity).trim();
      const ein = getStringValue(transaction.EIN).trim();
      const international = getGranteeInternational(charityName, ein);
      key = international ? 'true' : 'false';
    } else if (groupBy === 'is_beloved') {
      const charityName = getStringValue(transaction.Charity).trim();
      const ein = getStringValue(transaction.EIN).trim();
      const isBelovedValue = getGranteeIsBeloved(charityName, ein);
      key = isBelovedValue ? 'true' : 'false';
    } else if (groupBy === 'status') {
      const status = getStringValue(transaction['Grant Status']).trim();
      key = status || '(no status)';
    } else {
      key = 'Unknown';
    }

    if (!aggregated[key]) {
      aggregated[key] = {
        count: 0,
        total_amount: 0,
        ...(name && { name }),
      };
    }

    aggregated[key].count += 1;
    const amountStr = getStringValue(transaction.Amount).replace(/,/g, '').replace(/\s/g, '');
    aggregated[key].total_amount += parseFloat(amountStr) || 0;
  });

  // Convert to array
  let result = Object.keys(aggregated).map(key => {
    const item = aggregated[key];
    let fieldName: string;
    if (groupBy === 'grantee') {
      fieldName = 'grantee';
    } else if (groupBy === 'category') {
      fieldName = 'category';
    } else if (groupBy === 'year') {
      fieldName = 'year';
    } else if (groupBy === 'international') {
      fieldName = 'international';
    } else if (groupBy === 'is_beloved') {
      fieldName = 'is_beloved';
    } else if (groupBy === 'status') {
      fieldName = 'status';
    } else {
      fieldName = groupBy;
    }
    return {
      [fieldName]: key,
      ...(groupBy === 'grantee' && item.name ? { name: item.name } : {}),
      count: item.count,
      total_amount: item.total_amount,
    };
  });

  // Sort results
  if (sortBy === 'count') {
    result.sort((a, b) => sortOrder === 'asc' ? a.count - b.count : b.count - a.count);
  } else if (sortBy === 'total_amount') {
    result.sort((a, b) => sortOrder === 'asc' ? a.total_amount - b.total_amount : b.total_amount - a.total_amount);
  } else if (sortBy === 'name' && groupBy === 'grantee') {
    result.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });
  } else if (sortBy === 'name' && groupBy === 'category') {
    result.sort((a, b) => {
      const nameA = (('category' in a && typeof a.category === 'string' ? a.category : '') || '').toLowerCase();
      const nameB = (('category' in b && typeof b.category === 'string' ? b.category : '') || '').toLowerCase();
      return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });
  } else if (sortBy === 'name' && groupBy === 'status') {
    result.sort((a, b) => {
      const nameA = (('status' in a && typeof a.status === 'string' ? a.status : '') || '').toLowerCase();
      const nameB = (('status' in b && typeof b.status === 'string' ? b.status : '') || '').toLowerCase();
      return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });
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

