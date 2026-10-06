/**
 * Entry preloaded with `node --import` into `next dev` by `registry-shell dev`
 * (see dev.ts). Installs atomic writes for Next's `.next/*-manifest.json`
 * files; the why is in next-manifest-writes.ts. Set
 * REGISTRY_SHELL_ATOMIC_MANIFESTS=0 to turn it off.
 */
import { installAtomicManifestWrites } from "./next-manifest-writes.js"

if (process.env.REGISTRY_SHELL_ATOMIC_MANIFESTS !== "0") {
  installAtomicManifestWrites()
}
