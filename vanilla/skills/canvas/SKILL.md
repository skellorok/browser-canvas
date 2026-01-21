# Vanilla Canvas Skill

Build interactive UIs with vanilla JavaScript, semantic HTML, and pure CSS. No frameworks. No build step.

## Philosophy

- **Vanilla JS** - Modern JavaScript (ESM, async/await, fetch), no TypeScript
- **Native HTML** - Use `<select>`, `<input type="date">`, `<dialog>`, `<details>` over JS equivalents
- **Semantic HTML** - Structure with `<main>`, `<nav>`, `<header>`, `<footer>`, `<article>`, `<section>`
- **Pure CSS** - Variables, modern features, meaningful class names. No Tailwind.
- **No build step** - Files served directly. Import maps for libraries.

## Creating a Canvas

Write an `index.html` file to `.claude/artifacts/<canvas-id>/`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/base.css">
  <style>
    /* Canvas-specific styles using CSS variables */
    .dashboard {
      display: grid;
      gap: var(--space-4);
      padding: var(--space-6);
    }
  </style>
</head>
<body>
  <main class="dashboard">
    <article class="card">
      <header class="card-header">
        <h2>My Dashboard</h2>
      </header>
      <div class="card-body">
        <p>Content here</p>
      </div>
    </article>
  </main>

  <script type="module">
    // Your JavaScript here
  </script>
</body>
</html>
```

## File Protocol

| File | Purpose |
|------|---------|
| `index.html` | Your canvas (HTML + CSS + JS) |
| `_state.json` | Two-way state sync |
| `_log.jsonl` | Events and errors |
| `_screenshot.png` | Screenshot output |

## State Sync

```javascript
// Read state
const state = await window.canvasState()

// Update state (writes to _state.json, notifies server)
await window.canvasState({ ...state, count: state.count + 1 })

// Listen for external state changes
window.addEventListener("canvas-state-change", (e) => {
  console.log("State changed:", e.detail)
})
```

## Emitting Events

```javascript
// Emit event (written to _log.jsonl)
window.canvasEmit("button-clicked", { id: "submit" })
window.canvasEmit("form-submitted", { name: "John", email: "john@example.com" })
```

## Native HTML Patterns

### Dialog (Modal)

```html
<dialog id="confirm-dialog">
  <form method="dialog">
    <h3>Confirm Action</h3>
    <p>Are you sure you want to proceed?</p>
    <footer class="flex gap-2" style="margin-top: var(--space-4)">
      <button value="cancel" class="secondary">Cancel</button>
      <button value="confirm">Confirm</button>
    </footer>
  </form>
</dialog>

<script type="module">
  const dialog = document.getElementById("confirm-dialog")

  // Show dialog
  dialog.showModal()

  // Handle result
  dialog.addEventListener("close", () => {
    if (dialog.returnValue === "confirm") {
      // User confirmed
    }
  })
</script>
```

### Accordion

```html
<details>
  <summary>Click to expand</summary>
  <p>Hidden content revealed when expanded.</p>
</details>

<!-- Multiple items -->
<details name="accordion">
  <summary>Section 1</summary>
  <p>Content 1</p>
</details>
<details name="accordion">
  <summary>Section 2</summary>
  <p>Content 2</p>
</details>
```

### Tabs

```html
<div class="tabs" role="tablist">
  <button role="tab" aria-selected="true" data-tab="tab1">Tab 1</button>
  <button role="tab" data-tab="tab2">Tab 2</button>
</div>

<div id="tab1" role="tabpanel">Content 1</div>
<div id="tab2" role="tabpanel" hidden>Content 2</div>

<script type="module">
  document.querySelectorAll("[role=tab]").forEach(tab => {
    tab.addEventListener("click", () => {
      // Update aria-selected
      document.querySelectorAll("[role=tab]").forEach(t => {
        t.setAttribute("aria-selected", t === tab)
      })
      // Show/hide panels
      document.querySelectorAll("[role=tabpanel]").forEach(panel => {
        panel.hidden = panel.id !== tab.dataset.tab
      })
    })
  })
</script>
```

### Date Picker

```html
<label for="date">Select date</label>
<input type="date" id="date" min="2024-01-01" max="2025-12-31">
```

### Select (Dropdown)

```html
<label for="country">Country</label>
<select id="country">
  <option value="">Select a country</option>
  <option value="us">United States</option>
  <option value="uk">United Kingdom</option>
  <option value="ca">Canada</option>
</select>
```

## Using External Libraries

Use import maps for charting, mapping, or SQLite:

```html
<script type="importmap">
{
  "imports": {
    "chart.js": "https://cdn.jsdelivr.net/npm/chart.js@4/+esm",
    "chart.js/auto": "https://cdn.jsdelivr.net/npm/chart.js@4/auto/+esm"
  }
}
</script>

<canvas id="chart"></canvas>

<script type="module">
  import Chart from "chart.js/auto"

  new Chart(document.getElementById("chart"), {
    type: "bar",
    data: {
      labels: ["Jan", "Feb", "Mar"],
      datasets: [{
        label: "Sales",
        data: [100, 150, 200]
      }]
    }
  })
</script>
```

## CSS Variables (from base.css)

```css
/* Colors */
--color-bg, --color-fg, --color-muted, --color-primary
--color-border, --color-input, --color-danger, --color-success

/* Spacing */
--space-1 (0.25rem), --space-2 (0.5rem), --space-3 (0.75rem)
--space-4 (1rem), --space-6 (1.5rem), --space-8 (2rem)

/* Radii */
--radius-sm (0.25rem), --radius (0.375rem), --radius-lg (0.5rem)

/* Shadows */
--shadow-sm, --shadow, --shadow-lg

/* Typography */
--font-sans, --font-mono
--text-xs, --text-sm, --text-base, --text-lg, --text-xl, --text-2xl
```

## Utility Classes (from base.css)

```css
.container    /* max-width centered container */
.card         /* bordered card with shadow */
.card-header  /* card header with border */
.card-body    /* card content area */
.card-footer  /* card footer with background */

.flex, .flex-col, .items-center, .justify-between
.gap-2, .gap-4
.text-sm, .text-muted, .font-medium, .font-bold
.sr-only      /* screen reader only */
```

## Button Variants

```html
<button>Primary</button>
<button class="secondary">Secondary</button>
<button class="danger">Danger</button>
<button class="ghost">Ghost</button>
```

## Form Example

```html
<form id="signup-form">
  <div style="display: grid; gap: var(--space-4);">
    <div>
      <label for="name">Name</label>
      <input type="text" id="name" required>
    </div>
    <div>
      <label for="email">Email</label>
      <input type="email" id="email" required>
    </div>
    <div>
      <label for="plan">Plan</label>
      <select id="plan" required>
        <option value="">Select a plan</option>
        <option value="free">Free</option>
        <option value="pro">Pro ($9/mo)</option>
      </select>
    </div>
    <div>
      <label for="start">Start Date</label>
      <input type="date" id="start">
    </div>
    <button type="submit">Sign Up</button>
  </div>
</form>

<script type="module">
  document.getElementById("signup-form").addEventListener("submit", (e) => {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(e.target))
    window.canvasEmit("signup", data)
  })
</script>
```

## Data Table

```html
<table>
  <thead>
    <tr>
      <th>Name</th>
      <th>Email</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody id="users-table">
    <!-- Rows inserted by JS -->
  </tbody>
</table>

<script type="module">
  const users = [
    { name: "Alice", email: "alice@example.com", status: "Active" },
    { name: "Bob", email: "bob@example.com", status: "Pending" }
  ]

  document.getElementById("users-table").innerHTML = users.map(u => `
    <tr>
      <td>${u.name}</td>
      <td>${u.email}</td>
      <td>${u.status}</td>
    </tr>
  `).join("")
</script>
```

## CanvasClient API (for operations)

```javascript
import { CanvasClient } from "./vanilla/client.js"

const client = await CanvasClient.fromServerJson()
await client.screenshot("my-app")     // Take screenshot
await client.close("my-app")          // Close canvas
await client.getState("my-app")       // Read state
await client.setState("my-app", {...}) // Write state
await client.list()                   // List all canvases
```

## Starting the Server

```bash
cd tools/browser-canvas/vanilla
bun server.js
```

Server runs on port 3210 by default. Open http://localhost:3210 in browser.
