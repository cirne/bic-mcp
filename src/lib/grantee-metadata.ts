import { readFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface GranteeMetadata {
  name: string;
  ein: string;
  category: string;
  notes: string | null;
  international?: boolean;
}

let granteeMetadataCache: Record<string, GranteeMetadata> | null = null;

// Find grantees.json file by searching from current directory up to project root
function findGranteesJson(): string | null {
  // Try multiple possible locations
  const possiblePaths = [
    // Relative to this file (src/lib/ -> project root) - most common case
    join(__dirname, '..', '..', 'grantees.json'),
    // Relative to process.cwd() (current working directory)
    join(process.cwd(), 'grantees.json'),
  ];

  for (const path of possiblePaths) {
    const resolvedPath = resolve(path);
    if (existsSync(resolvedPath)) {
      return resolvedPath;
    }
  }

  // Last resort: try to find it by walking up from __dirname
  let currentDir = __dirname;
  for (let i = 0; i < 5; i++) {
    const testPath = join(currentDir, 'grantees.json');
    if (existsSync(testPath)) {
      return testPath;
    }
    const parentDir = join(currentDir, '..');
    if (parentDir === currentDir) break; // Reached filesystem root
    currentDir = parentDir;
  }

  return null;
}

// Helper to log to stderr (MCP servers must keep stdout clean for JSON-RPC)
function logDebug(...args: any[]) {
  console.error('[grantee-metadata]', ...args);
}

// Load grantee metadata from grantees.json
export function loadGranteeMetadata(): Record<string, GranteeMetadata> {
  if (granteeMetadataCache) {
    return granteeMetadataCache;
  }

  try {
    const filePath = findGranteesJson();
    if (!filePath) {
      logDebug('Could not find grantees.json file');
      logDebug('Searched paths:', [
        join(__dirname, '..', '..', 'grantees.json'),
        join(process.cwd(), 'grantees.json'),
        join(__dirname, '..', '..', '..', 'grantees.json'),
      ]);
      return {};
    }

    const content = readFileSync(filePath, 'utf-8');
    granteeMetadataCache = JSON.parse(content);
    const entryCount = granteeMetadataCache ? Object.keys(granteeMetadataCache).length : 0;
    logDebug(`Loaded ${entryCount} grantee entries from ${filePath}`);
    
    return granteeMetadataCache!;
  } catch (error) {
    logDebug('Error loading grantee metadata:', error);
    if (error instanceof Error) {
      logDebug('Error message:', error.message);
    }
    return {};
  }
}

// Decode HTML entities (e.g., &amp; -> &)
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

// Get grantee metadata by composite key (charity|ein)
export function getGranteeMetadata(
  charityName: string,
  ein: string
): GranteeMetadata | null {
  const metadata = loadGranteeMetadata();
  if (Object.keys(metadata).length === 0) {
    return null;
  }
  
  // Normalize inputs: trim, decode HTML entities, and handle empty EIN
  const normalizedCharity = decodeHtmlEntities((charityName || '').trim());
  const normalizedEin = (ein || '').trim() || '(no EIN)';
  const key = `${normalizedCharity}|${normalizedEin}`;
  
  return metadata[key] || null;
}

// Get category for a grantee
export function getGranteeCategory(charityName: string, ein: string): string | null {
  const meta = getGranteeMetadata(charityName, ein);
  return meta?.category || null;
}

// Get notes for a grantee
export function getGranteeNotes(charityName: string, ein: string): string | null {
  const meta = getGranteeMetadata(charityName, ein);
  return meta?.notes || null;
}

// Get international status for a grantee
export function getGranteeInternational(charityName: string, ein: string): boolean {
  const meta = getGranteeMetadata(charityName, ein);
  return meta?.international || false;
}

