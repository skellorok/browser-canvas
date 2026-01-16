#!/bin/bash
#
# PostToolUse hook for browser-canvas
# Injects validation errors/warnings after writes to artifact App.jsx files
#

# Only process Write and Edit tools
if [[ "$CLAUDE_TOOL_NAME" != "Write" && "$CLAUDE_TOOL_NAME" != "Edit" ]]; then
  exit 0
fi

# Extract file_path from tool input JSON
FILE_PATH=$(echo "$CLAUDE_TOOL_INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')

# Check if this is an App.jsx in an artifacts folder
if [[ ! "$FILE_PATH" =~ \.claude/artifacts/([^/]+)/App\.jsx$ ]]; then
  exit 0
fi

# Extract canvas ID from path
CANVAS_ID="${BASH_REMATCH[1]}"

# Fetch validation status (wait=true blocks until validation completes)
RESPONSE=$(curl -s "http://127.0.0.1:9847/api/canvas/${CANVAS_ID}/status?wait=true&timeout=2000" 2>/dev/null)

# Check if server is running
if [[ -z "$RESPONSE" ]]; then
  exit 0
fi

# Parse response using simple pattern matching
HAS_STATUS=$(echo "$RESPONSE" | grep -o '"hasStatus"[[:space:]]*:[[:space:]]*true' | head -1)
ERROR_COUNT=$(echo "$RESPONSE" | grep -o '"errorCount"[[:space:]]*:[[:space:]]*[0-9]*' | grep -o '[0-9]*$')
WARNING_COUNT=$(echo "$RESPONSE" | grep -o '"warningCount"[[:space:]]*:[[:space:]]*[0-9]*' | grep -o '[0-9]*$')

# If no status or no issues, exit silently
if [[ -z "$HAS_STATUS" ]] || [[ "${ERROR_COUNT:-0}" == "0" && "${WARNING_COUNT:-0}" == "0" ]]; then
  exit 0
fi

# Build context message
CONTEXT="## Canvas Validation: \`${CANVAS_ID}\`\n\n"

if [[ "${ERROR_COUNT:-0}" -gt 0 ]]; then
  CONTEXT+="**${ERROR_COUNT} error(s)** - component may not render.\n"
fi

if [[ "${WARNING_COUNT:-0}" -gt 0 ]]; then
  CONTEXT+="**${WARNING_COUNT} warning(s)**\n"
fi

# Extract notice messages (get all message fields)
NOTICES=$(echo "$RESPONSE" | grep -o '"message"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/"message"[[:space:]]*:[[:space:]]*"\([^"]*\)"/- \1/g')

if [[ -n "$NOTICES" ]]; then
  CONTEXT+="\n### Issues:\n${NOTICES}\n"
fi

# Output as JSON with additionalContext
# Escape for JSON: replace newlines, escape quotes
ESCAPED=$(echo -e "$CONTEXT" | sed 's/"/\\"/g' | tr '\n' ' ' | sed 's/  */ /g')
printf '{"additionalContext": "%s", "continue": true}' "$ESCAPED"
