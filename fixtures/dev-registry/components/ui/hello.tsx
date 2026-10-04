/** A minimal test component used by the Playwright smoke suite. */
export function Hello({ name = "world" }: { name?: string }) {
  return <span data-testid="hello">Hello, {name}!</span>
}
