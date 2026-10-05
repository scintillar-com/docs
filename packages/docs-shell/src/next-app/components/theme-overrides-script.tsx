import type { ThemePanelControl } from "@shell/lib/theme-panel"
import { themeOverridesInitScript } from "@shell/lib/theme-overrides"

/**
 * Applies the theme panel's saved overrides (`--primary`, `--surface-tint`)
 * before first paint, so reloads don't flash the default colors. Rendered by
 * the (shell) and (preview) root layouts only when the panel is enabled.
 */
export function ThemeOverridesScript({ controls }: { controls: readonly ThemePanelControl[] }) {
  return (
    <script
      // Static, config-derived string; no user input is interpolated.
      dangerouslySetInnerHTML={{ __html: themeOverridesInitScript(controls) }}
    />
  )
}
