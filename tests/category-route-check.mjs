import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../js/products.js", import.meta.url), "utf8");
const products = [
  { id: 1, name: "Printed bag", categories: ["Japa Bag", "Digital Print"], price: 499, available: true },
  { id: 2, name: "Hand work bag", categories: ["Japa Bag", "Hand Work"], price: 1499, available: true },
  { id: 3, name: "Embroidered bag", categories: ["Japa Bag", "Embroidery"], price: 899, available: false },
  { id: 4, name: "Vastra shirt", categories: ["Vastra"], price: 5000, available: true },
  { id: 5, name: "Devotional book", categories: ["Books"], price: 299, available: true },
];
const heading = {};
const resultCount = {};
const checks = [{ value: "Japa Bag", checked: false }];
const selected = { availability: [], category: [], style: [] };
const context = {
  products, URLSearchParams, URL,
  formatPrice: value => `₹${Number(value)}`,
  location: { search: "?category=Japa%20Bag", href: "https://harinamjoli.in/products?category=Japa%20Bag&search=printed" },
  searchInput: { value: "" }, sortSelect: { value: "position" },
  priceRange: { max: "500", value: "500" }, priceOutput: {},
  selectedValues: name => selected[name],
  document: {
    body: { classList: { toggle() {} } },
    querySelector: selector => selector === ".page-title h1" ? heading : selector === ".page-title" ? { setAttribute() {} } : resultCount,
    querySelectorAll: () => checks,
  },
};

runInNewContext(source.slice(0, source.indexOf("HarinamShop.catalogReady")), context);
assert.equal(heading.textContent, "Japa Bag", "Category heading must appear before the catalog loads");

const reset = source.slice(source.indexOf("const resetFilters ="), source.indexOf('document.querySelector("#refresh-products")'));
runInNewContext(`${reset}\nresetFilters();`, context);
assert.equal(context.priceRange.max, "5000", "Reset must include new higher-priced products");

const filter = source.slice(source.indexOf("const filteredProducts ="), source.indexOf("const productCard ="));
const ids = () => Array.from(runInNewContext(`(() => { ${filter}\nreturn filteredProducts(); })()`, context), product => product.id);
assert.deepEqual(ids(), [1, 2, 3], "Japa route must include every Japa subtype and exclude Vastra even with unchecked category inputs");
selected.availability = ["in-stock"];
assert.deepEqual(ids(), [1, 2]);
selected.availability = [];
context.searchInput.value = "Hand work";
assert.deepEqual(ids(), [2]);
context.searchInput.value = "";
context.location.search = "";
assert.deepEqual(ids(), [1, 2, 3, 4, 5]);
context.location.search = "?category=Books";
assert.deepEqual(ids(), [5], "Books navigation must filter to books without including bags or Vastra");
context.location.search = "?category=Unknown";
assert.deepEqual(ids(), []);

let refresh;
let refreshedCategory;
let refreshedUrl;
context.location.search = "?category=Japa%20Bag&search=printed";
const refreshContext = {
  ...context, currentPage: 2,
  document: { querySelector: () => ({ addEventListener(type, handler) { refresh = handler; } }) },
  resetFilters() {}, resultCount: {},
  history: { replaceState(state, title, url) { refreshedUrl = new URL(url); } },
  HarinamShop: { async refreshCatalog() {} },
  syncCatalogRoute(params) { refreshedCategory = params.get("category"); },
  showToast() {},
};
const refreshSource = source.slice(source.indexOf('document.querySelector("#refresh-products")'), source.indexOf('wishlistItems.addEventListener("click"'));
runInNewContext(refreshSource, refreshContext);
await refresh();
assert.equal(refreshedUrl.searchParams.get("category"), "Japa Bag");
assert.equal(refreshedUrl.searchParams.get("search"), null);
assert.equal(refreshedCategory, "Japa Bag", "Refresh must restore the current category filter");
console.log("PASS: Japa collection scope, subcategories, all stock states, price reset, early heading and category-preserving refresh");
