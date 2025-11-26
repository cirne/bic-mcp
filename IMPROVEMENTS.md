# MCP Server Improvements

## Problem
Previously, to answer queries like "list all transactions sent to Young Life since 2023, grouped by year", we had to:
1. Search with fuzzy matching (which returned too many false positives)
2. Manually filter results in code
3. Manually group by year
4. Manually sort by date
5. Manually extract only needed fields

## Solution: Enhanced Query Parameters

### New Filtering Options

1. **`charity`** (string) - Exact charity name matching
   - Example: `{ charity: "Young Life" }`
   - Much more precise than fuzzy search

2. **`min_year`** (number) - Filter transactions from this year onwards
   - Example: `{ min_year: 2023 }` for "since 2023"
   - More flexible than exact `year` filter

3. **`max_year`** (number) - Filter transactions up to this year
   - Example: `{ max_year: 2024 }`
   - Can combine with `min_year` for date ranges

4. **`max_amount`** (number) - Filter transactions below this amount
   - Example: `{ max_amount: 100000 }`
   - Complements `min_amount` for amount ranges

### New Sorting Options

5. **`sort_by`** (string) - Field to sort by
   - Example: `{ sort_by: "Sent Date" }` or `{ sort_by: "Amount" }`
   - Handles dates and amounts intelligently

6. **`sort_order`** (string) - Sort direction
   - Options: `"asc"` (default) or `"desc"`
   - Example: `{ sort_by: "Amount", sort_order: "desc" }`

### New Grouping Options

7. **`group_by`** (string) - Group results by field
   - Special value: `"year"` extracts year from date fields
   - Example: `{ group_by: "year" }` or `{ group_by: "Charity" }`
   - Returns grouped object instead of flat array

### New Field Selection

8. **`fields`** (array) - Select specific fields to return
   - Example: `{ fields: ["Sent Date", "Amount", "Grant Purpose"] }`
   - Reduces response size and focuses on needed data

## Example Usage

### Before (required custom code):
```javascript
// Had to search, filter, group, and format manually
const results = await search("Young Life");
const filtered = results.filter(t => 
  t.Charity === "Young Life" && 
  extractYear(t["Sent Date"]) >= 2023
);
const grouped = groupByYear(filtered);
// ... more manual processing
```

### After (single MCP call):
```javascript
{
  charity: "Young Life",
  min_year: 2023,
  sort_by: "Sent Date",
  group_by: "year",
  fields: ["Sent Date", "Amount", "Grant Purpose"]
}
```

## Benefits

1. **No custom code needed** - All filtering, sorting, grouping done server-side
2. **More precise queries** - Exact field matching instead of fuzzy search
3. **Better performance** - Server-side processing is more efficient
4. **Cleaner responses** - Field selection reduces noise
5. **Flexible date ranges** - `min_year`/`max_year` instead of just exact year

