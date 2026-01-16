const markdown = `
# Project Documentation

Welcome to the **MarkdownViewer** component demo.

## Features

This component provides:

- Beautiful typography with refined spacing
- Support for **bold** and *italic* text
- Code blocks with syntax highlighting styling
- Lists, tables, and blockquotes

### Code Example

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`
}
\`\`\`

You can also use \`inline code\` in your text.

> This is a blockquote. It adds visual emphasis to quoted content.

## Tables

| Feature | Status |
|---------|--------|
| Headers | Done |
| Lists | Done |
| Code | Done |
| Tables | Done |

---

*Built with react-markdown and Tailwind CSS*
`

function App() {
  return (
    <MarkdownViewer
      content={markdown}
      title="Documentation"
      variant="default"
    />
  )
}
