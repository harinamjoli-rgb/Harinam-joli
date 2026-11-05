import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../js/script.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../store.html", import.meta.url), "utf8");
const cards = [...html.matchAll(/<(?:a|article) class="category-card"[^>]*data-category="([^"]+)"[^>]*>[\s\S]*?<h3>([^<]+)<\/h3>/g)]
  .map(([, category, title]) => ({ dataset: { category }, title }));
assert.equal(cards.length, 6);
const prepare = (card) => Object.assign(card, {
  attrs: {},
  setAttribute(name, value) { this.attrs[name] = value; },
  querySelector(selector) { return selector === "h3" ? { textContent: this.title } : this.innerHTML?.includes('class="category-hover-image"') ? {} : null; },
  replaceWith(next) { next.title = this.title; cards[cards.indexOf(this)] = next; },
});
cards.forEach(prepare);
const catalog = [{ id: 29, listed: true, categories: ["Digital Print", "Japa Bag"], image: "https://store.test/real.jpg", images: ["https://store.test/real.jpg", 'https://store.test/alternate.jpg?name="quoted"'] }];
const events = {};
let loaded;
let hoverCount = 0;
runInNewContext(source.slice(source.indexOf("const escapeOfferHTML ="), source.indexOf("const offerPrice =")), {
  document: { querySelectorAll: () => cards, createElement: tag => prepare({ tag, dataset: {} }) },
  HarinamShop: { catalog, catalogReady: { then(handler) { loaded = handler; return { catch() {} }; } } },
  window: { addEventListener(name, handler) { events[name] = handler; } },
  prepareCategoryHover() { hoverCount += 1; },
});
loaded();
const category = name => cards.find(card => card.dataset.category === name);
assert.equal(category("Digital Print").href, "products.html?category=Digital%20Print");
assert.match(category("Digital Print").innerHTML, /https:\/\/store.test\/real.jpg/);
assert.match(category("Digital Print").innerHTML, /&quot;quoted&quot;/, "Backend image URLs are escaped");
assert.ok(hoverCount > 0);
assert.equal(category("Books").attrs["aria-disabled"], "true");
catalog.push({ id: 45, listed: true, categories: ["Books"], image: "https://store.test/book.jpg", images: [] });
events["harinam:catalog"]();
assert.equal(category("Books").tag, "a", "Adding a backend product activates its category without changing HTML");
assert.equal(category("Books").href, "products.html?category=Books");
assert.match(category("Books").innerHTML, /book.jpg/);
assert.doesNotMatch(category("Books").innerHTML, /Coming soon|real.jpg/);
catalog[1].listed = false;
events["harinam:catalog"]();
assert.equal(category("Books").tag, "article", "An unpublished or removed product cannot keep a category active");
assert.equal(category("Books").attrs["aria-disabled"], "true");
assert.doesNotMatch(category("Books").innerHTML, /book.jpg/);
console.log("PASS: backend products activate only their assigned home category; real galleries, escaped URLs and empty categories stay accurate");
