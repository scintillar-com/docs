import type { NextConfig } from "next"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const USER_ROOT = process.env.USER_REGISTRY_ROOT

/**
 * Resolve a virtual `@user/*` alias to the user's file when it exists, else
 * to a shell-bundled fallback under `fallback/`. Called once at Next boot.
 */
function toPosix(p: string): string {
  // Turbopack on Windows rejects backslash absolute paths.
  return p.replace(/\\/g, "/")
}

/** Common ancestor directory of two absolute paths. */
function findCommonRoot(a: string, b: string): string {
  const pa = path.resolve(a).split(path.sep)
  const pb = path.resolve(b).split(path.sep)
  const common: string[] = []
  for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
    if (pa[i] !== pb[i]) break
    common.push(pa[i])
  }
  return common.join(path.sep) || path.sep
}

function resolveUserModule(relativePath: string, fallback: string): string {
  if (USER_ROOT) {
    // Try a few extensions since users may write .ts or .tsx.
    const candidates = [relativePath, `${relativePath}.ts`, `${relativePath}.tsx`]
    for (const c of candidates) {
      const abs = path.isAbsolute(c) ? c : path.join(USER_ROOT, c)
      if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return toPosix(abs)
      const indexTs = path.join(abs, "index.ts")
      if (fs.existsSync(indexTs)) return toPosix(indexTs)
      const indexTsx = path.join(abs, "index.tsx")
      if (fs.existsSync(indexTsx)) return toPosix(indexTsx)
    }
  }
  return toPosix(path.join(HERE, fallback))
}

const USER_PREVIEWS = resolveUserModule("components/previews", "fallback/previews.ts")

// Set only for frozen snapshots of the versioned build (`/v/<version>`).
// Absent for regular builds, so their output is unchanged.
const BASE_PATH = process.env.NEXT_PUBLIC_SHELL_BASE_PATH || undefined

// Optional modules the CLI enabled for this site (comma-separated, e.g.
// "registry"). A module's routes are named `page.<module>.tsx` /
// `layout.<module>.tsx`; Next only treats them as routes when their
// extension is listed in `pageExtensions`, so a disabled module's routes are
// never compiled (a docs-only site has no /components or /preview pages,
// which static export would otherwise reject for having no params).
const MODULES = (process.env.SHELL_MODULES ?? "").split(",").filter(Boolean)
const PAGE_EXTENSIONS = [...MODULES.map((m) => `${m}.tsx`), "tsx", "ts", "jsx", "js"]

const nextConfig: NextConfig = {
  ...(BASE_PATH ? { basePath: BASE_PATH } : {}),

  pageExtensions: PAGE_EXTENSIONS,

  // Static export (Storybook model) — the shell produces a pure static
  // HTML/JS/CSS tree under `out/`, deployable to any static host (Vercel,
  // Netlify, S3, GitHub Pages). No serverless functions, no runtime file
  // tracing, no pnpm symlink hazards. Dev mode (`next dev`) still runs
  // normally; export only affects `next build`.
  output: "export",

  // `next/image` runtime optimization requires a server. Disable for
  // static export — images are served as-is from `public/`.
  images: { unoptimized: true },

  // URLs end with `/` (e.g. `/components/button/`). Makes static hosts
  // serve `components/button/index.html` correctly.
  trailingSlash: true,

  // When installed as an external package (link:../registry-shell, npm, etc.),
  // the shell's TSX lives under the user's node_modules and Next won't
  // transpile it by default. The registry can list additional packages via
  // `transpilePackages` in its config (CLI forwards as USER_TRANSPILE_PACKAGES).
  transpilePackages: [
    "@sntlr/registry-shell",
    ...(process.env.USER_TRANSPILE_PACKAGES
      ? process.env.USER_TRANSPILE_PACKAGES.split(",").filter(Boolean)
      : []),
  ],

  // `next-mdx-remote/rsc` evals MDX via `new Function(...)` with an injected
  // jsxRuntime loaded from `react/jsx-dev-runtime`. In dev mode React 19.2's
  // dev runtime reads `ReactSharedInternals.recentlyCreatedOwnerStacks`, and
  // that Internals object lives on the user's React copy, not Next's vendored
  // RSC React. Bundling next-mdx-remote through Next's RSC webpack graph
  // crosses that boundary and crashes: "Cannot read properties of undefined
  // (reading 'recentlyCreatedOwnerStacks')". Marking the package as
  // server-external keeps it on Node's normal require chain, so the React it
  // loads matches the one Next's RSC runtime hands it.
  serverExternalPackages: ["next-mdx-remote"],

  // Turbopack root: walk up until we find a dir that contains both the shell
  // package and the user's project. For a pnpm workspace setup that's the
  // workspace root. Falls back to process.cwd() (which is the user's project
  // when run via `registry-shell dev`).
  turbopack: {
    root: process.env.TURBOPACK_ROOT
      ? toPosix(process.env.TURBOPACK_ROOT)
      : toPosix(findCommonRoot(HERE, USER_ROOT ?? process.cwd())),
    resolveAlias: {
      "@user/previews": USER_PREVIEWS,
    },
  },

  webpack: (config) => {
    config.resolve = config.resolve ?? {}
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@user/previews": USER_PREVIEWS,
      // Shell's internal alias — its own files.
      "@shell": toPosix(HERE),
      // shadcn convention: the registry's component files use `@/` for their
      // own project root. Registry sites only; a docs-only site has no such
      // files and keeps `@` free.
      ...(USER_ROOT && MODULES.includes("registry") ? { "@": toPosix(USER_ROOT) } : {}),
    }
    return config
  },
}

export default nextConfig
