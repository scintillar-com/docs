# @sntlr/registry-shell

A Next.js viewer for shadcn-style component registries: drop a `registry-shell.config.ts` into your registry and get a full site with documentation, component pages, live previews with controls, install commands, versioned docs and a theme panel.

`@sntlr/registry-shell` is now a preset of [`@sntlr/docs-shell`](https://www.npmjs.com/package/@sntlr/docs-shell), the documentation engine it was split from. Nothing changes for existing registries: same `registry-shell` command, same config file and options, same `@sntlr/registry-shell/shell/*` imports in your previews. The registry part of the shell turns on automatically when your project has components or blocks.

## Quickstart

```bash
pnpm add -D @sntlr/registry-shell
npx registry-shell init     # writes registry-shell.config.ts and adds scripts
pnpm shell                  # dev server
pnpm shell:build            # static export in ./out
```

## Documentation

Configuration, previews and controls, versioned docs, the theme panel, custom adapters and deployment are documented in the [@sntlr/docs-shell README](https://github.com/scintillar-com/docs/tree/main/packages/docs-shell#readme). Every option there applies here.

For a documentation site without components, use `@sntlr/docs-shell` directly (`docs-shell` command, `docs-shell.config.ts`).

## License

MIT
