/**
 * Which binary is running. `@sntlr/registry-shell`'s `registry-shell` bin
 * sets SHELL_CLI_NAME before loading this CLI; run directly, it's
 * `docs-shell`. Only affects naming (usage text, what `init` scaffolds), not
 * behaviour: both read either config file name.
 */
export type CliName = "docs-shell" | "registry-shell"

export const CLI_NAME: CliName =
  process.env.SHELL_CLI_NAME === "registry-shell" ? "registry-shell" : "docs-shell"
