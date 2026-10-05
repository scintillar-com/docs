# registry-shell

Monorepo for [`@sntlr/docs-shell`](packages/docs-shell/README.md), the documentation engine, and [`@sntlr/registry-shell`](packages/registry-shell/README.md), its preset for component registries. Both are published together at the same version.

| Path | What |
|-|-|
| `packages/docs-shell` | The engine (CLI, Next app, adapters, optional registry module). Its [README](packages/docs-shell/README.md) is the user documentation. |
| `packages/registry-shell` | The preset for registries: the `registry-shell` bin, a re-export of `defineConfig`, and `shell/*` re-export stubs (generated on `prepack`). No build step. |
| `fixtures/dev-registry` | A registry used for local development and the theme-panel Playwright suite (`pnpm dev:registry`). |
| `fixtures/docs-basic` | A docs-only site (no components), with a `<slug>.<locale>.mdx` translation. Used by `pnpm test:docs`. |
| `fixtures/versioned-registry` | The fixture the versioned-build unit tests tag in a temporary git repo. |

Each buildable fixture has a `routes.txt`: the pages its static build must produce (`pnpm test:fixtures`, `--update` to rewrite them).

## Development

```bash
pnpm install
pnpm build        # compile the CLI (packages/docs-shell/dist)
pnpm lint
pnpm typecheck
pnpm test         # unit tests
pnpm test:theme-panel
pnpm test:docs     # docs-only site end to end (static export, desktop + phone)
pnpm test:fixtures # build each fixture and compare its pages with routes.txt
pnpm dev:registry  # run the shell against fixtures/dev-registry
```

## Releasing

```bash
pnpm release patch|minor|major   # bumps packages/*, commits "X.Y.Z", tags vX.Y.Z
git push origin main --follow-tags
```

The `v*` tag triggers `.github/workflows/publish.yml`, which runs the checks, verifies the tag matches the package version and publishes to npm with provenance.
