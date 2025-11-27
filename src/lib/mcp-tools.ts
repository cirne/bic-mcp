// MCP tool definitions - shared between HTTP API handler and stdio server

// Flag to enable/disable outputSchema in tool definitions
// Set to false to disable outputSchema (useful for testing tool discovery issues)
const ENABLE_OUTPUT_SCHEMA = false;

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
          description: 'Optional: Filter transactions by is_beloved flag. When true, includes only internal operating foundations that are principally governed and financially supported by BiC foundation (currently Mountain Metro Church and Beloved in Christ Gallery). When false, includes only external grantees where BiC serves as a donor. This flag is useful for distinguishing between internal operations vs. external grant-making, analyzing operational expenses vs. charitable giving, or understanding the foundation\'s direct operations. If not provided, includes all grantees.',
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
    ...(ENABLE_OUTPUT_SCHEMA ? {
      outputSchema: {
        oneOf: [
          {
            type: 'array',
            description: 'Array of transaction objects when group_by is not specified',
            items: {
              type: 'object',
              description: 'Transaction object with all standard fields plus computed Category, International, and Is Beloved fields',
              properties: {
                'Transaction ID': { type: 'string' },
                Charity: { type: 'string' },
                'Charity Address': { type: 'string' },
                'Grant Status': { type: 'string' },
                Amount: { type: 'string', description: 'Formatted amount string with commas (e.g., "500,000.00 ")' },
                'Sent Date': { type: 'string', description: 'Date in M/D/YY format' },
                'Requested Payment Date': { type: 'string' },
                'Recommendation Submitted Date': { type: 'string' },
                'Cleared Date': { type: 'string' },
                'Grant Purpose': { type: 'string' },
                'Special Note': { type: 'string' },
                EIN: { type: 'string' },
                'Grant Type': { type: 'string' },
                'Recommended By': { type: 'string' },
                Category: { 
                  type: ['string', 'null'], 
                  description: 'Computed category: "Evangelism", "Matthew 25", "Education/Schools", "Churches/Offerings", or null' 
                },
                International: { 
                  type: 'boolean', 
                  description: 'Computed flag indicating if grantee is international' 
                },
                'Is Beloved': { 
                  type: 'boolean', 
                  description: 'Computed flag indicating if grantee is an internal operating foundation (true for Mountain Metro Church and Beloved in Christ Gallery)' 
                },
              },
              additionalProperties: true,
            },
          },
          {
            type: 'object',
            description: 'Grouped object when group_by is specified, where keys are group values and values are arrays of transactions',
            additionalProperties: {
              type: 'array',
              items: {
                type: 'object',
                description: 'Transaction object (may have limited fields if fields parameter is used)',
                additionalProperties: true,
              },
            },
          },
        ],
      },
    } : {}),
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
          description: 'Optional: Filter grantees by is_beloved flag. When true, includes only internal operating foundations that are principally governed and financially supported by BiC foundation (currently Mountain Metro Church and Beloved in Christ Gallery). When false, includes only external grantees where BiC serves as a donor. This flag is useful for distinguishing between internal operations vs. external grant-making, analyzing operational expenses vs. charitable giving, or understanding the foundation\'s direct operations. If not provided, includes all grantees.',
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
    ...(ENABLE_OUTPUT_SCHEMA ? {
      outputSchema: {
        type: 'array',
        description: 'Array of grantee summary objects',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Grantee organization name',
            },
            ein: {
              type: 'string',
              description: 'Employer Identification Number, or "(no EIN)" if not available',
            },
            international: {
              type: 'boolean',
              description: 'Whether the grantee is international',
            },
            is_beloved: {
              type: 'boolean',
              description: 'Whether this is an internal operating foundation principally governed and financially supported by BiC (true for Mountain Metro Church and Beloved in Christ Gallery)',
            },
            most_recent_grant_note: {
              type: 'string',
              description: 'Most recent grant note from the grantee\'s transactions, or "(no notes)" if none',
            },
            transaction_count: {
              type: 'number',
              description: 'Number of transactions for this grantee (scoped to year if year filter is provided)',
            },
            total_amount: {
              type: 'number',
              description: 'Total grant amount for this grantee (scoped to year if year filter is provided)',
            },
          },
          required: ['name', 'ein', 'international', 'is_beloved', 'most_recent_grant_note', 'transaction_count', 'total_amount'],
        },
      },
    } : {}),
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
    ...(ENABLE_OUTPUT_SCHEMA ? {
      outputSchema: {
        type: 'object',
        description: 'Detailed grantee information with metadata, statistics, and transaction history',
        properties: {
          metadata: {
            type: 'object',
            description: 'Grantee metadata and summary statistics',
            properties: {
              name: {
                type: 'string',
                description: 'Grantee organization name',
              },
              ein: {
                type: 'string',
                description: 'Employer Identification Number, or "(no EIN)" if not available',
              },
              address: {
                type: 'string',
                description: 'Grantee address, or "(no address)" if not available',
              },
              category: {
                type: ['string', 'null'],
                description: 'Grantee category: "Evangelism", "Matthew 25", "Education/Schools", "Churches/Offerings", or null',
              },
              notes: {
                type: ['string', 'null'],
                description: 'Additional notes about the grantee, or null',
              },
              international: {
                type: 'boolean',
                description: 'Whether the grantee is international',
              },
              is_beloved: {
                type: 'boolean',
                description: 'Whether this is an internal operating foundation principally governed and financially supported by BiC (true for Mountain Metro Church and Beloved in Christ Gallery)',
              },
              total_grants: {
                type: 'number',
                description: 'Total number of grants (all statuses)',
              },
              cleared_grants: {
                type: 'number',
                description: 'Number of grants with "Payment Cleared" status',
              },
              non_cleared_grants: {
                type: 'number',
                description: 'Number of grants with status other than "Payment Cleared"',
              },
              total_amount: {
                type: 'number',
                description: 'Total amount of cleared grants only',
              },
              first_grant_year: {
                type: ['number', 'null'],
                description: 'Year of first cleared grant, or null if none',
              },
              last_grant_year: {
                type: ['number', 'null'],
                description: 'Year of most recent cleared grant, or null if none',
              },
            },
            required: ['name', 'ein', 'address', 'category', 'notes', 'international', 'is_beloved', 'total_grants', 'cleared_grants', 'non_cleared_grants', 'total_amount', 'first_grant_year', 'last_grant_year'],
          },
          status_breakdown: {
            type: 'array',
            description: 'Breakdown of grants by status (includes all statuses)',
            items: {
              type: 'object',
              properties: {
                status: {
                  type: 'string',
                  description: 'Grant status (e.g., "Payment Cleared", "Pending", etc.)',
                },
                count: {
                  type: 'number',
                  description: 'Number of grants with this status',
                },
                total_amount: {
                  type: 'number',
                  description: 'Total amount of grants with this status',
                },
              },
              required: ['status', 'count', 'total_amount'],
            },
          },
          yearly_totals: {
            type: 'array',
            description: 'Yearly totals for cleared grants only, sorted by year (most recent first)',
            items: {
              type: 'object',
              properties: {
                year: {
                  type: 'number',
                  description: 'Year',
                },
                count: {
                  type: 'number',
                  description: 'Number of cleared grants in this year',
                },
                total_amount: {
                  type: 'number',
                  description: 'Total amount of cleared grants in this year',
                },
              },
              required: ['year', 'count', 'total_amount'],
            },
          },
          transactions: {
            type: 'array',
            description: 'All transactions for this grantee, sorted by date (most recent first). Includes both cleared and non-cleared grants.',
            items: {
              type: 'object',
              description: 'Transaction object with all standard fields',
              properties: {
                'Transaction ID': { type: 'string' },
                Charity: { type: 'string' },
                'Charity Address': { type: 'string' },
                'Grant Status': { type: 'string' },
                Amount: { type: 'string', description: 'Formatted amount string with commas (e.g., "500,000.00 ")' },
                'Sent Date': { type: 'string', description: 'Date in M/D/YY format' },
                'Requested Payment Date': { type: 'string' },
                'Recommendation Submitted Date': { type: 'string' },
                'Cleared Date': { type: 'string' },
                'Grant Purpose': { type: 'string' },
                'Special Note': { type: 'string' },
                EIN: { type: 'string' },
                'Grant Type': { type: 'string' },
                'Recommended By': { type: 'string' },
              },
              additionalProperties: true,
            },
          },
        },
        required: ['metadata', 'status_breakdown', 'yearly_totals', 'transactions'],
      },
    } : {}),
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
          description: 'Optional: Filter transactions by is_beloved flag. When true, includes only internal operating foundations that are principally governed and financially supported by BiC foundation (currently Mountain Metro Church and Beloved in Christ Gallery). When false, includes only external grantees where BiC serves as a donor. This flag is useful for distinguishing between internal operations vs. external grant-making, analyzing operational expenses vs. charitable giving, or understanding the foundation\'s direct operations. If not provided, includes all grantees.',
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
    ...(ENABLE_OUTPUT_SCHEMA ? {
      outputSchema: {
        type: 'array',
        description: 'Array of aggregated results, one object per group',
        items: {
          oneOf: [
            {
              type: 'object',
              description: 'Result when group_by is "category"',
              properties: {
                category: {
                  type: 'string',
                  description: 'Category name (e.g., "Evangelism", "Matthew 25", "Education/Schools", "Churches/Offerings")',
                },
                count: {
                  type: 'number',
                  description: 'Number of transactions in this group',
                },
                total_amount: {
                  type: 'number',
                  description: 'Total amount for this group',
                },
              },
              required: ['category', 'count', 'total_amount'],
            },
            {
              type: 'object',
              description: 'Result when group_by is "grantee"',
              properties: {
                grantee: {
                  type: 'string',
                  description: 'Grantee identifier in format "Charity Name|EIN"',
                },
                name: {
                  type: 'string',
                  description: 'Grantee organization name',
                },
                count: {
                  type: 'number',
                  description: 'Number of transactions for this grantee',
                },
                total_amount: {
                  type: 'number',
                  description: 'Total amount for this grantee',
                },
              },
              required: ['grantee', 'name', 'count', 'total_amount'],
            },
            {
              type: 'object',
              description: 'Result when group_by is "year"',
              properties: {
                year: {
                  type: 'string',
                  description: 'Year as string (e.g., "2024")',
                },
                count: {
                  type: 'number',
                  description: 'Number of transactions in this year',
                },
                total_amount: {
                  type: 'number',
                  description: 'Total amount for this year',
                },
              },
              required: ['year', 'count', 'total_amount'],
            },
            {
              type: 'object',
              description: 'Result when group_by is "international"',
              properties: {
                international: {
                  type: 'string',
                  description: '"true" or "false"',
                },
                count: {
                  type: 'number',
                  description: 'Number of transactions',
                },
                total_amount: {
                  type: 'number',
                  description: 'Total amount',
                },
              },
              required: ['international', 'count', 'total_amount'],
            },
            {
              type: 'object',
              description: 'Result when group_by is "is_beloved"',
              properties: {
                is_beloved: {
                  type: 'string',
                  description: '"true" for internal operating foundations (Mountain Metro Church and Beloved in Christ Gallery), "false" for external grantees',
                },
                count: {
                  type: 'number',
                  description: 'Number of transactions',
                },
                total_amount: {
                  type: 'number',
                  description: 'Total amount',
                },
              },
              required: ['is_beloved', 'count', 'total_amount'],
            },
            {
              type: 'object',
              description: 'Result when group_by is "status"',
              properties: {
                status: {
                  type: 'string',
                  description: 'Grant status (e.g., "Payment Cleared", "Pending", "Cancelled", "Reversed", "Denied")',
                },
                count: {
                  type: 'number',
                  description: 'Number of transactions with this status',
                },
                total_amount: {
                  type: 'number',
                  description: 'Total amount for this status',
                },
              },
              required: ['status', 'count', 'total_amount'],
            },
          ],
        },
      },
    } : {}),
  },
];

