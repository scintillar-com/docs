"use client"

import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { Button } from "@shell/components/shell-ui/button"
import { ThemePanel } from "@shell/components/theme-panel"
import { getShellThemePanel, type ResolvedThemePanelConfig } from "@shell/lib/theme-panel"

// Build-time constant: null unless the registry config sets `themePanel`
// (and, on versioned builds, the version is >= `themePanel.since`).
const SHELL_THEME_PANEL = getShellThemePanel()

/**
 * Header theme control. Without `themePanel` in the registry config it is
 * the plain sun/moon toggle; with it, the same button opens the theme panel.
 * `panel` is injectable for tests.
 */
export function ThemeToggle({
  panel = SHELL_THEME_PANEL,
}: { panel?: ResolvedThemePanelConfig | null } = {}) {
  if (panel) return <ThemePanel config={panel} />
  return <PlainThemeToggle />
}

function PlainThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      <Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
    </Button>
  )
}
