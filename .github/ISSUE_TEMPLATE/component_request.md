---
name: Component Request
about: Request a new component be added to the scope
title: 'Component: '
labels: component
assignees: ''
---

## Component

What component or library would you like added?

- **Name**: [e.g., Calendar, DatePicker, react-markdown]
- **Source**: [e.g., shadcn/ui, npm package, custom]

## Use case

What would you use this component for? Example:

> I want Claude to build scheduling interfaces, but there's no calendar component available.

## Example usage

How would you expect to use it in App.jsx?

```jsx
function App() {
  return (
    <Calendar
      selected={date}
      onSelect={setDate}
    />
  )
}
```

## Complexity

- [ ] Simple - single component, no dependencies
- [ ] Medium - component with a few sub-components
- [ ] Complex - requires new npm package or significant work
