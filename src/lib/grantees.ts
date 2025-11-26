import { Transaction, extractYear, matchesYear } from './filters';

export interface Grantee {
  name: string;
  ein: string;
  address: string;
  transactions: Transaction[];
}

// Helper function to get all unique grantees
export function getAllGrantees(transactions: Transaction[]): Grantee[] {
  const granteeMap = new Map<string, Grantee>();
  
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
    
    granteeMap.get(key)!.transactions.push(transaction);
  });
  
  return Array.from(granteeMap.values());
}

// Helper function to get most recent grant note for a grantee
export function getMostRecentGrantNote(granteeTransactions: Transaction[]): string | null {
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
export function findGrantee(transactions: Transaction[], charityName: string, ein?: string): Grantee | null {
  const allGrantees = getAllGrantees(transactions);
  
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

