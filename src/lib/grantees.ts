import { Transaction, extractYear, matchesYear, getStringValue } from './filters';
import { getGranteeInternational, getGranteeIsBeloved } from './grantee-metadata';

export interface Grantee {
  name: string;
  ein: string;
  address: string;
  international: boolean;
  is_beloved: boolean;
  transactions: Transaction[];
}

// Determine if a grantee is international based on name, address, and transaction data
function isInternationalGrantee(
  charityName: string,
  ein: string,
  address: string,
  transactions: Transaction[]
): boolean {
  const nameLower = charityName.toLowerCase();
  const addressLower = address.toLowerCase();
  
  // Hardcoded list of known international organizations
  const internationalOrgs = [
    'young life', // Most grantmaking is for outside-of-US programs
    'zinduka arise afrika mission',
    'volunteers for ukraine',
    'm3 romania',
    'united in crisis',
    'africa new life ministries international',
    'cure international',
    'he touched me ministries', // Works in Zambia
    'friends of independent schools and better education (frisbe)', // Conduit for Canada
    'trinity college school fund', // School in Canada
    'latin american fellowship',
  ];
  
  // Check if organization name matches known international orgs
  for (const org of internationalOrgs) {
    if (nameLower.includes(org)) {
      return true;
    }
  }
  
  // Check address for non-US locations (Canada, Mexico, etc.)
  const nonUSKeywords = [
    'canada', 'ontario', 'toronto', 'vancouver', 'montreal',
    'mexico', 'baja california', 'los cabos',
    'uk', 'united kingdom', 'england', 'london',
  ];
  
  for (const keyword of nonUSKeywords) {
    if (addressLower.includes(keyword)) {
      return true;
    }
  }
  
  // Check grant purposes and notes for international indicators
  const internationalKeywords = [
    'international', 'africa', 'kenya', 'nairobi', 'rwanda', 'nigeria', 'south africa',
    'ukraine', 'romania', 'eastern europe', 'balkans',
    'latin america', 'caribbean', 'haiti', 'dominican republic', 'mexico',
    'zambia', 'canada', 'los cabos', 'baja california',
    'europe', 'asia', 'middle east',
  ];
  
  for (const transaction of transactions) {
    const grantPurpose = getStringValue(transaction['Grant Purpose']).toLowerCase();
    const specialNote = getStringValue(transaction['Special Note']).toLowerCase();
    const combined = `${grantPurpose} ${specialNote}`;
    
    for (const keyword of internationalKeywords) {
      if (combined.includes(keyword)) {
        return true;
      }
    }
  }
  
  return false;
}

// Helper function to get all unique grantees
export function getAllGrantees(transactions: Transaction[]): Grantee[] {
  const granteeMap = new Map<string, { grantee: Grantee; transactionRefs: Transaction[] }>();
  
  // First pass: collect all transactions per grantee
  transactions.forEach(transaction => {
    const charity = getStringValue(transaction.Charity).trim();
    const ein = getStringValue(transaction.EIN).trim();
    
    if (!charity) return; // Skip transactions without charity name
    
    // Use charity name + EIN as unique key (EIN might be empty for some)
    const key = `${charity}|${ein}`;
    
    if (!granteeMap.has(key)) {
      granteeMap.set(key, {
        grantee: {
          name: charity,
          ein: ein,
          address: getStringValue(transaction['Charity Address']).trim(),
          international: false, // Will be set in second pass
          is_beloved: false, // Will be set in second pass
          transactions: []
        },
        transactionRefs: []
      });
    }
    
    granteeMap.get(key)!.transactionRefs.push(transaction);
  });
  
  // Second pass: determine international and is_beloved status and assign transactions
  const grantees: Grantee[] = [];
  granteeMap.forEach(({ grantee, transactionRefs }) => {
    // First try to get from metadata (grantees.json), fallback to analysis function
    const metadataInternational = getGranteeInternational(grantee.name, grantee.ein);
    if (metadataInternational !== false) {
      // If metadata has a value (true), use it; otherwise fall back to analysis
      grantee.international = metadataInternational;
    } else {
      // Fallback to analysis function if not in metadata
      grantee.international = isInternationalGrantee(
        grantee.name,
        grantee.ein,
        grantee.address,
        transactionRefs
      );
    }
    // Get is_beloved from metadata (always from metadata, no fallback)
    grantee.is_beloved = getGranteeIsBeloved(grantee.name, grantee.ein);
    grantee.transactions = transactionRefs;
    grantees.push(grantee);
  });
  
  return grantees;
}

// Helper function to get most recent grant note for a grantee
export function getMostRecentGrantNote(granteeTransactions: Transaction[]): string | null {
  if (!granteeTransactions || granteeTransactions.length === 0) return null;
  
  // Sort by Sent Date (most recent first)
  const sorted = [...granteeTransactions].sort((a, b) => {
    const dateAStr = getStringValue(a['Sent Date']);
    const dateBStr = getStringValue(b['Sent Date']);
    const dateA = extractYear(dateAStr) || 0;
    const dateB = extractYear(dateBStr) || 0;
    if (dateB !== dateA) return dateB - dateA;
    // If same year, compare dates as strings
    return dateBStr.localeCompare(dateAStr);
  });
  
  const mostRecent = sorted[0];
  const grantPurpose = getStringValue(mostRecent['Grant Purpose']);
  const specialNote = getStringValue(mostRecent['Special Note']);
  return grantPurpose || specialNote || null;
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

