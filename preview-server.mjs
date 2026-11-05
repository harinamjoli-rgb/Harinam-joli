import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const root = resolve(import.meta.dirname);
const port = Number(process.env.PORT || 3001);
const types = {
  ".css": "text/css",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

createServer(async (request, response) => {
  const requestUrl = new URL(request.url, "http://localhost");
  const pathname = requestUrl.pathname;
  if (pathname.startsWith("/api/")) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405).end("Local preview accepts read requests only.");
      return;
    }
    try {
      const url = new URL(request.url, "https://admin.harinamjoli.in");
      url.pathname = `/wp-json/harinam/v1${pathname.slice(4)}`;
      const upstream = await fetch(url, { method: request.method });
      response.writeHead(upstream.status, {
        "content-type": upstream.headers.get("content-type") || "application/json",
        "cache-control": "no-store",
      });
      response.end(request.method === "HEAD" ? undefined : Buffer.from(await upstream.arrayBuffer()));
    } catch {
      response.writeHead(502).end("Store catalog is unavailable.");
    }
    return;
  }

  const policyRoute = pathname.match(/^\/(privacy-policy|return-refund-policy|shipping-delivery-policy|terms-and-conditions)\/?$/);
  const storefrontRoute = pathname.match(/^\/(about|account|cart|checkout|contact|products|profile|tracking|wishlist|product)\/?$/);
  if ((policyRoute || storefrontRoute) && pathname.endsWith("/")) {
    response.writeHead(301, { location: pathname.slice(0, -1) + requestUrl.search }).end();
    return;
  }
  const name = pathname === "/" ? "/store.html" : policyRoute ? `/${policyRoute[1]}.html` : storefrontRoute ? `/${storefrontRoute[1] === "product" ? "product-details" : storefrontRoute[1]}.html` : decodeURIComponent(pathname);
  const file = resolve(root, `.${name}`);
  if (!file.startsWith(`${root}${sep}`) || name.split("/").some((part) => part.startsWith("."))) {
    response.writeHead(404).end();
    return;
  }
  try {
    if (!(await stat(file)).isFile()) throw new Error("Not a file");
    response.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404).end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Harinam local preview: http://127.0.0.1:${port}/`);
});
