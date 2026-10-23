#!/usr/bin/env node
/* ==========================================================================
   Dynanca — local preview server (static files + the project's real headers)
   -------------------------------------------------------------------------
   Serves the project root exactly as a static host would, and sends the
   response headers declared in the `/*` block of `_headers` (including the
   real Content-Security-Policy) on every response. Opening the site through
   `file://` or a server that ignores `_headers` does NOT exercise the CSP,
   so previews and the browser test-suite both use this server.

   Usage:
     node tools/dev-server/serve.js [--port 8788] [--root <dir>]
     npm run preview

   Read-only: this server never writes to the project.

   Behaviour mirrored from static hosting (Cloudflare Pages):
     - `/dir/` serves `/dir/index.html`
     - unknown paths return the top-level 404.html with HTTP 404
     - text assets are gzip-compressed when the browser accepts it, as
       any CDN does (so transfer sizes in a local measurement are
       representative, not 10x too large)
   It does not emulate Cloudflare's `index.html` -> `/` redirects, its
   Brotli compression or its cache headers; verify those on a real
   Cloudflare preview deployment.
   ========================================================================== */
"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const zlib = require("zlib");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".csv": "text/csv; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

/** Parse the `/*` block of a Netlify/Cloudflare-style `_headers` file. */
function parseHeadersFile(root) {
  const headersPath = path.join(root, "_headers");
  if (!fs.existsSync(headersPath)) return {};
  const headers = {};
  let inGlobalBlock = false;
  for (const rawLine of fs.readFileSync(headersPath, "utf8").split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (line.trim() === "/*") { inGlobalBlock = true; continue; }
    if (!inGlobalBlock) continue;
    if (line.trim() === "") continue;
    if (!line.startsWith("  ") && !line.startsWith("\t")) { inGlobalBlock = false; continue; }
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const name = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (name) headers[name] = value;
  }
  return headers;
}

const COMPRESSIBLE = new Set([".html", ".js", ".css", ".json", ".svg", ".csv", ".md"]);
const gzipCache = new Map(); // filePath -> { mtimeMs, body }

function gzipped(filePath, stat) {
  const hit = gzipCache.get(filePath);
  if (hit && hit.mtimeMs === stat.mtimeMs) return hit.body;
  const body = zlib.gzipSync(fs.readFileSync(filePath), { level: 6 });
  gzipCache.set(filePath, { mtimeMs: stat.mtimeMs, body });
  return body;
}

/**
 * Create (but do not start) the preview server.
 * @param {{root?: string, gzip?: boolean}} [options]
 */
function createServer(options) {
  const root = path.resolve((options && options.root) || path.join(__dirname, "..", ".."));
  const securityHeaders = parseHeadersFile(root);

  return http.createServer((req, res) => {
    let urlPath;
    try {
      urlPath = decodeURIComponent(String(req.url).split("?")[0].split("#")[0]);
    } catch (err) {
      res.writeHead(400, securityHeaders);
      res.end("Bad request");
      return;
    }
    if (urlPath.endsWith("/")) urlPath += "index.html";
    const filePath = path.normalize(path.join(root, urlPath));
    if (filePath !== root && !filePath.startsWith(root + path.sep)) {
      res.writeHead(403, securityHeaders);
      res.end("Forbidden");
      return;
    }

    let stat = null;
    try { stat = fs.statSync(filePath); } catch (err) { stat = null; }
    if (stat && stat.isDirectory()) {
      // Static hosts redirect "/dir" to "/dir/" so relative URLs resolve.
      // Preserve ?quiz= and catalog filters when normalizing a directory URL.
      const target = new URL(req.url, "http://localhost");
      res.writeHead(308, Object.assign({ Location: target.pathname + "/" + target.search }, securityHeaders));
      res.end();
      return;
    }
    if (!stat || !stat.isFile()) {
      const notFound = path.join(root, "404.html");
      const body = fs.existsSync(notFound) ? fs.readFileSync(notFound) : Buffer.from("Not found");
      res.writeHead(404, Object.assign({ "Content-Type": "text/html; charset=utf-8" }, securityHeaders));
      res.end(req.method === "HEAD" ? undefined : body);
      return;
    }

    const headers = Object.assign(
      { "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream" },
      securityHeaders
    );
    const acceptsGzip = /\bgzip\b/.test(String(req.headers["accept-encoding"] || ""));
    if (acceptsGzip && COMPRESSIBLE.has(path.extname(filePath).toLowerCase())) {
      const body = gzipped(filePath, stat);
      headers["Content-Encoding"] = "gzip";
      headers["Vary"] = "Accept-Encoding";
      headers["Content-Length"] = body.length;
      res.writeHead(200, headers);
      res.end(req.method === "HEAD" ? undefined : body);
      return;
    }
    res.writeHead(200, headers);
    if (req.method === "HEAD") { res.end(); return; }
    fs.createReadStream(filePath).pipe(res);
  });
}

function main() {
  const args = process.argv.slice(2);
  let port = 8788;
  let root;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--port") port = Number(args[++i]);
    else if (args[i] === "--root") root = args[++i];
  }
  const server = createServer({ root });
  server.listen(port, "127.0.0.1", () => {
    console.log("Dynanca preview: http://127.0.0.1:" + server.address().port + "/");
    console.log("Serving with the response headers from _headers (CSP enforced by the browser).");
  });
}

if (require.main === module) main();
module.exports = { createServer, parseHeadersFile };
