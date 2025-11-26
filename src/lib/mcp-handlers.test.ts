import { describe, it, expect } from 'vitest';
import {
  handleListTransactions,
  handleListGrantees,
  handleShowGrantee,
} from './mcp-handlers';
import type { Transaction } from './filters';

const mockTransactions: Transaction[] = [
  {
    'Transaction ID': '1',
    'Charity': 'Test Charity',
    'EIN': '12-3456789',
    'Charity Address': '123 Main St',
    'Amount': '5,000.00',
    'Sent Date': '10/2/24',
    'Grant Purpose': 'Test grant purpose',
    'Special Note': 'Test note',
  },
  {
    'Transaction ID': '2',
    'Charity': 'Another Charity',
    'EIN': '98-7654321',
    'Charity Address': '456 Oak Ave',
    'Amount': '10,000.00',
    'Sent Date': '11/15/24',
    'Grant Purpose': 'Another grant purpose',
    'Special Note': 'Another note',
  },
  {
    'Transaction ID': '3',
    'Charity': 'Test Charity',
    'EIN': '12-3456789',
    'Charity Address': '123 Main St',
    'Amount': '15,000.00',
    'Sent Date': '9/1/23',
    'Grant Purpose': 'Earlier grant',
  },
];

describe('handleListTransactions', () => {
  it('should return all transactions when no filters', () => {
    const result = handleListTransactions(mockTransactions, {});
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveLength(3);
  });

  it('should filter by charity', () => {
    const result = handleListTransactions(mockTransactions, {
      charity: 'Test Charity',
    });
    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveLength(2);
    expect(data[0].Charity).toBe('Test Charity');
    expect(data[1].Charity).toBe('Test Charity');
  });

  it('should filter by year', () => {
    const result = handleListTransactions(mockTransactions, {
      year: 2024,
    });
    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveLength(2);
    expect(data.every((t: Transaction) => 
      t['Sent Date']?.includes('/24') || 
      t['Requested Payment Date']?.includes('/24')
    )).toBe(true);
  });

  it('should filter by min_year', () => {
    const result = handleListTransactions(mockTransactions, {
      min_year: 2024,
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.length).toBeGreaterThanOrEqual(2);
  });

  it('should filter by max_year', () => {
    const result = handleListTransactions(mockTransactions, {
      max_year: 2023,
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.length).toBeGreaterThanOrEqual(1);
  });

  it('should filter by min_amount', () => {
    const result = handleListTransactions(mockTransactions, {
      min_amount: 10000,
    });
    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveLength(2);
    data.forEach((t: Transaction) => {
      const amount = parseFloat((t.Amount || '').replace(/,/g, '')) || 0;
      expect(amount).toBeGreaterThanOrEqual(10000);
    });
  });

  it('should filter by max_amount', () => {
    const result = handleListTransactions(mockTransactions, {
      max_amount: 10000,
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.length).toBeGreaterThanOrEqual(1);
    data.forEach((t: Transaction) => {
      const amount = parseFloat((t.Amount || '').replace(/,/g, '')) || 0;
      expect(amount).toBeLessThanOrEqual(10000);
    });
  });

  it('should combine multiple filters', () => {
    const result = handleListTransactions(mockTransactions, {
      charity: 'Test Charity',
      year: 2024,
      min_amount: 5000,
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data[0].Charity).toBe('Test Charity');
  });

  it('should sort by Amount descending', () => {
    const result = handleListTransactions(mockTransactions, {
      sort_by: 'Amount',
      sort_order: 'desc',
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.length).toBeGreaterThanOrEqual(2);
    const firstAmount = parseFloat((data[0].Amount || '').replace(/,/g, '')) || 0;
    const secondAmount = parseFloat((data[1].Amount || '').replace(/,/g, '')) || 0;
    expect(firstAmount).toBeGreaterThanOrEqual(secondAmount);
  });

  it('should sort by Sent Date ascending', () => {
    const result = handleListTransactions(mockTransactions, {
      sort_by: 'Sent Date',
      sort_order: 'asc',
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.length).toBeGreaterThanOrEqual(2);
  });

  it('should select specific fields', () => {
    const result = handleListTransactions(mockTransactions, {
      fields: ['Charity', 'Amount'],
    });
    const data = JSON.parse(result.content[0].text);
    expect(data[0]).toHaveProperty('Charity');
    expect(data[0]).toHaveProperty('Amount');
    expect(data[0]).not.toHaveProperty('Transaction ID');
    expect(data[0]).not.toHaveProperty('Sent Date');
  });

  it('should group by year', () => {
    const result = handleListTransactions(mockTransactions, {
      group_by: 'year',
    });
    const data = JSON.parse(result.content[0].text);
    expect(typeof data).toBe('object');
    expect(Array.isArray(data)).toBe(false);
    expect(Object.keys(data).length).toBeGreaterThan(0);
  });

  it('should group by Charity', () => {
    const result = handleListTransactions(mockTransactions, {
      group_by: 'Charity',
    });
    const data = JSON.parse(result.content[0].text);
    expect(typeof data).toBe('object');
    expect(data['Test Charity']).toBeDefined();
    expect(data['Another Charity']).toBeDefined();
  });

  it('should apply fuzzy search', () => {
    const result = handleListTransactions(mockTransactions, {
      search_term: 'Test',
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.length).toBeGreaterThan(0);
  });

  it('should validate year parameter', () => {
    const result = handleListTransactions(mockTransactions, {
      year: 1800, // Invalid
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error');
  });

  it('should validate min_year parameter', () => {
    const result = handleListTransactions(mockTransactions, {
      min_year: 1800, // Invalid
    });
    expect(result.isError).toBe(true);
  });

  it('should validate max_year parameter', () => {
    const result = handleListTransactions(mockTransactions, {
      max_year: 1800, // Invalid
    });
    expect(result.isError).toBe(true);
  });

  it('should validate min_amount parameter', () => {
    const result = handleListTransactions(mockTransactions, {
      min_amount: -100, // Invalid
    });
    expect(result.isError).toBe(true);
  });

  it('should validate max_amount parameter', () => {
    const result = handleListTransactions(mockTransactions, {
      max_amount: -100, // Invalid
    });
    expect(result.isError).toBe(true);
  });

  it('should validate search_term parameter type', () => {
    const result = handleListTransactions(mockTransactions, {
      search_term: 123 as any, // Invalid type
    });
    expect(result.isError).toBe(true);
  });

  it('should validate charity parameter type', () => {
    const result = handleListTransactions(mockTransactions, {
      charity: 123 as any, // Invalid type
    });
    expect(result.isError).toBe(true);
  });

  it('should handle empty transactions array', () => {
    const result = handleListTransactions([], {});
    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveLength(0);
  });
});

describe('handleListGrantees', () => {
  it('should return all grantees', () => {
    const result = handleListGrantees(mockTransactions, {});
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveLength(2);
    expect(data[0]).toHaveProperty('name');
    expect(data[0]).toHaveProperty('ein');
    expect(data[0]).toHaveProperty('total_amount');
    expect(data[0]).toHaveProperty('transaction_count');
  });

  it('should calculate total_amount correctly', () => {
    const result = handleListGrantees(mockTransactions, {});
    const data = JSON.parse(result.content[0].text);
    const testCharity = data.find((g: any) => g.name === 'Test Charity');
    expect(testCharity).toBeDefined();
    expect(testCharity.total_amount).toBe(20000); // 5000 + 15000
  });

  it('should calculate transaction_count correctly', () => {
    const result = handleListGrantees(mockTransactions, {});
    const data = JSON.parse(result.content[0].text);
    const testCharity = data.find((g: any) => g.name === 'Test Charity');
    expect(testCharity.transaction_count).toBe(2);
  });

  it('should sort by name ascending', () => {
    const result = handleListGrantees(mockTransactions, {
      sort_by: 'name',
      sort_order: 'asc',
    });
    const data = JSON.parse(result.content[0].text);
    expect(data[0].name.localeCompare(data[1].name)).toBeLessThanOrEqual(0);
  });

  it('should sort by name descending', () => {
    const result = handleListGrantees(mockTransactions, {
      sort_by: 'name',
      sort_order: 'desc',
    });
    const data = JSON.parse(result.content[0].text);
    expect(data[0].name.localeCompare(data[1].name)).toBeGreaterThanOrEqual(0);
  });

  it('should sort by total_amount descending', () => {
    const result = handleListGrantees(mockTransactions, {
      sort_by: 'total_amount',
      sort_order: 'desc',
    });
    const data = JSON.parse(result.content[0].text);
    expect(data[0].total_amount).toBeGreaterThanOrEqual(data[1].total_amount);
  });

  it('should sort by total_amount ascending', () => {
    const result = handleListGrantees(mockTransactions, {
      sort_by: 'total_amount',
      sort_order: 'asc',
    });
    const data = JSON.parse(result.content[0].text);
    expect(data[0].total_amount).toBeLessThanOrEqual(data[1].total_amount);
  });

  it('should sort by ein', () => {
    const result = handleListGrantees(mockTransactions, {
      sort_by: 'ein',
      sort_order: 'asc',
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.length).toBeGreaterThan(0);
  });

  it('should filter by year', () => {
    const result = handleListGrantees(mockTransactions, {
      year: 2024,
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.length).toBeGreaterThan(0);
    // All grantees should have transactions in 2024
    data.forEach((g: any) => {
      expect(g.transaction_count).toBeGreaterThan(0);
    });
  });

  it('should validate year parameter', () => {
    const result = handleListGrantees(mockTransactions, {
      year: 1800, // Invalid
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error');
  });

  it('should handle empty transactions array', () => {
    const result = handleListGrantees([], {});
    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveLength(0);
  });

  it('should include most_recent_grant_note', () => {
    const result = handleListGrantees(mockTransactions, {});
    const data = JSON.parse(result.content[0].text);
    expect(data[0]).toHaveProperty('most_recent_grant_note');
  });
});

describe('handleShowGrantee', () => {
  it('should return grantee details', () => {
    const result = handleShowGrantee(mockTransactions, {
      charity: 'Test Charity',
    });
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.metadata.name).toBe('Test Charity');
    expect(data.metadata.ein).toBe('12-3456789');
    expect(data.metadata.address).toBe('123 Main St');
    expect(data.transactions).toHaveLength(2);
  });

  it('should calculate total_amount correctly', () => {
    const result = handleShowGrantee(mockTransactions, {
      charity: 'Test Charity',
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.metadata.total_amount).toBe(20000); // 5000 + 15000
    expect(data.metadata.total_grants).toBe(2);
  });

  it('should calculate yearly totals', () => {
    const result = handleShowGrantee(mockTransactions, {
      charity: 'Test Charity',
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.yearly_totals).toBeDefined();
    expect(Array.isArray(data.yearly_totals)).toBe(true);
    expect(data.yearly_totals.length).toBeGreaterThan(0);
    
    const yearlyTotal = data.yearly_totals.find((yt: any) => yt.year === 2024);
    expect(yearlyTotal).toBeDefined();
    expect(yearlyTotal.count).toBeGreaterThan(0);
    expect(yearlyTotal.total_amount).toBeGreaterThan(0);
  });

  it('should sort transactions by date (most recent first)', () => {
    const result = handleShowGrantee(mockTransactions, {
      charity: 'Test Charity',
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.transactions.length).toBeGreaterThan(1);
    // First transaction should be more recent than second
    const firstYear = parseInt(data.transactions[0]['Sent Date']?.split('/')[2] || '0');
    const secondYear = parseInt(data.transactions[1]['Sent Date']?.split('/')[2] || '0');
    expect(firstYear).toBeGreaterThanOrEqual(secondYear);
  });

  it('should return error for non-existent grantee', () => {
    const result = handleShowGrantee(mockTransactions, {
      charity: 'Non-existent Charity',
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error');
    expect(result.content[0].text).toContain('not found');
  });

  it('should validate charity parameter', () => {
    const result = handleShowGrantee(mockTransactions, {
      charity: '' as any,
    });
    expect(result.isError).toBe(true);
  });

  it('should validate charity parameter type', () => {
    const result = handleShowGrantee(mockTransactions, {
      charity: 123 as any,
    });
    expect(result.isError).toBe(true);
  });

  it('should find grantee with EIN', () => {
    const result = handleShowGrantee(mockTransactions, {
      charity: 'Test Charity',
      ein: '12-3456789',
    });
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.metadata.name).toBe('Test Charity');
  });

  it('should handle case-insensitive charity name', () => {
    const result = handleShowGrantee(mockTransactions, {
      charity: 'test charity',
    });
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.metadata.name).toBe('Test Charity');
  });

  it('should include first_grant_year and last_grant_year', () => {
    const result = handleShowGrantee(mockTransactions, {
      charity: 'Test Charity',
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.metadata).toHaveProperty('first_grant_year');
    expect(data.metadata).toHaveProperty('last_grant_year');
  });

  it('should handle empty transactions array', () => {
    const result = handleShowGrantee([], {
      charity: 'Test Charity',
    });
    expect(result.isError).toBe(true);
  });
});

