# Contributing to Browser Canvas

Thanks for your interest in contributing! This document covers how to get started.

## Quick Links

- [Report a Bug](.github/ISSUE_TEMPLATE/bug_report.md)
- [Request a Feature](.github/ISSUE_TEMPLATE/feature_request.md)
- [Request a Component](.github/ISSUE_TEMPLATE/component_request.md)

## Development Setup

```bash
# Clone the repo
git clone https://github.com/parkerhancock/browser-canvas.git
cd browser-canvas

# Install dependencies
bun install

# Start development server
bun run dev
```

The dev server watches for changes and rebuilds automatically.

## Project Structure

```
browser-canvas/
├── src/
│   ├── server/           # Bun + Hono server
│   │   ├── index.ts      # Entry point
│   │   ├── watcher.ts    # File system watcher
│   │   └── ...
│   └── browser/          # React frontend
│       ├── app.tsx       # Main app
│       ├── scope.ts      # Pre-bundled dependencies
│       └── components/ui/# shadcn components
├── skills/canvas/        # Claude Code skill
│   ├── SKILL.md          # Skill instructions
│   ├── components/       # Reusable components
│   └── references/       # Component docs
└── dist/                 # Built output (gitignored)
```

## Ways to Contribute

### Bug Reports

Found something broken? [Open a bug report](https://github.com/parkerhancock/browser-canvas/issues/new?template=bug_report.md).

Include:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Your environment (OS, Bun version)

### Feature Requests

Have an idea? [Open a feature request](https://github.com/parkerhancock/browser-canvas/issues/new?template=feature_request.md).

### Component Requests

Want a new component added to the scope? [Request it here](https://github.com/parkerhancock/browser-canvas/issues/new?template=component_request.md).

### Code Contributions

1. Fork the repo
2. Create a branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run type checking (`bun run typecheck`)
5. Test manually (see below)
6. Commit with a clear message
7. Push and open a PR

## Adding Components

### shadcn/ui Components

To add a new shadcn component:

1. Copy the component to `src/browser/components/ui/`
2. Export it from `src/browser/scope.ts`
3. Document it in `skills/canvas/references/components.md`
4. Rebuild: `bun run build`

### Reusable Components

To add a reusable component that ships with the package:

1. Create `skills/canvas/components/MyComponent.jsx`
2. Use this format:

```jsx
/**
 * MyComponent - Brief description
 * @prop {string} title - What it does
 * @prop {function} onClick - Callback description
 */
function MyComponent({ title, onClick }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
    </Card>
  )
}
```

Components are auto-loaded at runtime. No imports needed.

## Testing

No automated tests yet. Manual testing:

1. Start the server: `./server.sh`
2. Write a test canvas:
   ```bash
   mkdir -p .claude/artifacts/test
   echo 'function App() { return <Button>Test</Button> }' > .claude/artifacts/test/App.jsx
   ```
3. Verify the browser opens and renders
4. Edit the file and verify hot reload works
5. Test screenshots:
   ```bash
   echo '{"action":"screenshot"}' > .claude/artifacts/test/_request.json
   ```

## Code Style

- TypeScript for server code
- JSX/TSX for browser code
- Tailwind for styling
- No semicolons
- 2-space indentation

No linter configured yet—just match existing code style.

## Questions?

Open an issue or start a discussion. We're happy to help!
