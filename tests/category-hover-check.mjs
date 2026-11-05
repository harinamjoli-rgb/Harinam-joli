import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../js/script.js", import.meta.url), "utf8");
const hover = source.slice(source.indexOf("const prepareCategoryHover ="), source.indexOf("const categoryGrid ="));
for (const cached of [false, true]) {
  const photo = { dataset: {} };
  const image = {
    complete: cached, naturalWidth: cached ? 896 : 0, handlers: {},
    closest: () => photo,
    addEventListener(event, handler) { this.handlers[event] = handler; },
    remove() { this.removed = true; },
  };
  runInNewContext(hover, { document: { querySelectorAll: () => [image] } });
  assert.equal(photo.dataset.hoverReady, cached ? "true" : undefined, "Only loaded alternates can become visible");
  image.naturalWidth = 896;
  image.handlers.load();
  assert.equal(photo.dataset.hoverReady, "true", "Deferred image loading enables the hover swap");
  image.handlers.error();
  assert.equal(photo.dataset.hoverReady, undefined, "A broken alternate keeps the original photo visible");
  assert.equal(image.removed, true);
}
runInNewContext(hover, { document: { querySelectorAll: () => [] } });
const home = readFileSync(new URL("../store.html", import.meta.url), "utf8");
const category = home.match(/<a class="category-card"[^>]*>[\s\S]*?<\/a>/)[0];
assert.match(category, /category=Digital%20Print/);
assert.match(category, /class="category-hover-image"/);
for (const [, src] of category.matchAll(/src="([^"]+)"/g))
  assert.ok(existsSync(new URL(`../${src}`, import.meta.url)), `Available category photo: ${src}`);
assert.equal((home.match(/class="category-card" aria-disabled="true"/g) || []).length, 5, "Coming-soon categories retain their availability state");
console.log("PASS: category hover photos, cached/deferred loading, image-error fallback and coming-soon state");
