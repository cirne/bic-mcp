import { describe, it, expect } from 'vitest';
import { getAllGrantees, getMostRecentGrantNote, findGrantee } from './grantees';
import type { Transaction } from './filters';

describe('getAllGrantees', () => {
  it('should return unique grantees grouped by name and EIN', () => {
    const transactions: Transaction[] = [
      {
        'Transaction ID': '1',
        'Charity': 'Test Charity',
        'EIN': '12-3456789',
        'Charity Address': '123 Main St',
        'Amount': '1,000.00 ',
      },
      {
        'Transaction ID': '2',
        'Charity': 'Test Charity',
        'EIN': '12-3456789',
        'Charity Address': '123 Main St',
        'Amount': '2,000.00 ',
      },
      {
        'Transaction ID': '3',
        'Charity': 'Another Charity',
        'EIN': '98-7654321',
        'Charity Address': '456 Oak Ave',
        'Amount': '3,000.00 ',
      },
    ];

    const grantees = getAllGrantees(transactions);

    expect(grantees).toHaveLength(2);
    expect(grantees[0].name).toBe('Test Charity');
    expect(grantees[0].ein).toBe('12-3456789');
    expect(grantees[0].transactions).toHaveLength(2);
    expect(grantees[1].name).toBe('Another Charity');
    expect(grantees[1].transactions).toHaveLength(1);
  });

  it('should treat charities with different EINs as separate grantees', () => {
    const transactions: Transaction[] = [
      {
        'Charity': 'Test Charity',
        'EIN': '12-3456789',
        'Amount': '1,000.00 ',
      },
      {
        'Charity': 'Test Charity',
        'EIN': '98-7654321',
        'Amount': '2,000.00 ',
      },
    ];

    const grantees = getAllGrantees(transactions);

    expect(grantees).toHaveLength(2);
    expect(grantees[0].ein).toBe('12-3456789');
    expect(grantees[1].ein).toBe('98-7654321');
  });

  it('should handle charities with empty EIN', () => {
    const transactions: Transaction[] = [
      {
        'Charity': 'Test Charity',
        'EIN': '',
        'Amount': '1,000.00 ',
      },
      {
        'Charity': 'Test Charity',
        'EIN': '',
        'Amount': '2,000.00 ',
      },
    ];

    const grantees = getAllGrantees(transactions);

    expect(grantees).toHaveLength(1);
    expect(grantees[0].ein).toBe('');
    expect(grantees[0].transactions).toHaveLength(2);
  });

  it('should skip transactions without charity name', () => {
    const transactions: Transaction[] = [
      {
        'Charity': 'Test Charity',
        'EIN': '12-3456789',
        'Amount': '1,000.00 ',
      },
      {
        'Charity': '',
        'EIN': '98-7654321',
        'Amount': '2,000.00 ',
      },
      {
        'EIN': '11-1111111',
        'Amount': '3,000.00 ',
      },
    ];

    const grantees = getAllGrantees(transactions);

    expect(grantees).toHaveLength(1);
    expect(grantees[0].name).toBe('Test Charity');
  });

  it('should preserve charity address from first transaction', () => {
    const transactions: Transaction[] = [
      {
        'Charity': 'Test Charity',
        'EIN': '12-3456789',
        'Charity Address': '123 Main St',
        'Amount': '1,000.00 ',
      },
      {
        'Charity': 'Test Charity',
        'EIN': '12-3456789',
        'Charity Address': '456 Different St',
        'Amount': '2,000.00 ',
      },
    ];

    const grantees = getAllGrantees(transactions);

    expect(grantees).toHaveLength(1);
    expect(grantees[0].address).toBe('123 Main St');
  });

  it('should return empty array for empty transactions', () => {
    const grantees = getAllGrantees([]);
    expect(grantees).toHaveLength(0);
  });

  it('should handle whitespace in charity names', () => {
    const transactions: Transaction[] = [
      {
        'Charity': '  Test Charity  ',
        'EIN': '12-3456789',
        'Amount': '1,000.00 ',
      },
      {
        'Charity': 'Test Charity',
        'EIN': '12-3456789',
        'Amount': '2,000.00 ',
      },
    ];

    const grantees = getAllGrantees(transactions);

    // Should be treated as the same grantee (trimmed)
    expect(grantees).toHaveLength(1);
    expect(grantees[0].name).toBe('Test Charity');
  });
});

describe('getMostRecentGrantNote', () => {
  it('should return most recent grant purpose', () => {
    const transactions: Transaction[] = [
      {
        'Sent Date': '1/1/23',
        'Grant Purpose': 'Old grant',
        'Special Note': 'Old note',
      },
      {
        'Sent Date': '12/31/24',
        'Grant Purpose': 'Recent grant',
        'Special Note': 'Recent note',
      },
    ];

    const note = getMostRecentGrantNote(transactions);
    expect(note).toBe('Recent grant');
  });

  it('should return special note when grant purpose is missing', () => {
    const transactions: Transaction[] = [
      {
        'Sent Date': '1/1/23',
        'Special Note': 'Old note',
      },
      {
        'Sent Date': '12/31/24',
        'Special Note': 'Recent note',
      },
    ];

    const note = getMostRecentGrantNote(transactions);
    expect(note).toBe('Recent note');
  });

  it('should return null when no notes available', () => {
    const transactions: Transaction[] = [
      {
        'Sent Date': '1/1/23',
        'Amount': '1,000.00 ',
      },
    ];

    const note = getMostRecentGrantNote(transactions);
    expect(note).toBeNull();
  });

  it('should return null for empty transactions', () => {
    const note = getMostRecentGrantNote([]);
    expect(note).toBeNull();
  });

  it('should prioritize grant purpose over special note', () => {
    const transactions: Transaction[] = [
      {
        'Sent Date': '12/31/24',
        'Grant Purpose': 'Recent purpose',
        'Special Note': 'Recent note',
      },
    ];

    const note = getMostRecentGrantNote(transactions);
    expect(note).toBe('Recent purpose');
  });

  it('should handle transactions with same year but different dates', () => {
    const transactions: Transaction[] = [
      {
        'Sent Date': '1/1/24',
        'Grant Purpose': 'Early grant',
      },
      {
        'Sent Date': '12/31/24',
        'Grant Purpose': 'Late grant',
      },
    ];

    const note = getMostRecentGrantNote(transactions);
    // Should return the one with later date (12/31/24)
    expect(note).toBe('Late grant');
  });
});

describe('findGrantee', () => {
  const transactions: Transaction[] = [
    {
      'Transaction ID': '1',
      'Charity': 'Test Charity',
      'EIN': '12-3456789',
      'Charity Address': '123 Main St',
      'Amount': '1,000.00 ',
    },
    {
      'Transaction ID': '2',
      'Charity': 'Another Charity',
      'EIN': '98-7654321',
      'Charity Address': '456 Oak Ave',
      'Amount': '2,000.00 ',
    },
    {
      'Transaction ID': '3',
      'Charity': 'Test Charity',
      'EIN': '12-3456789',
      'Charity Address': '123 Main St',
      'Amount': '3,000.00 ',
    },
  ];

  it('should find grantee by exact name match', () => {
    const grantee = findGrantee(transactions, 'Test Charity');
    expect(grantee).not.toBeNull();
    expect(grantee?.name).toBe('Test Charity');
    expect(grantee?.ein).toBe('12-3456789');
    expect(grantee?.transactions).toHaveLength(2);
  });

  it('should find grantee by name and EIN', () => {
    const grantee = findGrantee(transactions, 'Test Charity', '12-3456789');
    expect(grantee).not.toBeNull();
    expect(grantee?.name).toBe('Test Charity');
    expect(grantee?.ein).toBe('12-3456789');
  });

  it('should return null for non-existent grantee', () => {
    const grantee = findGrantee(transactions, 'Non-existent Charity');
    expect(grantee).toBeNull();
  });

  it('should be case-insensitive', () => {
    const grantee = findGrantee(transactions, 'test charity');
    expect(grantee).not.toBeNull();
    expect(grantee?.name).toBe('Test Charity');
  });

  it('should prefer exact EIN match when EIN provided', () => {
    const transactionsWithMultiple: Transaction[] = [
      {
        'Charity': 'Test Charity',
        'EIN': '12-3456789',
        'Amount': '1,000.00 ',
      },
      {
        'Charity': 'Test Charity',
        'EIN': '98-7654321',
        'Amount': '2,000.00 ',
      },
    ];

    const grantee = findGrantee(transactionsWithMultiple, 'Test Charity', '12-3456789');
    expect(grantee).not.toBeNull();
    expect(grantee?.ein).toBe('12-3456789');
  });

  it('should use fuzzy match when exact match not found', () => {
    const grantee = findGrantee(transactions, 'Test');
    expect(grantee).not.toBeNull();
    expect(grantee?.name).toBe('Test Charity');
  });

  it('should use fuzzy match for partial name', () => {
    const grantee = findGrantee(transactions, 'Another');
    expect(grantee).not.toBeNull();
    expect(grantee?.name).toBe('Another Charity');
  });

  it('should return null when no match found', () => {
    const grantee = findGrantee(transactions, 'XYZ Non-existent');
    expect(grantee).toBeNull();
  });

  it('should handle empty transactions array', () => {
    const grantee = findGrantee([], 'Test Charity');
    expect(grantee).toBeNull();
  });
});



