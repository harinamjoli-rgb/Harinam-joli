import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

const root = resolve(".");
const backend = "https://admin.harinamjoli.in/wp-json/harinam/v1";
const storefront = "https://admin.harinamjoli.in/wp-json/wc/store/v1";
// ponytail: one cookie jar is enough for a loopback-only dev server; isolate sessions if multi-user local testing is ever needed.
const cookies = new Map();
const types = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".vtt": "text/vtt",
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      const headers = {
        accept: "application/json",
        origin: "https://harinamjoli.in",
        "user-agent": "HarinamLocalDev/1.0",
      };
      for (const name of ["content-type", "x-wp-nonce", "x-harinam-csrf", "idempotency-key"]) {
        if (request.headers[name]) headers[name] = request.headers[name];
      }
      if (cookies.size) headers.cookie = [...cookies.values()].join("; ");
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const options = {
        method: request.method,
        headers,
        body: ["GET", "HEAD"].includes(request.method) ? undefined : Buffer.concat(chunks),
        redirect: "manual",
      };
      let upstream;
      const attempts = ["GET", "HEAD"].includes(request.method) ? 3 : 1;
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
          upstream = await fetch(`${backend}${url.pathname.slice(4)}${url.search}`, options);
          break;
        } catch (error) {
          if (attempt === attempts) throw error;
        }
      }
      for (const cookie of upstream.headers.getSetCookie?.() || []) {
        const value = cookie.split(";", 1)[0];
        cookies.set(value.split("=", 1)[0], value);
      }
      let body = Buffer.from(await upstream.arrayBuffer());
      if (url.pathname === "/api/products" && upstream.ok) {
        try {
          const data = JSON.parse(body.toString());
          const popular = await fetch(`${storefront}/products?orderby=popularity&order=desc&per_page=4`);
          if (popular.ok && Array.isArray(data.products)) {
            const ranks = new Map((await popular.json()).map((product, index) => [Number(product.id), index + 1]));
            data.products = data.products.map((product) => ({
              ...product,
              topSellerRank: ranks.get(Number(product.id)) || 0,
            }));
            body = Buffer.from(JSON.stringify(data));
          }
        } catch {
          // Keep the catalog response unchanged if the public popularity feed is unavailable.
        }
      }
      response.writeHead(upstream.status, {
        "content-type": upstream.headers.get("content-type") || "application/json",
      });
      response.end(body);
      return;
    }

    const policyRoute = url.pathname.match(/^\/(privacy-policy|return-refund-policy|shipping-delivery-policy|terms-and-conditions)\/?$/);
    const storefrontRoute = url.pathname.match(/^\/(about|account|cart|checkout|contact|products|profile|tracking|wishlist|product)\/?$/);
    if ((policyRoute || storefrontRoute) && url.pathname.endsWith("/")) {
      response.writeHead(301, { location: url.pathname.slice(0, -1) + url.search }).end();
      return;
    }
    const pathname = ["/", "/index.html"].includes(url.pathname)
      ? "/store.html"
      : policyRoute ? `/${policyRoute[1]}.html` : storefrontRoute ? `/${storefrontRoute[1] === "product" ? "product-details" : storefrontRoute[1]}.html` : url.pathname;
    const file = resolve(root, `.${pathname}`);
    if (!file.startsWith(`${root}/`)) throw new Error("Invalid path");
    const body = await readFile(file);
    response.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" });
    response.end(body);
  } catch {
    if (!response.headersSent) {
      response.writeHead(502, { "content-type": "application/json" });
      response.end(JSON.stringify({ message: "Local store proxy could not reach WooCommerce. Refresh to retry." }));
    }
  }
}).listen(8000, "127.0.0.1", () => {
  console.log("Harinam Joli: http://127.0.0.1:8000");
});
