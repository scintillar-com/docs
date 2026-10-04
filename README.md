# registry-shell

Monorepo for [`@sntlr/registry-shell`](packages/registry-shell/README.md), the Next.js viewer for component registries.

| Path | What |
|-|-|
| `packages/registry-shell` | The published package (CLI, Next app, adapters). Its [README](packages/registry-shell/README.md) is the user documentation. |
| `fixtures/dev-registry` | A registry used for local development and the theme-panel Playwright suite (`pnpm dev:registry`). |
| `fixtures/versioned-registry` | The fixture the versioned-build unit tests tag in a temporary git repo. |

## Development

```bash
pnpm install
pnpm build        # compile the CLI (packages/registry-shell/dist)
pnpm lint
pnpm typecheck
pnpm test         # unit tests
pnpm test:theme-panel
pnpm dev:registry # run the shell against fixtures/dev-registry
```

## Releasing

```bash
pnpm release patch|minor|major   # bumps packages/*, commits "X.Y.Z", tags vX.Y.Z
git push origin main --follow-tags
```

The `v*` tag triggers `.github/workflows/publish.yml`, which runs the checks, verifies the tag matches the package version and publishes to npm with provenance.
