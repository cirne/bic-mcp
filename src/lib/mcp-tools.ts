// MCP tool definitions - shared between HTTP API handler and stdio server

export const MCP_TOOLS = [
  {
    name: 'list_transactions',
    description: 'Search for grant transactions with advanced filtering, sorting, and grouping options.',
    inputSchema: {
      type: 'object',
      properties: {
        search_term: {
          type: 'string',
          description: 'Optional: The search term to find matching transactions using fuzzy, case-insensitive search across all fields',
        },
        charity: {
          type: 'string',
          description: 'Optional: Filter by exact charity name (case-insensitive)',
        },
        year: {
          type: 'number',
          description: 'Optional: Filter transactions by exact year (e.g., 2025). Checks all date fields.',
        },
        min_year: {
          type: 'number',
          description: 'Optional: Filter transactions from this year onwards (e.g., 2023 for "since 2023")',
        },
        max_year: {
          type: 'number',
          description: 'Optional: Filter transactions up to this year',
        },
        min_amount: {
          type: 'number',
          description: 'Optional: Filter transactions with amount greater than or equal to this value (e.g., 25000)',
        },
        max_amount: {
          type: 'number',
          description: 'Optional: Filter transactions with amount less than or equal to this value',
        },
        category: {
          type: 'string',
          description: 'Optional: Filter transactions by grantee category. Valid categories: "Evangelism", "Matthew 25", "Education/Schools", "Churches/Offerings"',
        },
        grant_status: {
          type: 'string',
          description: 'Optional: Filter transactions by grant status. Common values include: "Payment Cleared", "Pending", "Cancelled", "Reversed", "Denied". Case-insensitive match.',
        },
        is_beloved: {
          type: 'boolean',
          description: 'Optional: Filter transactions by is_beloved flag (true for Mountain Metro Church and Beloved in Christ Gallery, false for all others). If not provided, includes all grantees.',
        },
        sort_by: {
          type: 'string',
          description: 'Optional: Field to sort by (e.g., "Sent Date", "Amount"). Default: no sorting',
        },
        sort_order: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: 'Optional: Sort order - "asc" or "desc". Default: "asc"',
        },
        group_by: {
          type: 'string',
          description: 'Optional: Field to group results by (e.g., "year" extracts year from date fields, or any field name). Returns grouped object.',
        },
        fields: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: Array of field names to include in response (e.g., ["Sent Date", "Amount", "Grant Purpose"]). If not provided, returns all fields.',
        },
      },
      required: [],
    },
  },
  {
    name: 'list_grantees',
    description: 'List all unique grantees (charities) with summary data including name, EIN, most recent grant note, transaction count, and total amount. This tool provides aggregated summary data for each grantee, making it ideal for answering questions about top grantees, largest recipients, or grantee rankings. Supports sorting by total amount, name, EIN, or most recent grant date. Optionally filter to only grantees that received grants in a specific year.',
    inputSchema: {
      type: 'object',
      properties: {
        year: {
          type: 'number',
          description: 'Optional: Filter to only grantees that received grants in this year (e.g., 2024). If provided, transaction count and total amount will be scoped to this year only.',
        },
        category: {
          type: 'string',
          description: 'Optional: Filter grantees by category. Valid categories: "Evangelism", "Matthew 25", "Education/Schools", "Churches/Offerings"',
        },
        is_beloved: {
          type: 'boolean',
          description: 'Optional: Filter grantees by is_beloved flag (true for Mountain Metro Church and Beloved in Christ Gallery, false for all others). If not provided, includes all grantees.',
        },
        sort_by: {
          type: 'string',
          enum: ['name', 'ein', 'recent_date', 'total_amount'],
          description: 'Optional: Sort grantees by name, EIN, most recent grant date, or total amount. Default: name',
        },
        sort_order: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: 'Optional: Sort order - "asc" or "desc". Default: "asc"',
        },
      },
      required: [],
    },
  },
  {
    name: 'show_grantee',
    description: 'Show detailed information about a specific grantee including metadata and all transaction history.',
    inputSchema: {
      type: 'object',
      properties: {
        charity: {
          type: 'string',
          description: 'Required: Exact charity name to look up',
        },
        ein: {
          type: 'string',
          description: 'Optional: EIN (Employer Identification Number) to help identify the grantee if name is ambiguous',
        },
      },
      required: ['charity'],
    },
  },
  {
    name: 'aggregate_transactions',
    description: 'Aggregate grant transactions by category, grantee, year, international, is_beloved, or status. Returns summary statistics (count and total_amount) for each group. Only includes Payment Cleared grants (unless grouping by status, in which case all statuses are included). Use this tool for summary reports, category breakdowns, top grantees by amount, yearly totals, or status breakdowns.',
    inputSchema: {
      type: 'object',
      properties: {
        group_by: {
          type: 'string',
          enum: ['category', 'grantee', 'year', 'international', 'is_beloved', 'status'],
          description: 'Required: Field to aggregate by - "category" (Evangelism, Matthew 25, Education/Schools, Churches/Offerings), "grantee" (charity name), "year", "international" (true/false), "is_beloved" (true/false), or "status" (Payment Cleared, Pending, Cancelled, Reversed, Denied, etc.). When grouping by status, all statuses are included (not just Payment Cleared).',
        },
        year: {
          type: 'number',
          description: 'Optional: Filter transactions by exact year (e.g., 2025). Checks all date fields.',
        },
        min_year: {
          type: 'number',
          description: 'Optional: Filter transactions from this year onwards (e.g., 2023 for "since 2023")',
        },
        max_year: {
          type: 'number',
          description: 'Optional: Filter transactions up to this year',
        },
        min_amount: {
          type: 'number',
          description: 'Optional: Filter transactions with amount greater than or equal to this value (e.g., 25000)',
        },
        max_amount: {
          type: 'number',
          description: 'Optional: Filter transactions with amount less than or equal to this value',
        },
        category: {
          type: 'string',
          description: 'Optional: Filter by category when grouping by grantee or year (e.g., "Evangelism", "Matthew 25")',
        },
        charity: {
          type: 'string',
          description: 'Optional: Filter by exact charity name when grouping by category or year',
        },
        is_beloved: {
          type: 'boolean',
          description: 'Optional: Filter transactions by is_beloved flag (true for Mountain Metro Church and Beloved in Christ Gallery, false for all others). If not provided, includes all grantees.',
        },
        sort_by: {
          type: 'string',
          enum: ['count', 'total_amount', 'name'],
          description: 'Optional: Sort results by count, total_amount, or name. Default: total_amount',
        },
        sort_order: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: 'Optional: Sort order - "asc" or "desc". Default: desc',
        },
      },
      required: ['group_by'],
    },
  },
];

