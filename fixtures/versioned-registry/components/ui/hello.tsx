/** Fixture component; its text changes between tags. */
export function Hello({ name = "world" }: { name?: string }) {
  return <span>Hello, {name}!</span>
}
