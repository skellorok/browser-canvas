# Browser Canvas Skill Specification

*Created: 2026-01-07*

A Claude Code skill that provides a browser-based canvas for rendering React/HTML UIs, similar to Claude Artifacts but running locally with full control.

---

## Design Decisions

| Decision | Choice |
|----------|--------|
| Deployment | Local server + browser tab |
| Interaction | **File-based** (Claude writes/edits files, server hot-reloads) |
| Components | shadcn/ui + Tailwind CSS |
| Rendering | react-runner (fast, pre-bundled deps) |
| Multiple canvases | Yes, via separate folders |
| Screenshots | On-demand via file trigger |
| Repository | New standalone repo |

---

## How Claude Interacts (Key Pattern)

**Claude uses standard file operations (Write/Edit/Read tools) - the server watches for changes and hot-reloads the browser.**

This approach leverages Claude's natural strengths: file editing is already optimized and requires no custom client API.

### Canvas Directory Structure

```
/tmp/browser-canvas/
├── server.json                    # Server state (port, active canvases)
├── my-form/                       # Canvas folder (name = canvas ID)
│   ├── App.jsx                    # Claude writes/edits this
│   ├── events.jsonl               # Server appends user events here
│   ├── _screenshot.png            # Server writes on request
│   └── _request.json              # Claude writes commands here
├── data-viz/
│   └── App.jsx
└── checkout-flow/
    └── App.jsx
```

### Starting the Server

```bash
cd skills/browser-canvas && ./server.sh &
```

Wait for "Ready on http://localhost:9224" - server watches `/tmp/browser-canvas/` for changes.

### Creating a Canvas

Claude simply writes a file:

```jsx
// Write to: /tmp/browser-canvas/my-counter/App.jsx

function App() {
  const [count, setCount] = useState(0);
  return (
    <Card className="w-96 mx-auto mt-8">
      <CardHeader>
        <CardTitle>Counter Demo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-4xl font-bold text-center">{count}</p>
        <div className="flex gap-2 justify-center">
          <Button onClick={() => setCount(c => c - 1)}>-</Button>
          <Button onClick={() => setCount(c => c + 1)}>+</Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

Server detects new folder → opens browser tab → renders component.

### Updating a Canvas

Claude edits the file using the Edit tool - server hot-reloads automatically.

### Reading User Events

Components emit events via `window.canvasEmit()`. Server appends to `events.jsonl`:

```jsonl
{"timestamp":"2026-01-07T10:30:00Z","event":"submit","data":{"name":"John","email":"john@example.com"}}
{"timestamp":"2026-01-07T10:30:15Z","event":"clicked","data":{"buttonId":"save"}}
```

Claude reads this file to see what the user did.

### Requesting Screenshots

Claude writes a request file:

```json
// Write to: /tmp/browser-canvas/my-form/_request.json
{"action": "screenshot"}
```

Server captures screenshot → writes to `_screenshot.png` → deletes request file.
Claude reads the PNG to see the current state.

### Closing a Canvas

```json
// Write to: /tmp/browser-canvas/my-form/_request.json
{"action": "close"}
```

Server closes browser tab and cleans up.

---

## Event Handling

Components can emit events back to Claude:

```jsx
function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = () => {
    // This sends data back to Claude (appends to events.jsonl)
    window.canvasEmit("submit", { name, email });
  };

  return (
    <Card className="w-96">
      <CardHeader>Contact Form</CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Name"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <Input
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <Button onClick={handleSubmit}>Submit</Button>
      </CardContent>
    </Card>
  );
}
```

Claude reads events from the file:

```bash
# Claude reads: /tmp/browser-canvas/my-form/events.jsonl
{"timestamp":"2026-01-07T10:30:00Z","event":"submit","data":{"name":"John","email":"john@example.com"}}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Claude Code                                 │
│                                                                      │
│   Uses standard file tools:                                          │
│   - Write: Create /tmp/browser-canvas/my-app/App.jsx                │
│   - Edit:  Modify App.jsx (server hot-reloads)                      │
│   - Read:  Check events.jsonl for user interactions                 │
│   - Read:  View _screenshot.png                                      │
│                                                                      │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ File System (chokidar watches)
                                │
┌───────────────────────────────▼─────────────────────────────────────┐
│                     Canvas Server (Bun + Hono)                       │
│                                                                      │
│   File Watcher:                                                      │
│   - New folder created     → Open browser tab                       │
│   - App.jsx modified       → Hot-reload via WebSocket               │
│   - _request.json written  → Execute command (screenshot/close)     │
│                                                                      │
│   HTTP:  GET /              → Canvas HTML shell                     │
│          GET /canvas/:id    → Specific canvas instance              │
│          GET /health        → Health check                          │
│                                                                      │
│   WS:    /ws                → Server ↔ Browser only                 │
│                                                                      │
│   Writes:                                                            │
│   - events.jsonl           ← User interactions from browser         │
│   - _screenshot.png        ← Captured on request                    │
│   - server.json            ← Server state for Claude                │
│                                                                      │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ WebSocket (hot-reload + events)
                                │
┌───────────────────────────────▼─────────────────────────────────────┐
│                     Browser Tab (opens automatically)                │
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │  react-runner                                                │   │
│   │  - Executes JSX code from server                            │   │
│   │  - Pre-bundled scope (shadcn, Recharts, Lucide)             │   │
│   │  - Hot-reloads on file changes                              │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │  Event Bridge                                                │   │
│   │  - window.canvasEmit(event, data) → Server → events.jsonl   │   │
│   │  - html2canvas for screenshots → _screenshot.png            │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## File-Based Protocol

### Claude → Server (via filesystem)

| Action | Method |
|--------|--------|
| Create canvas | Write `App.jsx` to new folder |
| Update canvas | Edit `App.jsx` |
| Request screenshot | Write `{"action":"screenshot"}` to `_request.json` |
| Close canvas | Write `{"action":"close"}` to `_request.json` |
| List canvases | Read `server.json` |

### Server → Claude (via filesystem)

| Data | File |
|------|------|
| User events | `events.jsonl` (append-only) |
| Screenshots | `_screenshot.png` |
| Server state | `server.json` |

### Server ↔ Browser (WebSocket, internal)

```typescript
// Server → Browser
{ type: "reload", code: string }
{ type: "screenshot-request" }

// Browser → Server
{ type: "event", event: string, data: unknown }
{ type: "screenshot", dataUrl: string }
{ type: "error", message: string }
```

---

## Pre-bundled Components (Scope)

Everything Claude can use without imports:

### React Core
```typescript
React, useState, useEffect, useCallback, useMemo, useRef, useReducer
```

### shadcn/ui Components
```typescript
// Layout
Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle
Sheet, SheetTrigger, SheetContent
Tabs, TabsList, TabsTrigger, TabsContent
Accordion, AccordionItem, AccordionTrigger, AccordionContent

// Forms
Button, Input, Textarea, Label
Select, SelectTrigger, SelectValue, SelectContent, SelectItem
Checkbox, RadioGroup, RadioGroupItem
Switch, Slider
Form, FormField, FormItem, FormLabel, FormControl, FormMessage

// Data Display
Table, TableHeader, TableBody, TableRow, TableHead, TableCell
Badge, Avatar, AvatarImage, AvatarFallback
Progress, Skeleton

// Feedback
Alert, AlertTitle, AlertDescription
Toast, Toaster
Tooltip, TooltipTrigger, TooltipContent
```

### Charts (Recharts)
```typescript
LineChart, BarChart, PieChart, AreaChart, RadarChart
Line, Bar, Pie, Area, Radar
XAxis, YAxis, CartesianGrid, Tooltip, Legend
ResponsiveContainer, Cell
```

### Icons (Lucide)
```typescript
// All lucide-react icons available
Check, X, Plus, Minus, ChevronRight, ChevronDown,
Search, Settings, User, Mail, Phone, Calendar,
FileText, Folder, Download, Upload, Trash, Edit,
// ... hundreds more
```

### Utilities
```typescript
cn          // clsx + tailwind-merge for className
format      // date-fns format function
```

---

## File Structure

```
browser-canvas/
├── .claude-plugin/
│   └── marketplace.json         # Plugin metadata
├── src/
│   ├── server/
│   │   ├── index.ts             # Bun + Hono server entry
│   │   ├── watcher.ts           # File system watcher (chokidar)
│   │   ├── websocket.ts         # WebSocket handler (server ↔ browser)
│   │   └── canvas-manager.ts    # Canvas instance state
│   └── browser/
│       ├── index.html           # Canvas shell
│       ├── app.tsx              # React app with react-runner
│       ├── scope.ts             # Pre-bundled dependencies
│       ├── event-bridge.ts      # window.canvasEmit implementation
│       └── components/
│           └── ui/              # All shadcn components
├── skills/
│   └── canvas/
│       ├── SKILL.md             # Claude instructions
│       └── references/
│           ├── components.md    # Component reference
│           ├── charts.md        # Recharts examples
│           └── patterns.md      # Common patterns
├── templates/                   # Starter templates Claude can copy
│   ├── form.jsx                 # Form with validation
│   ├── chart.jsx                # Data visualization
│   ├── table.jsx                # Data table
│   └── dashboard.jsx            # Multi-widget layout
├── server.sh                    # Start server script
├── package.json
├── tsconfig.json
└── README.md

# Runtime directory (created by server)
/tmp/browser-canvas/
├── server.json                  # Server state
└── <canvas-name>/               # One folder per canvas
    ├── App.jsx                  # Component code (Claude writes)
    ├── events.jsonl             # User events (server writes)
    ├── _screenshot.png          # Screenshot (server writes)
    └── _request.json            # Commands (Claude writes)
```

---

## SKILL.md (Claude Instructions)

```markdown
# Browser Canvas Skill

Render interactive React UIs in a browser window using file operations.

## Setup

Start the server (run once per session):
\`\`\`bash
cd skills/browser-canvas && ./server.sh &
\`\`\`

Wait for "Ready on http://localhost:9224" message.

## Creating a Canvas

Write an App.jsx file to a new folder in /tmp/browser-canvas/:

\`\`\`jsx
// Write to: /tmp/browser-canvas/my-app/App.jsx

function App() {
  return (
    <Card className="w-96">
      <CardHeader>Hello World</CardHeader>
      <CardContent>
        <p>This renders in the browser!</p>
      </CardContent>
    </Card>
  );
}
\`\`\`

The server auto-detects the new folder and opens a browser tab.

## Updating a Canvas

Simply edit the App.jsx file - the browser hot-reloads automatically.

## Reading User Events

When users interact with the canvas, events are written to events.jsonl:

\`\`\`bash
# Read: /tmp/browser-canvas/my-app/events.jsonl
{"timestamp":"...","event":"submit","data":{"name":"John"}}
\`\`\`

## Taking Screenshots

Write a request file:
\`\`\`json
// Write to: /tmp/browser-canvas/my-app/_request.json
{"action": "screenshot"}
\`\`\`

Then read the resulting image:
\`\`\`bash
# Read: /tmp/browser-canvas/my-app/_screenshot.png
\`\`\`

## Closing a Canvas

\`\`\`json
// Write to: /tmp/browser-canvas/my-app/_request.json
{"action": "close"}
\`\`\`

## Available Components

All shadcn/ui components, Recharts charts, and Lucide icons are pre-loaded.
No import statements needed - just use them directly in JSX.

## Emitting Events

Components send data back via window.canvasEmit():

\`\`\`jsx
<Button onClick={() => window.canvasEmit('clicked', { buttonId: 1 })}>
  Click Me
</Button>
\`\`\`

Events appear in events.jsonl for Claude to read.

## Templates

Copy starter templates from skills/browser-canvas/templates/:
- form.jsx - Form with validation and submit
- chart.jsx - Data visualization dashboard
- table.jsx - Sortable/filterable data table
- dashboard.jsx - Multi-widget layout

## Common Patterns

### Data Visualization
\`\`\`jsx
function App() {
  const data = [
    { name: "Jan", value: 400 },
    { name: "Feb", value: 300 },
  ];
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="value" stroke="#8884d8" />
      </LineChart>
    </ResponsiveContainer>
  );
}
\`\`\`

### Form with Submit
\`\`\`jsx
function App() {
  const [value, setValue] = useState("");
  return (
    <Card>
      <CardContent className="space-y-4 pt-4">
        <Input value={value} onChange={e => setValue(e.target.value)} />
        <Button onClick={() => window.canvasEmit("submit", { value })}>
          Submit
        </Button>
      </CardContent>
    </Card>
  );
}
\`\`\`

### Data Table
\`\`\`jsx
function App() {
  const data = [{ id: 1, name: "Item", status: "Active" }];
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map(row => (
          <TableRow key={row.id}>
            <TableCell>{row.name}</TableCell>
            <TableCell><Badge>{row.status}</Badge></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
\`\`\`
```

---

## Dependency Management & Discovery

### Build Strategy

The browser client is **pre-built** at plugin install time, not runtime:

```
browser-canvas/
├── src/browser/
│   ├── scope.ts              # Defines what's available to react-runner
│   └── components/ui/        # shadcn components (source)
├── dist/                     # Built at install (gitignored)
│   ├── canvas.js             # Bundled browser app
│   ├── canvas.css            # Tailwind + component styles
│   └── scope-manifest.json   # Machine-readable component list
└── build.ts                  # Bun build script
```

**Build process** (runs on `npm install` or plugin install):
```bash
bun run build
# 1. Bundles src/browser/* → dist/canvas.js
# 2. Generates Tailwind CSS → dist/canvas.css
# 3. Extracts scope → dist/scope-manifest.json
```

### How Claude Knows What's Available

**Two sources of truth:**

1. **SKILL.md** - Human-readable instructions with examples
2. **references/components.md** - Full component API reference

The skill instructs Claude to check `references/components.md` for detailed props/usage:

```markdown
# references/components.md

## Button
\`\`\`jsx
<Button variant="default|destructive|outline|secondary|ghost|link" size="default|sm|lg|icon">
  Click me
</Button>
\`\`\`

## Card
\`\`\`jsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content</CardContent>
  <CardFooter>Footer</CardFooter>
</Card>
\`\`\`
... (all components documented)
```

### Where Components Live

**shadcn/ui components** are copied into the repo (not npm imports):

```
src/browser/components/ui/
├── button.tsx
├── card.tsx
├── input.tsx
├── table.tsx
└── ... (all shadcn components)
```

These are bundled into `scope.ts`:

```typescript
// src/browser/scope.ts
import { Button } from "./components/ui/button";
import { Card, CardHeader, CardContent } from "./components/ui/card";
// ...

export const scope = {
  // React
  React,
  useState, useEffect, useCallback, useMemo, useRef,

  // shadcn/ui
  Button, Card, CardHeader, CardContent, CardTitle, CardFooter,
  Input, Label, Textarea,
  // ... all components

  // Charts
  LineChart, BarChart, PieChart, // from recharts

  // Icons
  ...lucideIcons,

  // Utilities
  cn,  // classnames helper
};
```

react-runner receives this scope and makes all exports available without imports:

```jsx
// Claude writes this - no imports needed
function App() {
  return <Button variant="outline">Click</Button>;
}
```

### Template System

Templates live in the repo and Claude copies them to canvas folders:

```
browser-canvas/
└── templates/
    ├── form.jsx          # Multi-field form with validation
    ├── chart.jsx         # Recharts dashboard
    ├── table.jsx         # Data table with sorting
    └── dashboard.jsx     # Multi-widget layout
```

**Claude's workflow:**
```bash
# 1. Read template
Read: /path/to/browser-canvas/templates/form.jsx

# 2. Copy and modify for canvas
Write: /tmp/browser-canvas/contact-form/App.jsx
(paste template content, modify as needed)
```

Templates include comments explaining customization points:

```jsx
// templates/form.jsx
function App() {
  // CUSTOMIZE: Define your form fields
  const [formData, setFormData] = useState({
    name: "",
    email: "",
  });

  // CUSTOMIZE: Add validation rules
  const validate = () => { /* ... */ };

  const handleSubmit = () => {
    if (validate()) {
      window.canvasEmit("submit", formData);
    }
  };

  return (
    <Card className="w-96">
      {/* CUSTOMIZE: Add/remove fields as needed */}
      <CardContent className="space-y-4">
        <Input
          placeholder="Name"
          value={formData.name}
          onChange={e => setFormData({...formData, name: e.target.value})}
        />
        {/* ... */}
      </CardContent>
    </Card>
  );
}
```

### Adding New Components

To add a new shadcn component:

```bash
# 1. Copy from shadcn (or write custom)
cp ~/.../button.tsx src/browser/components/ui/

# 2. Add to scope.ts
export const scope = {
  // ...existing
  NewComponent,
};

# 3. Document in references/components.md

# 4. Rebuild
bun run build
```

---

## Implementation Phases

### Phase 1: Core Infrastructure
1. Server setup (Bun + Hono)
2. File watcher (chokidar) for /tmp/browser-canvas/
3. Browser shell with react-runner
4. Basic component scope (React + a few shadcn components)
5. WebSocket for server ↔ browser communication

### Phase 2: Full Component Library
6. Bundle all shadcn/ui components
7. Add Recharts
8. Add Lucide icons
9. Add utilities (cn, format)

### Phase 3: Events & Screenshots
10. Event bridge (browser → server → events.jsonl)
11. Screenshot capture (html2canvas → _screenshot.png)
12. Request file handling (_request.json)

### Phase 4: Skill & Docs
13. SKILL.md with full instructions
14. Component reference docs
15. Starter templates
16. README

---

## Key Design Decisions

### Why file-based interaction?

- **Native to Claude**: Write/Edit/Read tools are already optimized
- **No custom API**: No client library to learn or maintain
- **Inspectable**: Files are human-readable, easy to debug
- **Persistent**: Code survives script crashes, can be resumed
- **Simple**: No WebSocket client code needed from Claude's side

### Why react-runner over Sandpack?

- **Speed**: No bundling latency
- **Control**: Exact scope control
- **Simplicity**: Single execution model
- **Size**: Smaller bundle

### Why shadcn/ui?

- **AI-optimized**: Designed for LLM generation
- **Training data**: Maximum Claude familiarity
- **Tailwind**: Consistent styling
- **Copy-paste**: Components are local files

### Why /tmp/browser-canvas/?

- **Convention**: Standard temp location, auto-cleaned
- **Isolation**: Separate from project files
- **Permissions**: No special access needed
- **Discoverability**: Predictable location for Claude

---

## Security

1. **Localhost only**: Server binds to 127.0.0.1
2. **iframe sandbox**: Code runs in sandboxed iframe
3. **CSP**: Restrict network access
4. **Event validation**: Server validates event structure
5. **File isolation**: Canvas files in /tmp, separate from project
6. **Watched paths only**: Server only watches /tmp/browser-canvas/

---

## Repository

New standalone repo: `browser-canvas`

Installation:
```bash
/plugin marketplace add <user>/browser-canvas
/plugin install canvas@browser-canvas
```

---

## Related Research

- [Claude Canvas (TUI version)](/research/claude-canvas-research.md)
- [Artifacts Implementation](/research/artifacts-implementation-research.md)
- [LLM UI Frameworks](/research/llm-ui-frameworks-research.md)
