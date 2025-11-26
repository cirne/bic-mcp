# BIC MCP Server

An MCP (Model Context Protocol) server for querying and analyzing grant transaction data from the Beloved In Christ Foundation. This server provides tools for searching, filtering, and analyzing grant transactions loaded from CSV files.

## Features

- **Transaction Search**: Fuzzy search across all transaction fields
- **Advanced Filtering**: Filter by charity, year, date ranges, and amount ranges
- **Sorting & Grouping**: Sort by any field and group results by year or other fields
- **Grantee Management**: List all grantees with aggregated totals and transaction counts
- **Detailed Grantee Views**: View complete grant history for specific charities with yearly totals

## Installation

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Setup

1. Clone the repository:
```bash
git clone https://github.com/cirne/bic-mcp.git
cd bic-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Add your CSV data files to the `data/` directory. The server will automatically load all `.csv` files from this directory.

## Usage

### Running the Server

The MCP server runs via stdio and is designed to be used with MCP-compatible clients (like Cursor):

```bash
npm start
```

### Available Tools

#### 1. `list_transactions`
Search and filter grant transactions with advanced options.

**Parameters:**
- `search_term` (string, optional) - Fuzzy search across all fields
- `charity` (string, optional) - Exact charity name match (case-insensitive)
- `year` (number, optional) - Filter by exact year
- `min_year` (number, optional) - Filter from this year onwards
- `max_year` (number, optional) - Filter up to this year
- `min_amount` (number, optional) - Minimum grant amount
- `max_amount` (number, optional) - Maximum grant amount
- `sort_by` (string, optional) - Field to sort by (e.g., "Sent Date", "Amount")
- `sort_order` (string, optional) - "asc" or "desc"
- `group_by` (string, optional) - Group results by field (e.g., "year")
- `fields` (array, optional) - Select specific fields to return

#### 2. `list_grantees`
List all unique grantees (charities) with aggregated summary data.

**Parameters:**
- `year` (number, optional) - Filter to grantees that received grants in this year
- `sort_by` (string, optional) - Sort by "name", "ein", "recent_date", or "total_amount"
- `sort_order` (string, optional) - "asc" or "desc"

**Returns:**
- Name, EIN, most recent grant note, transaction count, and total amount for each grantee

#### 3. `show_grantee`
Show detailed information about a specific grantee.

**Parameters:**
- `charity` (string, required) - Exact charity name
- `ein` (string, optional) - EIN to help identify the grantee if name is ambiguous

**Returns:**
- Grantee metadata (name, EIN, address)
- Yearly totals (count and total amount per year)
- All transaction history sorted by date

## Data Format

### Transaction Fields

Transactions are loaded from CSV files in the `data/` directory. Key fields include:

- `Transaction ID` - Unique transaction identifier
- `Charity` - Name of the grantee organization
- `Charity Address` - Address of the grantee
- `Grant Status` - Status of the grant (e.g., "Payment Cleared")
- `Amount` - Grant amount (formatted as "500,000.00 " with commas and trailing spaces)
- `Sent Date` - Date grant was sent (format: M/D/YY, e.g., "10/2/25")
- `Requested Payment Date` - Requested payment date
- `Recommendation Submitted Date` - Date recommendation was submitted
- `Cleared Date` - Date payment cleared
- `Grant Purpose` - Purpose/description of the grant
- `Special Note` - Additional notes about the grant
- `EIN` - Employer Identification Number
- `Grant Type` - Type of grant (e.g., "Single")
- `Recommended By` - Who recommended the grant

### Date Format

- Dates are stored as strings in format M/D/YY (e.g., "10/2/25" = October 2, 2025)
- Years 00-30 are interpreted as 2000-2030
- Years 31-99 are interpreted as 1931-1999

### Amount Format

- Amounts are stored as strings with commas and trailing spaces (e.g., "500,000.00 ")
- The server automatically parses these for filtering and calculations

## Testing

Run the test suite:

```bash
npm test
```

Run the MCP client test:

```bash
npm run test:client
```

Run filter tests:

```bash
npm run test:filter
```

## Configuration

The server automatically loads all CSV files from the `data/` directory on startup. Ensure your CSV files:

1. Have a header row containing "Transaction ID"
2. Use standard CSV format (handles quoted fields with commas)
3. Are saved with `.csv` extension

## Development

### Project Structure

```
bic-mcp/
├── server.js          # Main MCP server implementation
├── data/              # CSV files containing transaction data
├── test-client.js     # MCP client for testing
├── test-filter.js     # Filter functionality tests
├── test.js            # General tests
└── package.json       # Dependencies and scripts
```

### Dependencies

- `@modelcontextprotocol/sdk` - MCP SDK for building the server
- `fuse.js` - Fuzzy search functionality

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

