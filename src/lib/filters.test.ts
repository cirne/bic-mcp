import { describe, it, expect } from 'vitest';
import {
  extractYear,
  matchesYear,
  matchesYearRange,
  matchesCharity,
  matchesMinAmount,
  matchesMaxAmount,
  sortTransactions,
  groupTransactions,
  selectFields,
  applyFuzzySearch,
} from './filters';
import type { Transaction } from './filters';

describe('extractYear', () => {
  it('should extract year from M/D/YY format (2000-2030)', () => {
    expect(extractYear('10/2/25')).toBe(2025);
    expect(extractYear('1/15/24')).toBe(2024);
    expect(extractYear('12/31/30')).toBe(2030);
    expect(extractYear('1/1/00')).toBe(2000);
  });

  it('should extract year from M/D/YY format (1931-1999)', () => {
    expect(extractYear('1/1/31')).toBe(1931);
    expect(extractYear('12/31/99')).toBe(1999);
    expect(extractYear('6/15/50')).toBe(1950);
  });

  it('should handle MM/DD/YY format', () => {
    expect(extractYear('01/15/24')).toBe(2024);
    expect(extractYear('12/25/25')).toBe(2025);
  });

  it('should return null for invalid dates', () => {
    expect(extractYear('')).toBeNull();
    expect(extractYear(undefined)).toBeNull();
    expect(extractYear('invalid')).toBeNull();
    expect(extractYear('10/2')).toBeNull();
    expect(extractYear('10/2/')).toBeNull();
  });
});

describe('matchesYear', () => {
  it('should match transactions from the specified year', () => {
    const transaction: Transaction = {
      'Sent Date': '10/2/24',
      'Amount': '1,000.00 ',
    };
    expect(matchesYear(transaction, 2024)).toBe(true);
    expect(matchesYear(transaction, 2023)).toBe(false);
    expect(matchesYear(transaction, 2025)).toBe(false);
  });

  it('should check multiple date fields', () => {
    const transaction1: Transaction = {
      'Requested Payment Date': '11/15/24',
      'Sent Date': '',
    };
    expect(matchesYear(transaction1, 2024)).toBe(true);

    const transaction2: Transaction = {
      'Recommendation Submitted Date': '9/1/23',
      'Sent Date': '',
    };
    expect(matchesYear(transaction2, 2023)).toBe(true);

    const transaction3: Transaction = {
      'Cleared Date': '12/31/25',
      'Sent Date': '',
    };
    expect(matchesYear(transaction3, 2025)).toBe(true);
  });

  it('should handle transactions with no dates', () => {
    const transaction: Transaction = {
      'Amount': '1,000.00 ',
    };
    expect(matchesYear(transaction, 2024)).toBe(false);
  });

  it('should return true when year is 0 or falsy', () => {
    const transaction: Transaction = {
      'Sent Date': '10/2/24',
    };
    expect(matchesYear(transaction, 0)).toBe(true);
  });
});

describe('matchesYearRange', () => {
  it('should match transactions within year range', () => {
    const transaction: Transaction = {
      'Sent Date': '6/15/24',
    };
    expect(matchesYearRange(transaction, 2023, 2025)).toBe(true);
    expect(matchesYearRange(transaction, 2024, 2024)).toBe(true);
    expect(matchesYearRange(transaction, 2025, 2026)).toBe(false);
    expect(matchesYearRange(transaction, 2022, 2023)).toBe(false);
  });

  it('should handle minYear only', () => {
    const transaction: Transaction = {
      'Sent Date': '6/15/24',
    };
    expect(matchesYearRange(transaction, 2023)).toBe(true);
    expect(matchesYearRange(transaction, 2025)).toBe(false);
  });

  it('should handle maxYear only', () => {
    const transaction: Transaction = {
      'Sent Date': '6/15/24',
    };
    expect(matchesYearRange(transaction, undefined, 2025)).toBe(true);
    expect(matchesYearRange(transaction, undefined, 2023)).toBe(false);
  });

  it('should return false for transactions with no dates', () => {
    const transaction: Transaction = {
      'Amount': '1,000.00 ',
    };
    expect(matchesYearRange(transaction, 2023, 2025)).toBe(false);
  });

  it('should return true when no range specified', () => {
    const transaction: Transaction = {
      'Sent Date': '6/15/24',
    };
    expect(matchesYearRange(transaction)).toBe(true);
  });

  it('should use the latest year from multiple date fields', () => {
    const transaction: Transaction = {
      'Sent Date': '1/1/23',
      'Cleared Date': '12/31/24',
    };
    expect(matchesYearRange(transaction, 2024, 2024)).toBe(true);
    expect(matchesYearRange(transaction, 2023, 2023)).toBe(false);
  });
});

describe('matchesCharity', () => {
  it('should match exact charity name (case-insensitive)', () => {
    const transaction: Transaction = {
      'Charity': 'Test Charity',
    };
    expect(matchesCharity(transaction, 'Test Charity')).toBe(true);
    expect(matchesCharity(transaction, 'test charity')).toBe(true);
    expect(matchesCharity(transaction, 'TEST CHARITY')).toBe(true);
    expect(matchesCharity(transaction, 'Another Charity')).toBe(false);
  });

  it('should handle whitespace', () => {
    const transaction: Transaction = {
      'Charity': '  Test Charity  ',
    };
    expect(matchesCharity(transaction, 'Test Charity')).toBe(true);
    expect(matchesCharity(transaction, '  Test Charity  ')).toBe(true);
  });

  it('should return true when charityName is empty', () => {
    const transaction: Transaction = {
      'Charity': 'Test Charity',
    };
    expect(matchesCharity(transaction, '')).toBe(true);
  });

  it('should handle missing Charity field', () => {
    const transaction: Transaction = {
      'Amount': '1,000.00 ',
    };
    expect(matchesCharity(transaction, 'Test Charity')).toBe(false);
  });
});

describe('matchesMinAmount', () => {
  it('should filter by minimum amount', () => {
    const transaction: Transaction = {
      'Amount': '5,000.00 ',
    };
    expect(matchesMinAmount(transaction, 1000)).toBe(true);
    expect(matchesMinAmount(transaction, 5000)).toBe(true);
    expect(matchesMinAmount(transaction, 10000)).toBe(false);
  });

  it('should handle amounts with commas and spaces', () => {
    const transaction: Transaction = {
      'Amount': '10,000.00 ',
    };
    expect(matchesMinAmount(transaction, 10000)).toBe(true);
    expect(matchesMinAmount(transaction, 10001)).toBe(false);
  });

  it('should handle invalid amount strings', () => {
    const transaction1: Transaction = {
      'Amount': 'invalid',
    };
    expect(matchesMinAmount(transaction1, 1000)).toBe(false);

    const transaction2: Transaction = {
      'Amount': '',
    };
    expect(matchesMinAmount(transaction2, 1000)).toBe(false);
  });

  it('should return true when minAmount is 0 or falsy', () => {
    const transaction: Transaction = {
      'Amount': '1,000.00 ',
    };
    expect(matchesMinAmount(transaction, 0)).toBe(true);
  });
});

describe('matchesMaxAmount', () => {
  it('should filter by maximum amount', () => {
    const transaction: Transaction = {
      'Amount': '5,000.00 ',
    };
    expect(matchesMaxAmount(transaction, 10000)).toBe(true);
    expect(matchesMaxAmount(transaction, 5000)).toBe(true);
    expect(matchesMaxAmount(transaction, 1000)).toBe(false);
  });

  it('should handle amounts with commas and spaces', () => {
    const transaction: Transaction = {
      'Amount': '10,000.00 ',
    };
    expect(matchesMaxAmount(transaction, 10000)).toBe(true);
    expect(matchesMaxAmount(transaction, 9999)).toBe(false);
  });

  it('should handle invalid amount strings', () => {
    const transaction1: Transaction = {
      'Amount': 'invalid',
    };
    expect(matchesMaxAmount(transaction1, 1000)).toBe(true); // 0 <= 1000

    const transaction2: Transaction = {
      'Amount': '',
    };
    expect(matchesMaxAmount(transaction2, 1000)).toBe(true); // 0 <= 1000
  });

  it('should return true when maxAmount is 0 or falsy', () => {
    const transaction: Transaction = {
      'Amount': '1,000.00 ',
    };
    expect(matchesMaxAmount(transaction, 0)).toBe(true);
  });
});

describe('sortTransactions', () => {
  it('should sort by Amount ascending', () => {
    const transactions: Transaction[] = [
      { 'Amount': '5,000.00 ', 'Charity': 'C' },
      { 'Amount': '1,000.00 ', 'Charity': 'A' },
      { 'Amount': '3,000.00 ', 'Charity': 'B' },
    ];
    const sorted = sortTransactions(transactions, 'Amount', 'asc');
    expect(parseFloat(sorted[0].Amount.replace(/,/g, ''))).toBe(1000);
    expect(parseFloat(sorted[1].Amount.replace(/,/g, ''))).toBe(3000);
    expect(parseFloat(sorted[2].Amount.replace(/,/g, ''))).toBe(5000);
  });

  it('should sort by Amount descending', () => {
    const transactions: Transaction[] = [
      { 'Amount': '1,000.00 ', 'Charity': 'A' },
      { 'Amount': '5,000.00 ', 'Charity': 'C' },
      { 'Amount': '3,000.00 ', 'Charity': 'B' },
    ];
    const sorted = sortTransactions(transactions, 'Amount', 'desc');
    expect(parseFloat(sorted[0].Amount.replace(/,/g, ''))).toBe(5000);
    expect(parseFloat(sorted[1].Amount.replace(/,/g, ''))).toBe(3000);
    expect(parseFloat(sorted[2].Amount.replace(/,/g, ''))).toBe(1000);
  });

  it('should sort by date field (year first, then string)', () => {
    const transactions: Transaction[] = [
      { 'Sent Date': '12/31/24', 'Charity': 'C' },
      { 'Sent Date': '1/1/23', 'Charity': 'A' },
      { 'Sent Date': '6/15/24', 'Charity': 'B' },
    ];
    const sorted = sortTransactions(transactions, 'Sent Date', 'asc');
    expect(extractYear(sorted[0]['Sent Date'])).toBe(2023);
    expect(extractYear(sorted[1]['Sent Date'])).toBe(2024);
    expect(extractYear(sorted[2]['Sent Date'])).toBe(2024);
  });

  it('should sort by string field', () => {
    const transactions: Transaction[] = [
      { 'Charity': 'Charlie', 'Amount': '1,000.00 ' },
      { 'Charity': 'Alpha', 'Amount': '2,000.00 ' },
      { 'Charity': 'Beta', 'Amount': '3,000.00 ' },
    ];
    const sorted = sortTransactions(transactions, 'Charity', 'asc');
    expect(sorted[0].Charity).toBe('Alpha');
    expect(sorted[1].Charity).toBe('Beta');
    expect(sorted[2].Charity).toBe('Charlie');
  });

  it('should return original array when sortBy is empty', () => {
    const transactions: Transaction[] = [
      { 'Charity': 'C' },
      { 'Charity': 'A' },
      { 'Charity': 'B' },
    ];
    const sorted = sortTransactions(transactions, '');
    expect(sorted).toEqual(transactions);
  });

  it('should not mutate original array', () => {
    const transactions: Transaction[] = [
      { 'Amount': '5,000.00 ' },
      { 'Amount': '1,000.00 ' },
    ];
    const sorted = sortTransactions(transactions, 'Amount', 'asc');
    expect(parseFloat(transactions[0].Amount.replace(/,/g, ''))).toBe(5000);
    expect(parseFloat(sorted[0].Amount.replace(/,/g, ''))).toBe(1000);
  });
});

describe('groupTransactions', () => {
  it('should group by year', () => {
    const transactions: Transaction[] = [
      { 'Sent Date': '1/1/23', 'Charity': 'A' },
      { 'Sent Date': '6/15/24', 'Charity': 'B' },
      { 'Sent Date': '12/31/24', 'Charity': 'C' },
    ];
    const grouped = groupTransactions(transactions, 'year');
    expect(grouped['2023']).toHaveLength(1);
    expect(grouped['2024']).toHaveLength(2);
  });

  it('should group by field name', () => {
    const transactions: Transaction[] = [
      { 'Charity': 'A', 'Amount': '1,000.00 ' },
      { 'Charity': 'B', 'Amount': '2,000.00 ' },
      { 'Charity': 'A', 'Amount': '3,000.00 ' },
    ];
    const grouped = groupTransactions(transactions, 'Charity');
    expect(grouped['A']).toHaveLength(2);
    expect(grouped['B']).toHaveLength(1);
  });

  it('should handle transactions with missing field', () => {
    const transactions: Transaction[] = [
      { 'Charity': 'A' },
      { 'Amount': '1,000.00 ' },
      { 'Charity': 'B' },
    ];
    const grouped = groupTransactions(transactions, 'Charity');
    expect(grouped['A']).toHaveLength(1);
    expect(grouped['B']).toHaveLength(1);
    expect(grouped['Unknown']).toHaveLength(1);
  });

  it('should return empty object when groupBy is empty', () => {
    const transactions: Transaction[] = [
      { 'Charity': 'A' },
    ];
    const grouped = groupTransactions(transactions, '');
    expect(grouped).toEqual({});
  });

  it('should handle transactions with no dates when grouping by year', () => {
    const transactions: Transaction[] = [
      { 'Charity': 'A' },
      { 'Sent Date': '1/1/24', 'Charity': 'B' },
    ];
    const grouped = groupTransactions(transactions, 'year');
    expect(grouped['2024']).toHaveLength(1);
    expect(grouped['Unknown']).toHaveLength(1);
  });
});

describe('selectFields', () => {
  it('should select specific fields', () => {
    const transactions: Transaction[] = [
      {
        'Transaction ID': '1',
        'Charity': 'Test',
        'Amount': '1,000.00 ',
        'Sent Date': '10/2/24',
      },
    ];
    const selected = selectFields(transactions, ['Charity', 'Amount']);
    expect(selected[0]).toEqual({
      'Charity': 'Test',
      'Amount': '1,000.00 ',
    });
    expect(selected[0]).not.toHaveProperty('Transaction ID');
    expect(selected[0]).not.toHaveProperty('Sent Date');
  });

  it('should return all fields when fields array is empty', () => {
    const transactions: Transaction[] = [
      {
        'Charity': 'Test',
        'Amount': '1,000.00 ',
      },
    ];
    const selected = selectFields(transactions, []);
    expect(selected[0]).toEqual(transactions[0]);
  });

  it('should handle missing fields gracefully', () => {
    const transactions: Transaction[] = [
      {
        'Charity': 'Test',
      },
    ];
    const selected = selectFields(transactions, ['Charity', 'Amount']);
    expect(selected[0]).toEqual({
      'Charity': 'Test',
    });
  });

  it('should return original array when fields is not provided', () => {
    const transactions: Transaction[] = [
      { 'Charity': 'Test' },
    ];
    const selected = selectFields(transactions, []);
    expect(selected).toEqual(transactions);
  });
});

describe('applyFuzzySearch', () => {
  it('should find transactions matching search term', () => {
    const transactions: Transaction[] = [
      { 'Charity': 'Beloved In Christ Foundation', 'Amount': '1,000.00 ' },
      { 'Charity': 'Test Charity', 'Amount': '2,000.00 ' },
      { 'Charity': 'Another Organization', 'Amount': '3,000.00 ' },
    ];
    const results = applyFuzzySearch(transactions, 'Beloved');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].Charity).toContain('Beloved');
  });

  it('should return empty array when no matches', () => {
    const transactions: Transaction[] = [
      { 'Charity': 'Test Charity', 'Amount': '1,000.00 ' },
    ];
    const results = applyFuzzySearch(transactions, 'NonExistentTermXYZ');
    expect(results.length).toBe(0);
  });

  it('should return original array when searchTerm is empty', () => {
    const transactions: Transaction[] = [
      { 'Charity': 'Test', 'Amount': '1,000.00 ' },
    ];
    const results = applyFuzzySearch(transactions, '');
    expect(results).toEqual(transactions);
  });

  it('should return empty array when transactions array is empty', () => {
    const results = applyFuzzySearch([], 'test');
    expect(results).toEqual([]);
  });

  it('should search across all fields', () => {
    const transactions: Transaction[] = [
      {
        'Charity': 'Test Charity',
        'Grant Purpose': 'Education grant',
        'Amount': '1,000.00 ',
      },
      {
        'Charity': 'Another Charity',
        'Grant Purpose': 'Medical grant',
        'Amount': '2,000.00 ',
      },
    ];
    const results = applyFuzzySearch(transactions, 'Education');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]['Grant Purpose']).toContain('Education');
  });
});

