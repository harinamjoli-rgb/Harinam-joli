import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../js/products.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../products.html", import.meta.url), "utf8");
const sidebar = html.match(/<aside class="filters"[\s\S]*?<\/aside>/)[0];
assert.match(sidebar, /id="filters-status" role="status">Loading filters…/);
assert.match(sidebar, /<div id="filter-controls" hidden>/, "Controls are hidden before any script or catalog response");
assert.doesNotMatch(sidebar, /name="(?:category|style)"|data-product-id=|999|599|Traditional|Daily Chanting/, "No demo categories, prices or featured products remain in the sidebar");

const filtersSource = source.slice(source.indexOf("const replaceFilterOptions ="), source.indexOf("// The wishlist"));
for (const styles of [[], ["Temple", "Printed", "Temple"]]) {
  const groups = Object.fromEntries(["category", "style"].map(name => [name, {
    labels: [],
    querySelectorAll() { return this.labels; },
    append(label) { this.labels.push(label); },
  }]));
  runInNewContext(filtersSource, {
    products: [
      { categories: ["Japa Bag", "Digital Print"], styles },
      { categories: ["Digital Print", "New Collection"], styles },
    ],
    document: {
      querySelector: selector => groups[selector.match(/data-filter-group="([^"]+)"/)[1]],
      createElement: () => ({ append(input, text) { this.input = input; this.text = text; } }),
    },
  });
  assert.deepEqual(groups.category.labels.map(label => label.input.value), ["Digital Print", "Japa Bag", "New Collection"]);
  assert.equal(groups.category.hidden, false);
  assert.deepEqual(groups.style.labels.map(label => label.input.value), styles.length ? ["Printed", "Temple"] : []);
  assert.equal(groups.style.hidden, styles.length === 0, "Empty catalog styles stay hidden; real styles populate automatically");
}

const featuredSource = source.slice(source.indexOf("const featuredProducts ="), source.indexOf("const syncCatalogRoute ="));
const escapingSource = source.slice(source.indexOf("const escapeHTML ="), source.indexOf("const formatPrice ="));
for (const count of [0, 1, 4]) {
  const products = Array.from({ length: count }, (_, i) => ({ id: 90 + i, name: `Actual <Bag ${i}>`, image: `https://store.test/${i}.jpg`, rating: 2.5, price: 499 + i }));
  const opened = [];
  const featured = {
    buttons: [],
    insertAdjacentHTML(position, markup) {
      this.markup = markup;
      this.buttons = [...markup.matchAll(/data-product-id="(\d+)"/g)].map(([, id]) => ({
        id, addEventListener(type, handler) { this.click = handler; },
      }));
    },
    querySelectorAll() { return this.buttons; },
  };
  runInNewContext(`${escapingSource}\n${featuredSource}`, {
    products, document: { querySelector: () => featured },
    formatPrice: price => `₹${price}`, openProduct: id => opened.push(id),
  });
  assert.equal(featured.hidden, count === 0);
  assert.equal(featured.buttons.length, Math.min(count, 3), "Only existing catalog products are rendered");
  featured.buttons.forEach((button, index) => {
    assert.equal(button.id, String(products[index].id));
    assert.ok(featured.markup.includes(`Actual &lt;Bag ${index}&gt;`), "Product names are escaped");
    assert.ok(featured.markup.includes(`₹${products[index].price}`));
    assert.ok(featured.markup.includes("2.5 / 5"), "The catalog rating replaces placeholder stars");
    button.click();
  });
  assert.deepEqual(opened, products.slice(0, 3).map(product => product.id));
}

const revealStart = source.indexOf('document.querySelector("#filters-status").hidden = true;');
assert.ok(revealStart > source.indexOf("syncCatalogRoute(new URLSearchParams(location.search));"), "Reveal happens after category and price initialization");
assert.ok(revealStart > source.indexOf("const featuredProducts ="));
const status = { hidden: false }, controls = { hidden: true }, result = {}, empty = {};
const document = { querySelector: selector => ({ "#filters-status": status, "#filter-controls": controls, "#result-count": result, "#empty-state": empty })[selector], querySelectorAll: () => [] };
runInNewContext(source.slice(revealStart, source.indexOf("  })\n  .catch")), { document });
assert.equal(status.hidden, true);
assert.equal(controls.hidden, false);
status.hidden = false;
controls.hidden = true;
runInNewContext(source.slice(source.indexOf("  .catch((error) => {") + "  .catch((error) => {".length, source.lastIndexOf("  });")), { document, error: new Error("Catalog failed") });
assert.equal(controls.hidden, true, "A failed catalog cannot expose unfinished controls");
assert.match(status.textContent, /Filters unavailable/);
assert.equal(empty.textContent, "Catalog failed");
assert.equal(empty.hidden, false);
console.log("PASS: no placeholder sidebar, loading/error states, real categories/styles, prices initialized before reveal, and actual featured products");
