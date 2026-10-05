#!/usr/bin/env node
// `registry-shell` runs the @sntlr/docs-shell CLI under its historical name:
// same commands, same config (registry-shell.config.ts), and `init`
// scaffolds a registry config. The registry module turns on automatically
// for a project with components or blocks.
process.env.SHELL_CLI_NAME = "registry-shell"
await import("@sntlr/docs-shell/cli")
