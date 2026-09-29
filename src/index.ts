/**
 * @sntlr/registry-shell — public API.
 *
 * Registry builders import `defineConfig` from here into their
 * `registry-shell.config.ts`. Custom-adapter authors also import
 * `ResolvedShellConfig` to type their factory's argument.
 */
export { defineConfig } from "./define-config.js"
export type {
  ShellConfig,
  BrandingConfig,
  GithubConfig,
  ShellPaths,
  CustomAdapterSpec,
  ThemePanelConfig,
  ThemePanelControl,
} from "./define-config.js"
export type { ResolvedShellConfig } from "./config-loader.js"
export type { AdapterOverrides } from "./adapter/custom.js"
