# MCP Tool Approval Research Summary

This document summarizes research findings on bypassing tool confirmations in ChatGPT's MCP integration across different platforms.

## Key Findings

### 1. Platform-Specific Solutions

#### Desktop App (macOS/Windows/Linux)
- **Solution**: Edit `mcp_config.json` configuration file
- **Location**: 
  - macOS: `~/Library/Application Support/OpenAI/ChatGPT/mcp_config.json`
  - Windows: `%APPDATA%\OpenAI\ChatGPT\mcp_config.json`
  - Linux: `~/.config/OpenAI/ChatGPT/mcp_config.json`
- **Method**: Add `autoApprove` array to connector configuration
- **Status**: ✅ Fully supported, persistent across sessions

#### Web App (chat.openai.com / chatgpt.com)
- **Solution 1**: Browser extension "MCP Auto Accept for ChatGPT"
  - Chrome Web Store: https://chromewebstore.google.com/detail/mcp-auto-accept-for-chatg/hgmlcoonafjeljbcndajnambopiccndg
  - Automatically checks "don't ask again" and confirms actions
  - Status: ✅ Works, persistent across sessions
- **Solution 2**: Built-in "remember approval" checkbox
  - Status: ⚠️ May not be available in all confirmation dialogs
  - Only session-specific (resets on new chat/refresh)

#### iOS App
- **Solution**: None available
- **Status**: ❌ No bypass option exists
- **Evidence**: Screenshot shows only "Confirm" and "Deny" buttons, no checkbox
- **Limitation**: Each tool invocation requires manual confirmation

### 2. Critical Finding: readOnlyHint Annotation

**According to OpenAI's official documentation:**

> "In contrast, read actions, which involve retrieving or searching for information without altering external systems, do not require such confirmations. This streamlined approach allows users to access data efficiently while maintaining control over operations that could impact external systems."
> 
> "It's important to note that while ChatGPT respects the `readOnlyHint` tool annotation to identify read-only tools, any tool without this hint is treated as a write action and will prompt for confirmation accordingly."

**Source**: https://platform.openai.com/docs/guides/developer-mode

**MCP Specification:**
According to the MCP specification, `readOnlyHint` should be included in the `annotations` object at the tool level:

```json
{
  "name": "tool_name",
  "description": "Tool description",
  "inputSchema": { ... },
  "annotations": {
    "readOnlyHint": true
  }
}
```

**Status**: ✅ **This is the solution!** All BIC Grants tools are read-only but are missing the `readOnlyHint` annotation, causing ChatGPT to treat them as write actions and require confirmations.

**Action Required**: ✅ **COMPLETED** - Added `annotations: { readOnlyHint: true }` to all tool definitions in `src/lib/mcp-tools.ts`

**Expected Result**: After deploying this change, ChatGPT should recognize all BIC Grants tools as read-only and may bypass confirmations (or require fewer confirmations) for these tools. However, platform-specific limitations may still apply, especially on iOS.

### 3. Known Issues (from GitHub)

1. **VS Code Extension Ignores `approval_policy="never"`**
   - Issue: Codex VS Code extension inconsistently requests approval despite configuration
   - Reference: https://github.com/openai/codex/issues/5038

2. **Approval Policy Ignored in Codex CLI**
   - Issue: MCP edit tools execute even when configured in "read-only" mode
   - Reference: https://github.com/openai/codex/issues/4152

3. **Schema Compatibility Issues**
   - Some MCP servers have schema validation issues with OpenAI's requirements
   - Missing `additionalProperties: false` can cause 400 errors

### 4. User Experience Observations

- **Frustration Point**: Manual confirmation required for every tool invocation on iOS/web
- **Workaround**: Browser extension is the most reliable solution for web users
- **Desktop Users**: Have the best experience with persistent configuration
- **iOS Users**: No solution available - this is a platform limitation

### 5. Recommendations

#### For Users:
1. **Desktop**: Use `mcp_config.json` for persistent auto-approval
2. **Web**: Install browser extension for persistent auto-approval
3. **iOS**: No solution - must manually confirm each invocation (consider using web app with extension instead)

#### For Developers:
1. Consider adding `readOnlyHint` annotations if supported
2. Document that all tools are read-only in tool descriptions
3. Monitor OpenAI's MCP documentation for updates on approval mechanisms

### 6. References

- OpenAI Developer Mode Documentation: https://platform.openai.com/docs/guides/developer-mode
- OpenAI MCP Documentation: https://platform.openai.com/docs/mcp/
- FastMCP ChatGPT Integration: https://fastmcp.wiki/en/integrations/chatgpt
- MCP Auto Accept Extension: https://chromewebstore.google.com/detail/mcp-auto-accept-for-chatg/hgmlcoonafjeljbcndajnambopiccndg
- GitHub Issues:
  - https://github.com/openai/codex/issues/5038
  - https://github.com/openai/codex/issues/4152
  - https://github.com/openai/codex/issues/4796

## Conclusion

The tool confirmation system in ChatGPT's MCP integration varies significantly by platform:
- **Desktop**: Full control via configuration file ✅
- **Web**: Browser extension provides best solution ✅
- **iOS**: No solution available ❌

This is a limitation of OpenAI's implementation, not the MCP server itself. Users on iOS may want to consider using the web app with the browser extension for a better experience.
