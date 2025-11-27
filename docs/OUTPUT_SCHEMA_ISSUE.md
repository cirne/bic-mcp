# MCP Server HTTP OutputSchema Issue

## Summary

The MCP server **does not work over HTTP** when `outputSchema` is enabled for tools that return arrays or use `oneOf` schemas. As a result, `outputSchema` is currently **disabled** for all tools via the `ENABLE_OUTPUT_SCHEMA` flag in `src/lib/mcp-tools.ts`.

## Current Status

- **`ENABLE_OUTPUT_SCHEMA = false`** - All tools exclude `outputSchema` from their definitions
- All tools are discoverable and functional when `outputSchema` is disabled
- Tools still return structured data via the `structuredContent` field in responses

## Observed Behavior

### Working Tool (with outputSchema enabled)
- **`show_grantee`**: ✅ Works correctly
  - `outputSchema.type`: `"object"`
  - Returns complex nested object structure

### Failing Tools (with outputSchema enabled)
- **`list_grantees`**: ❌ "Tool not found" error
  - `outputSchema.type`: `"array"`
  - Returns array of grantee summary objects

- **`list_transactions`**: ❌ "Tool not found" error
  - `outputSchema`: Uses `oneOf` (no top-level `type` field)
  - Returns either array or grouped object depending on `group_by` parameter

- **`aggregate_transactions`**: ❌ "Tool not found" error
  - `outputSchema.type`: `"array"`
  - Returns array of aggregated result objects

## Pattern Analysis

The failure pattern suggests Claude's MCP client (over HTTP) has issues with:

1. **Array-type output schemas** (`type: "array"`)
   - Tools returning arrays are not discoverable
   - `list_grantees` and `aggregate_transactions` both fail

2. **OneOf schemas** (no top-level `type` field)
   - Tools using `oneOf` at the top level are not discoverable
   - `list_transactions` fails (uses `oneOf` to support both array and object returns)

3. **Object-type output schemas** (`type: "object"`)
   - ✅ These work correctly
   - `show_grantee` successfully discovered and executed

## Hypothesis

Claude's MCP HTTP client appears to validate or process `outputSchema` during tool discovery/registration. When it encounters:

- **Array schemas**: The client may reject the tool during discovery, resulting in "Tool not found" errors
- **OneOf schemas**: The client may not properly handle schemas without a top-level `type` field, causing discovery to fail
- **Object schemas**: These are handled correctly, allowing successful discovery and execution

### Possible Root Causes

1. **Schema validation bug**: Claude's client may have overly strict validation that rejects array/oneOf schemas
2. **Incomplete MCP spec implementation**: The client may not fully support all JSON Schema constructs in `outputSchema`
3. **Type inference issues**: The client may require a top-level `type` field for type inference and fail when it's missing (oneOf case)
4. **Array handling limitation**: The client may have specific expectations about array schemas that our definitions don't meet

## Workaround

Disable `outputSchema` for all tools by setting `ENABLE_OUTPUT_SCHEMA = false` in `src/lib/mcp-tools.ts`. Tools still function correctly and return structured data via the `structuredContent` field in responses, which is parsed from the `content` field JSON.

## Future Considerations

If `outputSchema` support is needed:

1. **Wrap array responses in objects**: Change array-returning tools to return `{ results: [...] }` with object schema
2. **Simplify oneOf schemas**: Remove `oneOf` and always return arrays (lose grouped object functionality)
3. **Report bug**: File issue with Claude/Anthropic about array/oneOf schema support
4. **Wait for client fix**: Monitor for updates to Claude's MCP client that fix this limitation

## Related Files

- `src/lib/mcp-tools.ts` - Tool definitions with `ENABLE_OUTPUT_SCHEMA` flag
- `src/lib/mcp-api-handler.ts` - Response formatting logic (still includes `structuredContent`)

## Testing

To test if the issue is resolved in future client versions:

1. Set `ENABLE_OUTPUT_SCHEMA = true` in `src/lib/mcp-tools.ts`
2. Deploy to Vercel
3. Have Claude attempt to discover and use the tools
4. Check if array/oneOf schemas are now supported
