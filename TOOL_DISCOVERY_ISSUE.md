# Tool Discovery Issue Analysis

## Problem

Claude's MCP client reports: **"Tool 'BiC Grants:list_grantees' not found"**

This is a tool discovery/registration issue, not an execution issue. The tools are being returned correctly from `tools/list`, but Claude's client isn't registering them.

## Pattern Analysis

| Tool | outputSchema Type | Status |
|------|------------------|--------|
| `show_grantee` | `type: "object"` | ✅ **WORKS** |
| `list_grantees` | `type: "array"` | ❌ **FAILS** |
| `list_transactions` | `oneOf` (no top-level `type`) | ❌ **FAILS** |
| `aggregate_transactions` | `type: "array"` | ❌ **FAILS** |

## Hypothesis

Claude's MCP client may have a bug or limitation where it:
1. **Rejects tools with `type: "array"` in outputSchema** during discovery
2. **Rejects tools with top-level `oneOf`** (no top-level `type` field) during discovery
3. **Only accepts `type: "object"`** output schemas

## Evidence

- All failing tools have array or oneOf schemas
- Only the tool with `type: "object"` works
- The server correctly returns all tools from `tools/list`
- The schemas are valid JSON Schema 2020-12

## Potential Solutions

### Option 1: Wrap Array Responses in Objects (Breaking Change)

Change array-returning tools to return objects with an array property:

```typescript
// Before (fails):
outputSchema: { type: 'array', items: {...} }

// After (might work):
outputSchema: {
  type: 'object',
  properties: {
    results: { type: 'array', items: {...} }
  },
  required: ['results']
}
```

**Pros:** Might fix the discovery issue  
**Cons:** Breaking API change, requires updating all handlers and clients

### Option 2: Simplify `list_transactions` Schema

Remove `oneOf` and always return array (lose grouped object support):

```typescript
// Before (fails):
outputSchema: { oneOf: [{ type: 'array' }, { type: 'object' }] }

// After (might work):
outputSchema: { type: 'array', items: {...} }
```

**Pros:** Simpler schema  
**Cons:** Loses grouped response functionality

### Option 3: Wait for Claude Fix

Report the issue to Claude/Anthropic and wait for a client fix.

**Pros:** No breaking changes  
**Cons:** Unknown timeline, users blocked

### Option 4: Remove `outputSchema` Temporarily

Remove `outputSchema` from failing tools to see if that allows discovery:

```typescript
// Remove outputSchema field entirely
```

**Pros:** Quick test to confirm hypothesis  
**Cons:** Loses structured output benefits, might not fix issue

## Recommended Next Steps

1. **Test Option 4 first** - Remove `outputSchema` from `list_grantees` to see if tool becomes discoverable
2. **If that works**, implement Option 1 for all array-returning tools
3. **Report bug** to Claude/Anthropic about array/oneOf schema support
4. **Monitor** Vercel logs for `tools/list` calls to see what Claude receives

## Current Status

- ✅ Enhanced logging deployed to track request flow
- ✅ `tools/list` logging added to see what Claude receives
- ⏳ Waiting for Claude to retry and check logs
