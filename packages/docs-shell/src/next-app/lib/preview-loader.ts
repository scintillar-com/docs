/**
 * Client-safe preview loader. Re-exports the user's `previewLoader` from
 * `@user/previews` — a webpack/turbopack alias resolved at Next.js startup
 * from `USER_REGISTRY_ROOT`. When the user has no previews file the alias
 * falls back to a shell-bundled empty loader (see next-app/fallback/previews.ts).
 */
export { previewLoader } from "@user/previews"
