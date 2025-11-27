import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleListTransactions,
  handleListGrantees,
  handleShowGrantee,
} from './mcp-handlers';
import type { Transaction } from './filters';

// Mock the grantee-metadata module
vi.mock('./grantee-metadata', () => ({
  getGranteeCategory: vi.fn((charity: string, ein: string) => {
    if (charity === 'Test Charity' && ein === '12-3456789') {
      return 'Evangelism';
    }
    if (charity === 'Another Charity' && ein === '98-7654321') {
      return 'Matthew 25';
    }
    if (charity === 'International Charity' && ein === '99-9999999') {
      return 'Evangelism';
    }
    return null;
  }),
  getGranteeNotes: vi.fn((charity: string, ein: string) => {
    if (charity === 'Test Charity' && ein === '12-3456789') {
      return 'Test notes for Test Charity';
    }
    return null;
  }),
  getGranteeInternational: vi.fn((charity: string, ein: string) => {
    if (charity === 'International Charity' && ein === '99-9999999') {
      return true;
    }
    return false;
  }),
  getGranteeIsBeloved: vi.fn((charity: string, ein: string) => {
    if (charity === 'Beloved Charity' && ein === '11-1111111') {
      return true;
    }
    return false;
  }),
}));

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
    'Grant Status': 'Payment Cleared',
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
    'Grant Status': 'Payment Cleared',
  },
  {
    'Transaction ID': '3',
    'Charity': 'Test Charity',
    'EIN': '12-3456789',
    'Charity Address': '123 Main St',
    'Amount': '15,000.00',
    'Sent Date': '9/1/23',
    'Grant Purpose': 'Earlier grant',
    'Grant Status': 'Payment Cleared',
  },
];

describe('handleListTransactions', () => {
  it('should return all transactions when no filters', () => {
    const result = handleListTransactions(mockTransactions, {});
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveLength(3);
    // Check that Category, International, and Is Beloved are included
    expect(data[0]).toHaveProperty('Category');
    expect(data[0]).toHaveProperty('International');
    expect(data[0]).toHaveProperty('Is Beloved');
    expect(typeof data[0].International).toBe('boolean');
    expect(typeof data[0]['Is Beloved']).toBe('boolean');
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
    expect(data.every((t: Transaction) => {
      const sentDate = typeof t['Sent Date'] === 'string' ? t['Sent Date'] : '';
      const reqDate = typeof t['Requested Payment Date'] === 'string' ? t['Requested Payment Date'] : '';
      return sentDate.includes('/24') || reqDate.includes('/24');
    })).toBe(true);
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
      const amountStr = typeof t.Amount === 'string' ? t.Amount : '';
      const amount = parseFloat(amountStr.replace(/,/g, '')) || 0;
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
      const amountStr = typeof t.Amount === 'string' ? t.Amount : '';
      const amount = parseFloat(amountStr.replace(/,/g, '')) || 0;
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
    expect(data[0]).toHaveProperty('Category'); // Category should always be included
    expect(data[0]).toHaveProperty('International'); // International should always be included
    expect(data[0]).toHaveProperty('Is Beloved'); // Is Beloved should always be included
    expect(data[0]).not.toHaveProperty('Transaction ID');
    expect(data[0]).not.toHaveProperty('Sent Date');
  });

  it('should filter by category', () => {
    const result = handleListTransactions(mockTransactions, {
      category: 'Evangelism',
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.length).toBeGreaterThan(0);
    // All results should have Category = 'Evangelism'
    data.forEach((t: Transaction & { Category?: string }) => {
      expect(t.Category).toBe('Evangelism');
    });
  });

  it('should filter by category (Matthew 25)', () => {
    const result = handleListTransactions(mockTransactions, {
      category: 'Matthew 25',
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.length).toBeGreaterThan(0);
    data.forEach((t: Transaction & { Category?: string }) => {
      expect(t.Category).toBe('Matthew 25');
    });
  });

  it('should combine category filter with other filters', () => {
    const result = handleListTransactions(mockTransactions, {
      category: 'Evangelism',
      year: 2024,
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.length).toBeGreaterThan(0);
    data.forEach((t: Transaction & { Category?: string }) => {
      expect(t.Category).toBe('Evangelism');
    });
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

  it('should include International and Is Beloved fields for all transactions', () => {
    const result = handleListTransactions(mockTransactions, {});
    const data = JSON.parse(result.content[0].text);
    data.forEach((t: any) => {
      expect(t).toHaveProperty('International');
      expect(t).toHaveProperty('Is Beloved');
      expect(typeof t.International).toBe('boolean');
      expect(typeof t['Is Beloved']).toBe('boolean');
    });
  });

  it('should set International field correctly based on grantee', () => {
    const internationalTransaction: Transaction = {
      'Transaction ID': '4',
      'Charity': 'International Charity',
      'EIN': '99-9999999',
      'Charity Address': '789 International St',
      'Amount': '20,000.00',
      'Sent Date': '12/1/24',
      'Grant Purpose': 'International grant',
    };
    const transactionsWithInternational = [...mockTransactions, internationalTransaction];
    const result = handleListTransactions(transactionsWithInternational, {});
    const data = JSON.parse(result.content[0].text);
    const intlTransaction = data.find((t: any) => t.Charity === 'International Charity');
    expect(intlTransaction).toBeDefined();
    expect(intlTransaction.International).toBe(true);
    // Other transactions should be false
    const otherTransaction = data.find((t: any) => t.Charity === 'Test Charity');
    expect(otherTransaction.International).toBe(false);
  });

  it('should filter by is_beloved true', () => {
    const belovedTransaction: Transaction = {
      'Transaction ID': '5',
      'Charity': 'Beloved Charity',
      'EIN': '11-1111111',
      'Charity Address': '111 Beloved St',
      'Amount': '25,000.00',
      'Sent Date': '12/1/24',
      'Grant Purpose': 'Beloved grant',
    };
    const transactionsWithBeloved = [...mockTransactions, belovedTransaction];
    const result = handleListTransactions(transactionsWithBeloved, {
      is_beloved: true,
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.length).toBeGreaterThan(0);
    data.forEach((t: any) => {
      expect(t['Is Beloved']).toBe(true);
    });
  });

  it('should filter by is_beloved false', () => {
    const belovedTransaction: Transaction = {
      'Transaction ID': '5',
      'Charity': 'Beloved Charity',
      'EIN': '11-1111111',
      'Charity Address': '111 Beloved St',
      'Amount': '25,000.00',
      'Sent Date': '12/1/24',
      'Grant Purpose': 'Beloved grant',
    };
    const transactionsWithBeloved = [...mockTransactions, belovedTransaction];
    const result = handleListTransactions(transactionsWithBeloved, {
      is_beloved: false,
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.length).toBeGreaterThan(0);
    data.forEach((t: any) => {
      expect(t['Is Beloved']).toBe(false);
    });
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
    expect(data[0]).toHaveProperty('international');
    expect(data[0]).toHaveProperty('is_beloved');
    expect(data[0]).toHaveProperty('most_recent_grant_note');
    expect(data[0]).toHaveProperty('total_amount');
    expect(data[0]).toHaveProperty('transaction_count');
    expect(typeof data[0].international).toBe('boolean');
    expect(typeof data[0].is_beloved).toBe('boolean');
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

  it('should include international and is_beloved fields for all grantees', () => {
    const result = handleListGrantees(mockTransactions, {});
    const data = JSON.parse(result.content[0].text);
    data.forEach((g: any) => {
      expect(g).toHaveProperty('international');
      expect(g).toHaveProperty('is_beloved');
      expect(typeof g.international).toBe('boolean');
      expect(typeof g.is_beloved).toBe('boolean');
    });
  });

  it('should filter by is_beloved true', () => {
    const belovedTransaction: Transaction = {
      'Transaction ID': '5',
      'Charity': 'Beloved Charity',
      'EIN': '11-1111111',
      'Charity Address': '111 Beloved St',
      'Amount': '25,000.00',
      'Sent Date': '12/1/24',
      'Grant Purpose': 'Beloved grant',
    };
    const transactionsWithBeloved = [...mockTransactions, belovedTransaction];
    const result = handleListGrantees(transactionsWithBeloved, {
      is_beloved: true,
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.length).toBeGreaterThan(0);
    data.forEach((g: any) => {
      expect(g.is_beloved).toBe(true);
    });
  });

  it('should filter by is_beloved false', () => {
    const belovedTransaction: Transaction = {
      'Transaction ID': '5',
      'Charity': 'Beloved Charity',
      'EIN': '11-1111111',
      'Charity Address': '111 Beloved St',
      'Amount': '25,000.00',
      'Sent Date': '12/1/24',
      'Grant Purpose': 'Beloved grant',
    };
    const transactionsWithBeloved = [...mockTransactions, belovedTransaction];
    const result = handleListGrantees(transactionsWithBeloved, {
      is_beloved: false,
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.length).toBeGreaterThan(0);
    data.forEach((g: any) => {
      expect(g.is_beloved).toBe(false);
    });
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
    expect(data.metadata.category).toBe('Evangelism');
    expect(data.metadata.notes).toBe('Test notes for Test Charity');
    expect(data.transactions).toHaveLength(2);
  });

  it('should calculate total_amount correctly (only cleared transactions)', () => {
    const result = handleShowGrantee(mockTransactions, {
      charity: 'Test Charity',
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.metadata.total_amount).toBe(20000); // 5000 + 15000 (both cleared)
    expect(data.metadata.total_grants).toBe(2);
    expect(data.metadata.cleared_grants).toBe(2);
    expect(data.metadata.non_cleared_grants).toBe(0);
  });

  it('should exclude non-cleared transactions from totals', () => {
    const transactionsWithPending: Transaction[] = [
      ...mockTransactions,
      {
        'Transaction ID': '4',
        'Charity': 'Test Charity',
        'EIN': '12-3456789',
        'Charity Address': '123 Main St',
        'Amount': '25,000.00',
        'Sent Date': '12/1/24',
        'Grant Purpose': 'Pending grant',
        'Grant Status': 'Pending',
      },
    ];
    const result = handleShowGrantee(transactionsWithPending, {
      charity: 'Test Charity',
    });
    const data = JSON.parse(result.content[0].text);
    // Total amount should only include cleared (20000), not pending (25000)
    expect(data.metadata.total_amount).toBe(20000);
    expect(data.metadata.total_grants).toBe(3);
    expect(data.metadata.cleared_grants).toBe(2);
    expect(data.metadata.non_cleared_grants).toBe(1);
    // Should have status breakdown
    expect(data.status_breakdown).toBeDefined();
    expect(Array.isArray(data.status_breakdown)).toBe(true);
    const pendingStatus = data.status_breakdown.find((s: any) => s.status === 'Pending');
    expect(pendingStatus).toBeDefined();
    expect(pendingStatus.count).toBe(1);
    expect(pendingStatus.total_amount).toBe(25000);
    const clearedStatus = data.status_breakdown.find((s: any) => s.status === 'Payment Cleared');
    expect(clearedStatus).toBeDefined();
    expect(clearedStatus.count).toBe(2);
    expect(clearedStatus.total_amount).toBe(20000);
  });

  it('should calculate yearly totals (only cleared transactions)', () => {
    const transactionsWithPending: Transaction[] = [
      ...mockTransactions,
      {
        'Transaction ID': '4',
        'Charity': 'Test Charity',
        'EIN': '12-3456789',
        'Charity Address': '123 Main St',
        'Amount': '25,000.00',
        'Sent Date': '12/1/24',
        'Grant Purpose': 'Pending grant',
        'Grant Status': 'Pending',
      },
    ];
    const result = handleShowGrantee(transactionsWithPending, {
      charity: 'Test Charity',
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.yearly_totals).toBeDefined();
    expect(Array.isArray(data.yearly_totals)).toBe(true);
    expect(data.yearly_totals.length).toBeGreaterThan(0);
    
    const yearlyTotal2024 = data.yearly_totals.find((yt: any) => yt.year === 2024);
    expect(yearlyTotal2024).toBeDefined();
    // Should only include cleared transaction (5000), not pending (25000)
    expect(yearlyTotal2024.count).toBe(1);
    expect(yearlyTotal2024.total_amount).toBe(5000);
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
    expect(data.metadata).toHaveProperty('category');
    expect(data.metadata).toHaveProperty('notes');
    expect(data.metadata).toHaveProperty('international');
    expect(data.metadata).toHaveProperty('is_beloved');
    expect(data.metadata).toHaveProperty('cleared_grants');
    expect(data.metadata).toHaveProperty('non_cleared_grants');
    expect(data).toHaveProperty('status_breakdown');
    expect(typeof data.metadata.international).toBe('boolean');
    expect(typeof data.metadata.is_beloved).toBe('boolean');
  });

  it('should handle empty transactions array', () => {
    const result = handleShowGrantee([], {
      charity: 'Test Charity',
    });
    expect(result.isError).toBe(true);
  });

  it('should handle transactions with no Grant Status field', () => {
    const transactionsNoStatus: Transaction[] = [
      {
        'Transaction ID': '5',
        'Charity': 'Test Charity',
        'EIN': '12-3456789',
        'Charity Address': '123 Main St',
        'Amount': '10,000.00',
        'Sent Date': '1/1/24',
        'Grant Purpose': 'No status grant',
      },
    ];
    const result = handleShowGrantee(transactionsNoStatus, {
      charity: 'Test Charity',
    });
    const data = JSON.parse(result.content[0].text);
    // Transaction with no status should be treated as non-cleared
    expect(data.metadata.total_amount).toBe(0);
    expect(data.metadata.cleared_grants).toBe(0);
    expect(data.metadata.non_cleared_grants).toBe(1);
    // Should appear in status breakdown as "(no status)"
    const noStatusEntry = data.status_breakdown.find((s: any) => s.status === '(no status)');
    expect(noStatusEntry).toBeDefined();
    expect(noStatusEntry.count).toBe(1);
    expect(noStatusEntry.total_amount).toBe(10000);
  });

  it('should handle multiple status types correctly', () => {
    const transactionsMultipleStatuses: Transaction[] = [
      {
        'Transaction ID': '6',
        'Charity': 'Test Charity',
        'EIN': '12-3456789',
        'Charity Address': '123 Main St',
        'Amount': '5,000.00',
        'Sent Date': '1/1/24',
        'Grant Purpose': 'Cleared grant',
        'Grant Status': 'Payment Cleared',
      },
      {
        'Transaction ID': '7',
        'Charity': 'Test Charity',
        'EIN': '12-3456789',
        'Charity Address': '123 Main St',
        'Amount': '10,000.00',
        'Sent Date': '2/1/24',
        'Grant Purpose': 'Pending grant',
        'Grant Status': 'Pending',
      },
      {
        'Transaction ID': '8',
        'Charity': 'Test Charity',
        'EIN': '12-3456789',
        'Charity Address': '123 Main St',
        'Amount': '15,000.00',
        'Sent Date': '3/1/24',
        'Grant Purpose': 'Cancelled grant',
        'Grant Status': 'Cancelled',
      },
    ];
    const result = handleShowGrantee(transactionsMultipleStatuses, {
      charity: 'Test Charity',
    });
    const data = JSON.parse(result.content[0].text);
    // Only cleared should be in total
    expect(data.metadata.total_amount).toBe(5000);
    expect(data.metadata.cleared_grants).toBe(1);
    expect(data.metadata.non_cleared_grants).toBe(2);
    // Status breakdown should have all three statuses
    expect(data.status_breakdown).toHaveLength(3);
    const cleared = data.status_breakdown.find((s: any) => s.status === 'Payment Cleared');
    const pending = data.status_breakdown.find((s: any) => s.status === 'Pending');
    const cancelled = data.status_breakdown.find((s: any) => s.status === 'Cancelled');
    expect(cleared).toBeDefined();
    expect(cleared.count).toBe(1);
    expect(cleared.total_amount).toBe(5000);
    expect(pending).toBeDefined();
    expect(pending.count).toBe(1);
    expect(pending.total_amount).toBe(10000);
    expect(cancelled).toBeDefined();
    expect(cancelled.count).toBe(1);
    expect(cancelled.total_amount).toBe(15000);
  });

  it('should include all transactions in transactions array regardless of status', () => {
    const transactionsMixed: Transaction[] = [
      {
        'Transaction ID': '9',
        'Charity': 'Test Charity',
        'EIN': '12-3456789',
        'Charity Address': '123 Main St',
        'Amount': '5,000.00',
        'Sent Date': '1/1/24',
        'Grant Purpose': 'Cleared',
        'Grant Status': 'Payment Cleared',
      },
      {
        'Transaction ID': '10',
        'Charity': 'Test Charity',
        'EIN': '12-3456789',
        'Charity Address': '123 Main St',
        'Amount': '10,000.00',
        'Sent Date': '2/1/24',
        'Grant Purpose': 'Pending',
        'Grant Status': 'Pending',
      },
    ];
    const result = handleShowGrantee(transactionsMixed, {
      charity: 'Test Charity',
    });
    const data = JSON.parse(result.content[0].text);
    // All transactions should be in the array
    expect(data.transactions).toHaveLength(2);
    // But totals should only include cleared
    expect(data.metadata.total_amount).toBe(5000);
  });

  it('should calculate yearly totals correctly with mixed statuses', () => {
    const transactionsMixedYear: Transaction[] = [
      {
        'Transaction ID': '11',
        'Charity': 'Test Charity',
        'EIN': '12-3456789',
        'Charity Address': '123 Main St',
        'Amount': '5,000.00',
        'Sent Date': '1/15/24',
        'Grant Purpose': 'Cleared 2024',
        'Grant Status': 'Payment Cleared',
      },
      {
        'Transaction ID': '12',
        'Charity': 'Test Charity',
        'EIN': '12-3456789',
        'Charity Address': '123 Main St',
        'Amount': '10,000.00',
        'Sent Date': '2/15/24',
        'Grant Purpose': 'Pending 2024',
        'Grant Status': 'Pending',
      },
      {
        'Transaction ID': '13',
        'Charity': 'Test Charity',
        'EIN': '12-3456789',
        'Charity Address': '123 Main St',
        'Amount': '15,000.00',
        'Sent Date': '1/15/23',
        'Grant Purpose': 'Cleared 2023',
        'Grant Status': 'Payment Cleared',
      },
    ];
    const result = handleShowGrantee(transactionsMixedYear, {
      charity: 'Test Charity',
    });
    const data = JSON.parse(result.content[0].text);
    // 2024 yearly total should only include cleared (5000), not pending (10000)
    const yearly2024 = data.yearly_totals.find((yt: any) => yt.year === 2024);
    expect(yearly2024).toBeDefined();
    expect(yearly2024.count).toBe(1);
    expect(yearly2024.total_amount).toBe(5000);
    // 2023 yearly total should include cleared (15000)
    const yearly2023 = data.yearly_totals.find((yt: any) => yt.year === 2023);
    expect(yearly2023).toBeDefined();
    expect(yearly2023.count).toBe(1);
    expect(yearly2023.total_amount).toBe(15000);
  });
});

