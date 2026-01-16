# Browser Canvas Development Guide

## Project Structure

```
browser-canvas/
├── src/
│   ├── client.ts                # CanvasClient API for operations
│   ├── server/
│   │   ├── index.ts             # Bun + Hono server entry
│   │   ├── watcher.ts           # File system watcher (chokidar)
│   │   ├── websocket.ts         # WebSocket handler
│   │   ├── canvas-manager.ts    # Canvas instance state
│   │   ├── component-loader.ts  # Reusable component loading
│   │   ├── scope-builder.ts     # Dynamic scope bundling
│   │   ├── tailwind-builder.ts  # Dynamic CSS building
│   │   ├── validators.ts        # ESLint, scope, Tailwind validation
│   │   ├── validation-status.ts # Validation state for status API
│   │   └── log.ts               # Unified log system
│   └── browser/
│       ├── index.html           # Canvas shell
│       ├── app.tsx              # React app with react-runner
│       ├── scope.ts             # Pre-bundled dependencies
│       ├── event-bridge.ts      # window.canvasEmit implementation
│       ├── use-canvas-state.ts  # Two-way state sync hook
│       ├── linter.ts            # axe-core, overflow, image validation
│       └── components/ui/       # shadcn components
├── skills/
│   └── canvas/
│       ├── SKILL.md             # Claude instructions
│       ├── components/          # Reusable components (auto-loaded)
│       └── references/          # Component documentation
├── hooks/
│   ├── hooks.json               # PostToolUse hook config
│   └── canvas-validation.sh     # Validation feedback injection
├── dist/                        # Built output (gitignored)
├── server.sh                    # Start server script
└── package.json
```

## Key Architecture

### File-Based Protocol

Claude interacts via filesystem for data:

| Claude Action | File Operation |
|---------------|----------------|
| Create canvas | Write `App.jsx` to new folder |
| Update canvas | Edit `App.jsx` |
| Read log | Read `_log.jsonl` (grep for type/severity/category) |
| Read/write state | Read/write `_state.json` |

### TypeScript API (Operations)

Use `CanvasClient` for operations:

```typescript
import { CanvasClient } from "browser-canvas"
const client = await CanvasClient.fromServerJson()

await client.screenshot("my-app")  // Take screenshot
await client.close("my-app")       // Close canvas
await client.getState("my-app")    // Get state (alternative to file)
await client.setState("my-app", { step: 2 })  // Set state
await client.getStatus("my-app")   // Get validation status
await client.health()              // Check server health
```

### Server ↔ Browser Protocol (WebSocket)

```typescript
// Server → Browser
{ type: "reload", code: string }
{ type: "screenshot-request" }

// Browser → Server
{ type: "event", event: string, data: unknown }
{ type: "screenshot", dataUrl: string }
{ type: "error", message: string }
```

### PostToolUse Hook (Validation Feedback)

The plugin includes a PostToolUse hook that automatically injects validation errors after Write/Edit operations on `App.jsx` files:

```
hooks/
├── hooks.json               # Hook configuration
└── canvas-validation.sh     # Fetches validation status, formats output
```

Flow:
1. Claude writes/edits `App.jsx`
2. Server validates (ESLint, scope, Tailwind)
3. Hook calls `/api/canvas/:id/status?wait=true`
4. Validation errors injected via `additionalContext`

The status API supports waiting for pending validation:
```
GET /api/canvas/:id/status?wait=true&timeout=2000
```

## Development Commands

```bash
bun install          # Install dependencies
bun run dev          # Start dev server with watch
bun run build        # Build browser bundle
bun run typecheck    # Type check
```

## Adding shadcn Components

1. Copy component to `src/browser/components/ui/`
2. Export from `src/browser/scope.ts`
3. Document in `skills/canvas/references/components.md`
4. Rebuild: `bun run build`

## Adding Reusable Components

Reusable components are auto-loaded from multiple directories (later overrides earlier):

1. `skills/canvas/components/*.jsx` - Skill-level (ships with package)
2. `~/.claude/canvas/components/*.jsx` - Global user components
3. `.claude/canvas/components/*.jsx` - Project-level components

Component file format:

```jsx
/**
 * MyComponent - Brief description
 * @prop {string} title - Prop description
 * @prop {function} onClick - Callback description
 */
function MyComponent({ title, onClick }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
    </Card>
  )
}
```

Components are compiled with sucrase and sent to the browser via WebSocket. No imports needed - just use `<MyComponent />` in App.jsx.

## Project Extensions

Projects can extend browser-canvas by creating files in `.claude/canvas/`:

| File | Purpose | Rebuild Trigger |
|------|---------|-----------------|
| `scope.ts` | Add npm packages to scope | JS bundle |
| `tailwind.config.js` | Add Tailwind plugins | CSS |
| `styles.css` | Custom CSS rules | CSS |
| `components/*.jsx` | Project-specific components | Components |

### scope-builder.ts

Handles dynamic bundling of scope extensions:
- Reads base `scope.ts` and project `.claude/canvas/scope.ts`
- Converts relative imports to absolute paths
- Uses Bun plugin to intercept scope imports during build
- Merges base scope with project `extend` object

### tailwind-builder.ts

Handles dynamic CSS building:
- Generates merged Tailwind config from base + project
- Runs Tailwind CLI with merged config
- Appends custom CSS from `.claude/canvas/styles.css`

Extensions are detected at server startup. If found, rebuilds are triggered (~50ms).

## Canvas Directory (Runtime)

Default: `.claude/artifacts/` in current directory:

```
.claude/artifacts/
├── server.json              # Server state (port, active canvases)
├── _server.log              # Server logs
└── <canvas-name>/
    ├── App.jsx              # Component code
    ├── _log.jsonl           # Unified log (events, errors, validation)
    ├── _state.json          # Two-way state
    └── _screenshot.png      # Screenshot output (via API)
```

## Testing

Manual testing:

1. Start server: `./server.sh`
2. Create test canvas: write to `.claude/artifacts/test/App.jsx`
3. Verify browser opens and renders
4. Test hot-reload by editing the file
5. Test events with `window.canvasEmit()`
6. Test screenshots via `CanvasClient.screenshot()`
7. Check `_log.jsonl` for validation notices

## Code Style

- TypeScript for all server code
- JSX/TSX for browser code
- Tailwind for styling
- No semicolons (Bun default)
- 2-space indentation

## Key Dependencies

- **bun** - Runtime and bundler
- **hono** - HTTP framework
- **chokidar** - File watching
- **react-runner** - JSX execution
- **sucrase** - JSX compilation for components
- **html2canvas** - Screenshots
- **eslint** - Server-side code validation
- **axe-core** - Browser-side accessibility/visual validation
- **@radix-ui** - Primitives for shadcn
- **recharts** - Charts
- **lucide-react** - Icons
- **tailwindcss** - Styling
