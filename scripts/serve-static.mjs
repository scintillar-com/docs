#!/usr/bin/env node
/**
 * Minimal static file server for a fixture's `out/` folder, used by the
 * Playwright suites that test the static export (what sites deploy).
 *
 *   node scripts/serve-static.mjs <dir> <port>
 */
import fs from "node:fs"
import http from "node:http"
import path from "node:path"

const [dirArg, portArg] = process.argv.slice(2)
const root = path.resolve(dirArg ?? "out")
const port = Number(portArg ?? 3120)
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
  ".woff2": "font/woff2",
}

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0])
    const target = path.join(root, urlPath)
    // Stay inside the served folder.
    if (!target.startsWith(root)) {
      res.writeHead(403).end()
      return
    }
    const file = [target, `${target}.html`, path.join(target, "index.html")].find(
      (f) => fs.existsSync(f) && fs.statSync(f).isFile(),
    )
    if (!file) {
      const notFound = path.join(root, "404.html")
      res.writeHead(404, { "content-type": TYPES[".html"] })
      res.end(fs.existsSync(notFound) ? fs.readFileSync(notFound) : "Not found")
      return
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" })
    if (req.method === "HEAD") res.end()
    else fs.createReadStream(file).pipe(res)
  })
  .listen(port, () => console.log(`serve-static: ${root} on http://localhost:${port}`))
