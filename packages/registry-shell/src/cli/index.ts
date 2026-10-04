#!/usr/bin/env node
/**
 * @sntlr/registry-shell CLI entry.
 *
 * Commands:
 *   init    Scaffold registry-shell.config.ts and add scripts to package.json.
 *   dev     Run `next dev` for local iteration on the registry.
 *   build   Produce a static export in `<user-project>/out/` (Storybook-style).
 *
 * `start` was removed in v2.0.0 — `next build` now produces a static site,
 * so there's no server to "start". Serve `out/` with any static host
 * (`npx serve out`, Vercel, Netlify, S3, etc.).
 */

const USAGE = `Usage: registry-shell <command> [args]

Commands:
  init            Scaffold registry-shell.config.ts in the current project.
  dev             Start the shell in dev mode on http://localhost:3000.
  build           Produce a static export in ./out (deploy anywhere).
`

async function main() {
  const [, , cmd, ...args] = process.argv

  if (!cmd || cmd === "--help" || cmd === "-h") {
    console.log(USAGE)
    process.exit(0)
  }

  switch (cmd) {
    case "init":
      await (await import("./init.js")).run(args)
      break
    case "dev":
      await (await import("./dev.js")).run(args)
      break
    case "build":
      await (await import("./build.js")).run(args)
      break
    case "start":
      console.error(
        "[registry-shell] `start` was removed in v2.0.0. `build` now produces a static site — serve `./out` with any static host (e.g. `npx serve out`).",
      )
      process.exit(1)
    default:
      console.error(`Unknown command: ${cmd}\n`)
      console.log(USAGE)
      process.exit(1)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
