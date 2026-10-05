/**
 * Client-safe accessor for the locale list the shell should offer in its
 * toggle. Populated by the CLI via NEXT_PUBLIC_SHELL_LOCALES (comma-sep).
 * Empty in single-locale mode — the locale toggle hides itself.
 */
export function getShellLocales(): string[] {
  const raw = process.env.NEXT_PUBLIC_SHELL_LOCALES
  if (!raw) return []
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

export function getShellDefaultLocale(): string {
  return process.env.NEXT_PUBLIC_SHELL_DEFAULT_LOCALE ?? ""
}
