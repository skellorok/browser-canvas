<p align="center">
  <img src="assets/hero.png" alt="Browser Canvas Demo" width="700" />
</p>

<h1 align="center">Browser Canvas</h1>

<p align="center">
  <strong>Render interactive UIs in the browser using only file operations</strong>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#features">Features</a> •
  <a href="#react-mode">React</a> •
  <a href="#vanilla-mode">Vanilla</a> •
  <a href="#documentation">Docs</a>
</p>

---

**Browser Canvas** lets Claude Code create interactive UIs by writing files. No API calls, no special protocols—just write a file and watch it render.

**Two modes, same workflow:**

| Mode | File | Stack |
|------|------|-------|
| React | `App.jsx` | shadcn/ui + Tailwind + React hooks |
| Vanilla | `index.html` | Pure HTML/CSS/JS, CSS variables |

```
Write App.jsx or index.html → Browser opens → Edit file → Hot reload → Read _log.jsonl
```

## Quick Start

### Install as Claude Code Plugin

```bash
# In Claude Code
/plugin install parkerhancock/browser-canvas
```

Restart Claude Code after installation.

### Manual Installation

Requires [Bun](https://bun.sh/) runtime.

```bash
git clone https://github.com/parkerhancock/browser-canvas.git
cd browser-canvas
bun install
./server.sh
```

The server watches `.claude/artifacts/` in your current directory. When Claude Code writes an `App.jsx` file there, a browser window opens automatically.

### How It Works

Once the server is running, Claude Code creates UIs by writing files. The server auto-detects the mode based on filename:

```
.claude/artifacts/my-app/App.jsx     →  React mode (shadcn/ui, Tailwind)
.claude/artifacts/my-app/index.html  →  Vanilla mode (pure HTML/CSS/JS)
```

Both modes share the same file protocol (`_state.json`, `_log.jsonl`) and API.

## Features

| Feature | How It Works |
|---------|--------------|
| **Dual Mode** | React (`App.jsx`) or Vanilla (`index.html`) — auto-detected |
| **Hot Reload** | Edit files → browser updates instantly |
| **Unified Log** | Events, errors, validation → `_log.jsonl` (grep-friendly) |
| **Two-Way State** | Agent writes `_state.json` ↔ canvas reads/writes |
| **TypeScript API** | `CanvasClient` for screenshots, close, state operations |
| **Validation** | ESLint, scope checking, Tailwind, accessibility (axe-core) |
| **Auto-Feedback** | PostToolUse hook injects validation errors after writes |
| **Multi-Canvas** | Toolbar dropdown switches between artifacts |

## React Mode

Write `App.jsx` for rapid prototyping with pre-bundled components:

```jsx
function App() {
  const [count, setCount] = useState(0);
  return (
    <Card className="w-80 mx-auto mt-8">
      <CardContent className="pt-6 text-center">
        <p className="text-4xl font-bold mb-4">{count}</p>
        <Button onClick={() => setCount(c => c + 1)}>+</Button>
      </CardContent>
    </Card>
  );
}
```

### Components

Everything is pre-bundled and available without imports:

**React** — `useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`, `useReducer`, `useCanvasState`

**shadcn/ui** — `Card`, `Button`, `Input`, `Table`, `Dialog`, `Tabs`, `Select`, `Checkbox`, `Switch`, `Badge`, `Alert`, `Tooltip`, and more

**Recharts** — `LineChart`, `BarChart`, `PieChart`, `AreaChart`, `ResponsiveContainer`, `XAxis`, `YAxis`, `Legend`

**Reusable Components** — `StatCard`, `DataChart`, `DataTable`, `ContactForm`, `ActivityFeed`, `ProgressList`, `MarkdownViewer`

**Utilities** — `cn()` for classNames, `format()` from date-fns, `Markdown`, `remarkGfm`, Tailwind CSS

## Vanilla Mode

Write `index.html` for standards-based, portable artifacts:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>My App</title>
  <link rel="stylesheet" href="/base.css">
</head>
<body>
  <main class="container">
    <article class="card">
      <header class="card-header"><h2>Counter</h2></header>
      <div class="card-body">
        <p class="count" id="count">0</p>
        <button id="increment">+</button>
      </div>
    </article>
  </main>

  <script type="module">
    let count = 0
    document.getElementById('increment').onclick = () => {
      count++
      document.getElementById('count').textContent = count
      window.canvasEmit('incremented', { count })
    }
  </script>
</body>
</html>
```

### Vanilla Features

- **No build step** — Files served directly
- **CSS variables** — `/base.css` provides theming (`--color-primary`, `--space-4`, etc.)
- **Native elements** — `<dialog>`, `<details>`, `<select>`, `<input type="date">`
- **Import maps** — Load libraries from CDN without bundling
- **Web components** — Define custom elements for composition
- **Portable** — Works without the server

### Using Libraries

```html
<script type="importmap">
{
  "imports": {
    "chart.js": "https://cdn.jsdelivr.net/npm/chart.js@4/auto/+esm",
    "marked": "https://cdn.jsdelivr.net/npm/marked@15/+esm"
  }
}
</script>

<script type="module">
  import Chart from 'chart.js'
  import { marked } from 'marked'
</script>
```

## Two-Way State Sync

Both modes support bidirectional state via `_state.json`.

**React** — Use the `useCanvasState()` hook:

```jsx
function App() {
  const [state, setState] = useCanvasState();
  return (
    <Button onClick={() => setState({ ...state, confirmed: true })}>
      {state.message || "Confirm"}
    </Button>
  );
}
```

**Vanilla** — Use `window.canvasState()`:

```javascript
// Read state
const state = await window.canvasState()

// Update state
await window.canvasState({ ...state, confirmed: true })
```

**Agent** reads/writes `_state.json`:
```bash
echo '{"message":"Please confirm"}' > .claude/artifacts/my-app/_state.json
cat .claude/artifacts/my-app/_state.json
```

## TypeScript API

Use `CanvasClient` for operations:

```typescript
import { CanvasClient } from "browser-canvas"

const client = await CanvasClient.fromServerJson()

await client.screenshot("my-app")  // Take screenshot
await client.close("my-app")       // Close canvas
await client.getState("my-app")    // Get state
await client.setState("my-app", { step: 2 })  // Set state
await client.getStatus("my-app")   // Get validation status
await client.list()                // List canvases
await client.health()              // Check server health
```

## Unified Log

All activity goes to `_log.jsonl`. Use grep to filter:

```bash
grep '"type":"event"' _log.jsonl | tail -10      # User interactions
grep '"severity":"error"' _log.jsonl | head -5   # Errors only
grep '"category":"scope"' _log.jsonl             # Missing components
```

Log types: `event`, `notice`, `render`, `screenshot`
Notice categories: `runtime`, `lint`, `eslint`, `scope`, `tailwind`, `overflow`, `image`, `bundle`

## Directory Structure

```
.claude/artifacts/
├── server.json              # Server state (port, active canvases)
├── _server.log              # Server logs
├── react-app/               # React mode
│   ├── App.jsx              # React component
│   ├── _log.jsonl           # Unified log
│   ├── _state.json          # Two-way state
│   └── _screenshot.png      # Screenshot
└── vanilla-app/             # Vanilla mode
    ├── index.html           # HTML/CSS/JS
    ├── _log.jsonl           # Same log format
    ├── _state.json          # Same state sync
    └── _screenshot.png      # Same screenshot API
```

## Configuration

```bash
# Default: .claude/artifacts/ in current directory
./server.sh

# Custom directory
CANVAS_DIR=/path/to/artifacts ./server.sh
./server.sh --dir /path/to/artifacts
```

## Project Extensions

Extend browser-canvas with project-specific libraries and styles. Create files in `.claude/canvas/`:

| Extension | File | Purpose |
|-----------|------|---------|
| **Libraries** | `scope.ts` | Add npm packages to canvas scope |
| **Tailwind** | `tailwind.config.js` | Add Tailwind plugins |
| **Custom CSS** | `styles.css` | Custom CSS rules |

### Adding Libraries

```bash
# Install a package
bun add react-markdown
```

```typescript
// .claude/canvas/scope.ts
import ReactMarkdown from "react-markdown"

export const extend = {
  ReactMarkdown
}
```

### Adding Tailwind Plugins

```bash
bun add -d @tailwindcss/typography
```

```javascript
// .claude/canvas/tailwind.config.js
export default {
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
```

### Custom CSS

```css
/* .claude/canvas/styles.css */
.custom-gradient {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

Extensions are detected at server startup and bundled automatically (~50ms rebuild).

## Documentation

- **[SKILL.md](skills/canvas/SKILL.md)** — Full skill reference for Claude Code

## Development

```bash
bun run dev          # Development server (with hot reload)
bun run build        # Production build
bun run typecheck    # Type check
```

## Architecture

- **Server**: Bun + Hono (HTTP + WebSocket)
- **Browser**: react-runner with pre-bundled component scope
- **Styling**: Tailwind CSS + shadcn/ui
- **File Watching**: chokidar
- **Screenshots**: html2canvas

## License

MIT
