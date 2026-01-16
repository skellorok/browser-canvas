export default function App() {
  // Intentional errors for testing:
  // 1. undefined variable reference
  // 2. invalid Tailwind class
  const foo = undefinedVariable

  return (
    <div className="invalid-tailwind-class-xyz bg-red-500">
      <h1>Hook Test</h1>
      <p>{foo}</p>
    </div>
  )
}
