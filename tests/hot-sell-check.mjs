import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../js/script.js", import.meta.url), "utf8");
const render = source.slice(source.indexOf("const offerSection ="), source.indexOf("const syncHomeWishlist ="));
const product = (id, extra = {}) => ({ id, name: `Bag ${id}`, image: `/bag-${id}.jpg`, price: 499, oldPrice: 599, currency: "INR", available: true, ...extra });

const renderCatalog = async (catalog, fail = false) => {
  const section = { hidden: false };
  const grid = { innerHTML: "" };
  const collection = { innerHTML: "" };
  const extras = [0, 1].map(() => ({ innerHTML: "", section: { hidden: false }, closest() { return this.section; } }));
  runInNewContext(render, {
    document: {
      querySelector: selector => selector === ".best-offer" ? section : selector === ".best-sellers .product-grid" ? collection : grid,
      querySelectorAll: () => extras,
    },
    window: { addEventListener() {} },
    syncCollectionImages() {},
    HarinamShop: {
      catalog,
      catalogReady: fail ? Promise.reject(new Error("Offline")) : Promise.resolve(),
      getWishlist: () => new Set(),
    },
  });
  await new Promise(resolve => setImmediate(resolve));
  return { section, grid, collection, extras };
};

let result = await renderCatalog([product(1), product(2, { available: false })]);
assert.match(result.grid.innerHTML, /product-details\.html\?id=1/);
assert.doesNotMatch(result.grid.innerHTML, /product-details\.html\?id=2/);
assert.equal(result.section.hidden, false, "An unranked live catalog must still show available products");
assert.equal((result.grid.innerHTML.match(/class="offer-card"/g) || []).length, 1, "Do not repeat products to fill empty slots");
for (const extra of result.extras) assert.equal(extra.innerHTML, result.grid.innerHTML, "Both lower offer sections use real product detail links");
assert.match(result.collection.innerHTML, /class="product-image-link" href="product-details\.html\?id=1"/);
assert.match(result.collection.innerHTML, /<h3><a href="product-details\.html\?id=1">Bag 1<\/a><\/h3>/);
assert.match(result.collection.innerHTML, /data-product-id="2"/, "Published out-of-stock items still have a valid detail page");
assert.match(result.collection.innerHTML, /disabled>Out of Stock/);
assert.doesNotMatch(result.collection.innerHTML, /href="products\.html"/, "A product card must never send users to the generic catalog");

result = await renderCatalog([product(1, { totalSales: 2 }), product(2, { totalSales: 8 })]);
assert.ok(result.grid.innerHTML.indexOf('data-product-id="2"') < result.grid.innerHTML.indexOf('data-product-id="1"'));

result = await renderCatalog([product(1, { topSellerRank: 2 }), product(2, { topSellerRank: 1 })]);
assert.ok(result.grid.innerHTML.indexOf('data-product-id="2"') < result.grid.innerHTML.indexOf('data-product-id="1"'));
assert.equal((await renderCatalog([])).section.hidden, true);
result = await renderCatalog([], true);
assert.equal(result.section.hidden, true);
assert.ok(result.extras.every(extra => extra.section.hidden));
assert.match(result.collection.innerHTML, /Products unavailable/);
result = await renderCatalog([product(5, { listed: false }), product(6, { name: 'Bag <script>alert(1)</script>' })]);
assert.doesNotMatch(result.grid.innerHTML + result.collection.innerHTML, /data-product-id="5"|<script>/);
assert.match(result.collection.innerHTML, /&lt;script&gt;/);
result = await renderCatalog(Array.from({ length: 15 }, (_, id) => product(id + 1)));
assert.equal((result.collection.innerHTML.match(/class="product-card"/g) || []).length, 10);
assert.equal((result.grid.innerHTML.match(/class="offer-card"/g) || []).length, 5);
const home = readFileSync(new URL("../store.html", import.meta.url), "utf8");
assert.doesNotMatch(home, /<article class="(?:product-card|offer-card)"/, "The HTML cannot flash unlinked demo products before the catalog loads");
console.log("PASS: all four home product grids use real product IDs, image/title links, live prices, bounded unique cards and safe empty/offline states");
