# BIC Grants MCP Server

An MCP (Model Context Protocol) server for querying and analyzing grant transaction data from the Beloved In Christ Foundation. This server provides tools for searching, filtering, and analyzing grant transactions loaded from CSV files.

**Now available as both:**
- **Stdio server** for Cursor and other stdio-based MCP clients
- **HTTP/SSE server** deployable to Vercel for ChatGPT Desktop and other HTTP-based clients

## Features

- **Transaction Search**: Fuzzy search across all transaction fields
- **Advanced Filtering**: Filter by charity, year, date ranges, and amount ranges
- **Sorting & Grouping**: Sort by any field and group results by year or other fields
- **Grantee Management**: List all grantees with aggregated totals and transaction counts
- **Detailed Grantee Views**: View complete grant history for specific charities with yearly totals
- **Web UI**: Basic web interface (coming soon with Excel upload capabilities)

## Quick Start

### For Cursor Users (Stdio Server)

1. Install dependencies:
```bash
npm install
```

2. Configure Cursor to use the stdio server:
   - See [CURSOR_SETUP.md](./docs/CURSOR_SETUP.md) for detailed instructions
   - Or use the config in `cursor-mcp-config.json`

3. Run the server:
```bash
npm run start:stdio
```

### For ChatGPT Desktop Users (HTTP Server)

1. **Deploy to Vercel**: See [DEPLOY.md](./docs/DEPLOY.md) for deployment instructions
2. **Configure ChatGPT**: See [CHATGPT_SETUP.md](./docs/CHATGPT_SETUP.md) for setup instructions

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/cirne/bic-mcp.git
cd bic-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Add your CSV data files to the `data/` directory

4. Run the development server:
```bash
npm run dev
```

5. Access the web UI at `http://localhost:3000`
6. Check your MCP endpoint URL at `http://localhost:3000/api/status`
7. Access the MCP API at `http://localhost:3000/{guid}/mcp` (where `{guid}` is your `MCP_GUID` environment variable)

## Project Structure

```
bic-mcp/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/mcp/           # MCP HTTP endpoint
│   │   ├── page.tsx           # Web UI page
│   │   └── layout.tsx         # Root layout
│   ├── lib/                   # Shared business logic
│   │   ├── transactions.ts   # Transaction loading/parsing
│   │   ├── filters.ts         # Filtering/sorting logic
│   │   ├── grantees.ts        # Grantee aggregation
│   │   └── mcp-handlers.ts    # MCP tool handlers
│   └── styles/
│       └── globals.css        # Tailwind styles
├── server/                    # Standalone servers
│   └── server.ts             # Stdio server for Cursor
├── data/                      # CSV files (add your data here)
├── public/                     # Static assets
├── package.json
├── next.config.js            # Next.js configuration
├── tailwind.config.js        # Tailwind configuration
├── tsconfig.json             # TypeScript configuration
├── vercel.json               # Vercel deployment config
└── README.md
```

## Available Tools

### 1. `list_transactions`
Search and filter grant transactions with advanced options.

**Parameters:**
- `search_term` (string, optional) - Fuzzy search across all fields
- `charity` (string, optional) - Exact charity name match (case-insensitive)
- `grant_status` (string, optional) - Filter by grant status (e.g., "Pending", "Payment Cleared", "Cancelled", "Reversed", "Denied"). Case-insensitive match.
- `year` (number, optional) - Filter by exact year
- `min_year` (number, optional) - Filter from this year onwards
- `max_year` (number, optional) - Filter up to this year
- `min_amount` (number, optional) - Minimum grant amount
- `max_amount` (number, optional) - Maximum grant amount
- `sort_by` (string, optional) - Field to sort by (e.g., "Sent Date", "Amount")
- `sort_order` (string, optional) - "asc" or "desc"
- `group_by` (string, optional) - Group results by field (e.g., "year")
- `fields` (array, optional) - Select specific fields to return

### 2. `list_grantees`
List all unique grantees (charities) with aggregated summary data.

**Parameters:**
- `year` (number, optional) - Filter to grantees that received grants in this year
- `sort_by` (string, optional) - Sort by "name", "ein", "recent_date", or "total_amount"
- `sort_order` (string, optional) - "asc" or "desc"

**Returns:**
- Name, EIN, most recent grant note, transaction count, and total amount for each grantee

### 3. `show_grantee`
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

## Deployment

### Deploying to Vercel

See [DEPLOY.md](./docs/DEPLOY.md) for detailed deployment instructions.

**Quick steps:**
1. Connect your repository to Vercel
2. Set `MCP_API_KEY` environment variable
3. Deploy!

Your MCP server will be available at `https://your-project.vercel.app/{guid}/mcp` (where `{guid}` is your `MCP_GUID` environment variable)

### Setting Up ChatGPT Desktop

See [CHATGPT_SETUP.md](./docs/CHATGPT_SETUP.md) for instructions on connecting ChatGPT Desktop to your deployed server.

## Configuration

### Environment Variables

- `MCP_GUID` - GUID used in the endpoint path `/{guid}/mcp` (required - acts as security token)
- `MCP_API_KEY` - API key for additional authentication (optional)
- `DATA_DIR` - Custom path to data directory (defaults to `./data`)

**Important**: The MCP endpoint is now at `/{guid}/mcp` where `{guid}` is the value of `MCP_GUID`. This provides basic security by obscuring the endpoint URL.

### CSV File Requirements

The server automatically loads all CSV files from the `data/` directory. Ensure your CSV files:

1. Have a header row containing "Transaction ID"
2. Use standard CSV format (handles quoted fields with commas)
3. Are saved with `.csv` extension

## Development

### Running Locally

```bash
# Install dependencies
npm install

# Run Next.js dev server (includes web UI and HTTP MCP endpoint)
npm run dev

# Run stdio server (for Cursor)
npm run start:stdio

# Build for production
npm run build

# Start production server
npm start
```

### Testing

```bash
# Run test suite (watch mode)
npm test

# Run test suite once
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage report
npm run test:coverage

# Run manual integration tests
npm run test:manual
npm run test:client
npm run test:filter
```

The test suite includes:
- **Unit tests** for core business logic (filters, transactions, grantees)
- **Integration tests** for MCP handlers
- **API tests** for HTTP request handling and authentication

All tests use Vitest and achieve **89% code coverage**.

### Dependencies

- `@modelcontextprotocol/sdk` - MCP SDK for building the server
- `fuse.js` - Fuzzy search functionality
- `next` - Next.js framework for web UI and HTTP server
- `react` - React for web UI
- `tailwindcss` - Styling framework

## Future Enhancements

- [ ] Excel file upload via web UI
- [ ] Enhanced web UI with transaction browsing
- [ ] Data visualization and charts
- [ ] Export functionality
- [ ] User authentication for web UI

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
