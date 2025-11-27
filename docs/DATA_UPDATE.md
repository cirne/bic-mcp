# Updating Grant Transaction Data

This guide explains how to update the grant transaction data using the CLI script. The update process merges new transaction data from XLSX files with existing data in `grants.csv`, preserving all historical transactions.

## Overview

The data update script (`scripts/update-transactions.ts`) processes Excel files downloaded from the grant management website and merges them with existing transaction data. The script:

1. **Creates a backup** of the current `grants.csv` file before making any changes
2. **Loads existing data** from `grants.csv`
3. **Parses the new XLSX file** and extracts transactions
4. **Merges transactions** by Transaction ID (updates existing, adds new, preserves old)
5. **Writes the merged data** back to `grants.csv`

## File Structure

### Data Files

- **`data/grants.csv`** - Single source of truth for all grant transactions
  - Contains all grant activity (both current and historical)
  - This file is updated during the update process
  - Old transactions are preserved when merging new data
  
- **`data/backups/grants.backup.{ISO-timestamp}.csv`** - Backup files created before each update
  - Format: `grants.backup.2025-11-27T16-53-24-927Z.csv`
  - Created automatically before processing in `data/backups/` directory
  - Can be used to restore previous state if needed
  - Directory is created automatically if it doesn't exist

### Source Files

- **XLSX files** - Downloaded from the grant management website
  - Typically named: `Grant Activity MM_DD_YYYY to MM_DD_YYYY.xlsx`
  - Example: `Grant Activity 08_29_2025 to 11_27_2025.xlsx`
  - Usually downloaded to `~/Downloads` directory
  - May contain only recent transactions (e.g., last 90 days)

## Usage

### Basic Usage

```bash
# Auto-detect and process XLSX file from ~/Downloads
npm run data-update
```

The script will:
- Look for files matching `Grant Activity *.xlsx` in `~/Downloads`
- If exactly one file is found, use it automatically
- If multiple files are found, prompt you to select one
- Process the file and update `grants.csv`

### Command-Line Options

```bash
# Show help
npm run data-update -- --help

# Use latest file if multiple found (skip prompt)
npm run data-update -- --latest

# Delete XLSX file after successful processing
npm run data-update -- --delete

# Use explicit file path
npm run data-update -- path/to/file.xlsx

# Combine options
npm run data-update -- --latest --delete
```

### Options Explained

- **`--latest`** - When multiple XLSX files are found in `~/Downloads`, automatically use the most recently modified file instead of prompting for selection
- **`--delete`** - Delete the XLSX file after successful processing (useful for cleanup)
- **`--help` or `-h`** - Display usage instructions
- **`filename`** - Optional explicit path to XLSX file (overrides auto-detection)

## How It Works

### 1. File Detection

The script searches `~/Downloads` for files matching the pattern `Grant Activity *.xlsx`. If you provide an explicit filename, it uses that instead.

**Behavior:**
- **0 files found**: Error message, script exits
- **1 file found**: Uses it automatically
- **Multiple files found**: 
  - With `--latest`: Uses most recently modified file
  - Without `--latest`: Prompts you to select one interactively

### 2. Backup Creation

Before processing, the script creates a timestamped backup of `grants.csv` in the `data/backups/` directory:

```
data/backups/grants.backup.2025-11-27T16-53-24-927Z.csv
```

**Format:** ISO 8601 timestamp with colons replaced by hyphens for filesystem compatibility.

**Purpose:** Allows you to restore the previous state if something goes wrong.

**Directory:** The `data/backups/` directory is created automatically if it doesn't exist.

### 3. Data Loading

The script loads transactions from `grants.csv`:

- All existing transactions are loaded
- These will be merged with new transactions from the XLSX file
- Old transactions not in the XLSX file are preserved

### 4. XLSX Parsing

The script parses the XLSX file:

- Finds the sheet containing "Transaction ID" header (checks first 10 rows)
- Extracts all transactions from that sheet
- **Formats dates**: Converts Excel date serial numbers to `M/D/YY` format (e.g., `45932` → `10/2/25`)
- **Formats amounts**: Adds commas and trailing space (e.g., `1000` → `1,000.00 `)
- Handles quoted fields, empty cells, and missing values

### 5. Merging Logic

Transactions are merged by **Transaction ID**:

- **If Transaction ID exists in existing data**: Updates that record with new data from XLSX
- **If Transaction ID is new**: Adds it as a new transaction
- **If Transaction ID not in XLSX**: Preserves the existing transaction (important for partial XLSX files)

**Key Point:** The script preserves all existing transactions that aren't in the new XLSX file. This means if you download a 90-day XLSX file, older transactions (>90 days) in `grants.csv` are preserved. The backup system provides additional safety.

### 6. Writing Results

The merged transactions are written back to `grants.csv`:

- Maintains CSV format with header rows (`Table 1`, `Grant Activity`, `Beloved In Christ`)
- Ensures "Transaction ID" is the first column
- Preserves field formatting (quoted fields, trailing spaces in amounts)
- **Never writes to `grants.historical.csv`** - that file remains unchanged

## Side Effects

### Files Created

- **Backup file**: `data/backups/grants.backup.{timestamp}.csv`
  - Created before each update in `data/backups/` directory
  - Accumulates over time (not automatically cleaned up)
  - Can be manually deleted if disk space is a concern
  - Directory is created automatically if it doesn't exist

### Files Modified

- **`data/grants.csv`**: Updated with merged transaction data
  - Previous version is backed up first
  - Format and structure preserved
  - All transactions (old and new) are preserved

### Files Never Modified

- **XLSX source files**: Only deleted if `--delete` flag is used

### Data Changes

- **New transactions**: Added from XLSX file
- **Updated transactions**: Existing transactions with matching Transaction IDs are updated with data from XLSX
- **Preserved transactions**: All existing transactions not in XLSX remain unchanged

## Important Considerations

### Partial XLSX Files

When downloading XLSX files from the website, you may specify a date range (e.g., "last 90 days"). This means:

- ✅ **Older transactions are preserved** - Transactions older than the date range remain in `grants.csv`
- ✅ **Recent transactions are updated** - Transactions within the date range are updated/added from XLSX
- ✅ **Backup provides safety** - Automatic backups before each update allow you to restore if needed

### Transaction ID Matching

The merge process uses Transaction ID as the unique identifier:

- Same Transaction ID = Update existing record
- New Transaction ID = Add new record
- Missing Transaction ID in XLSX = Preserve existing record

### Date Formatting

Excel stores dates as serial numbers (e.g., `45932`). The script automatically converts these to `M/D/YY` format (e.g., `10/2/25`) to match the CSV format.

### Amount Formatting

Amounts are formatted with:
- Commas for thousands (e.g., `1,000.00`)
- Two decimal places
- Trailing space (e.g., `1,000.00 `)

## Best Practices

### 1. Verify Before Processing

Check the XLSX file before running the update:

```bash
# List available files
ls -lh ~/Downloads/Grant\ Activity*.xlsx

# Check file modification date
stat ~/Downloads/Grant\ Activity*.xlsx
```

### 2. Use `--latest` for Automation

If you frequently download files with the same naming pattern, use `--latest` to avoid prompts:

```bash
npm run data-update -- --latest
```

### 3. Clean Up After Processing

Use `--delete` to remove processed XLSX files:

```bash
npm run data-update -- --latest --delete
```

### 4. Verify Results

After updating, verify the data using MCP tools:

```bash
# Check transaction count
# Use MCP tools to query recent transactions
# Verify dates are formatted correctly
```

### 5. Keep Backups

Backup files are created automatically. Consider:
- Keeping recent backups (last few updates)
- Archiving older backups if disk space is limited
- Using backups to restore if needed

## Troubleshooting

### Error: "No XLSX files found"

**Cause:** No files matching `Grant Activity *.xlsx` in `~/Downloads`

**Solution:**
- Download the XLSX file from the website
- Or provide explicit path: `npm run data-update -- path/to/file.xlsx`

### Error: "Could not find sheet with Transaction ID header"

**Cause:** XLSX file doesn't contain the expected format

**Solution:**
- Verify the XLSX file is from the correct source
- Check that it contains a "Transaction ID" column
- Try opening the file in Excel to verify structure

### Dates Appear as Numbers

**Cause:** Date formatting failed (shouldn't happen with current code)

**Solution:**
- Check that the script version includes date formatting fixes
- Verify XLSX file has proper date columns
- Restore from backup if needed

### Missing Older Transactions

**Cause:** XLSX file only contains recent transactions (expected behavior)

**Solution:**
- This is normal - older transactions are preserved in `grants.csv`
- The merge logic ensures all existing transactions remain unless updated
- Check backups if you need to verify historical data

### Backup File Not Created

**Cause:** `grants.csv` doesn't exist (first run)

**Solution:**
- This is expected if `grants.csv` doesn't exist yet
- The script will create `grants.csv` with data from XLSX
- Future runs will create backups

## Restoring from Backup

If you need to restore a previous state:

```bash
# List available backups
ls -lh data/backups/grants.backup.*.csv

# Restore a specific backup
cp data/backups/grants.backup.2025-11-27T16-53-24-927Z.csv data/grants.csv

# Verify the restore
npm run test:run  # Run tests to verify data integrity
```

## Testing

The update script has comprehensive test coverage:

```bash
# Run tests for update script
npm run test:run -- scripts/update-transactions.test.ts

# Run all tests
npm run test:run
```

Tests verify:
- Date formatting (Excel serial → M/D/YY)
- Amount formatting (numbers → comma-separated with trailing space)
- XLSX parsing (header detection, transaction extraction)
- Edge cases (empty files, missing headers, etc.)

## Related Documentation

- **`DEPLOY.md`** - Deployment guide
- **`TESTING.md`** - Testing guidelines
- **`PRE_COMMIT_CHECKLIST.md`** - Pre-commit checklist

## Summary

The data update process is designed to be safe and non-destructive:

- ✅ **Automatic backups** before any changes
- ✅ **Single source of truth** (`grants.csv` contains all transactions)
- ✅ **Merges intelligently** (updates existing, adds new, preserves old)
- ✅ **Handles partial data** (90-day XLSX files work correctly)
- ✅ **Formats correctly** (dates and amounts match CSV format)

Run `npm run data-update -- --help` for quick reference on command-line options.

## Consolidating Historical Data

If you have both `grants.csv` and `grants.historical.csv` files, you can consolidate them into a single `grants.csv`:

```bash
npm run consolidate-grants
```

This will:
- Merge both files by Transaction ID
- Create backups of both files before consolidating
- Write all transactions to `grants.csv`
- Preserve all unique transactions

After consolidation, you can delete `grants.historical.csv` if desired. The update script will work with the single `grants.csv` file.

