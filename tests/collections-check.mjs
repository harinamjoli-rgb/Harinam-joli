import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../js/script.js", import.meta.url), "utf8");
const interactions = source.slice(source.indexOf("const syncHomeWishlist ="));
const classes = () => {
  const set = new Set();
  return { contains: value => set.has(value), toggle(value, active) { if (active) set.add(value); else set.delete(value); } };
};
const makeCard = (id, offer = false) => {
  const heart = { attrs: {}, classList: classes(), image: {}, querySelector() { return this.image; }, setAttribute(name, value) { this.attrs[name] = value; } };
  const card = { dataset: { productId: String(id) }, classList: { contains: value => offer && value === "offer-card" }, querySelector: () => heart };
  return { card, heart };
};
const makeGrid = cards => ({ cards, querySelectorAll() { return this.cards.map(item => item.card); }, addEventListener(name, fn) { this.click = fn; } });
const collection = makeGrid([makeCard(29), makeCard(35), makeCard(39)]);
const offer = makeGrid([makeCard(29, true)]);
const extras = [makeGrid([makeCard(29, true)]), makeGrid([makeCard(29, true)])];
const wishlist = new Set(), events = {}, adds = [], toasts = [], location = {};
const products = [
  { id: 29, name: "Jagannath printed japa bag", available: true },
  { id: 35, name: "Variable Japa bag", available: true, type: "variable" },
  { id: 39, name: "Unavailable bag", available: false },
];
runInNewContext(interactions, {
  collectionGrid: collection, offerGrid: offer, extraOfferGrids: extras,
  window: { addEventListener(name, fn) { events[name] = fn; } }, location,
  showToast(message) { toasts.push(message); },
  HarinamShop: {
    catalog: products, getWishlist: () => wishlist,
    toggleWishlist(id) { id = String(id); wishlist.has(id) ? wishlist.delete(id) : wishlist.add(id); events["harinam:wishlist"](); },
    addToCart(product) { if (!product.available) return false; adds.push(product.id); return true; },
  },
});
const click = (grid, card, control) => grid.click({
  target: { closest: selector => selector === "[data-product-id]" ? card : selector === control ? {} : null },
});
click(collection, collection.cards[0].card, ".heart-button");
assert.ok(wishlist.has("29"));
for (const grid of [collection, offer, ...extras]) {
  const heart = grid.cards[0].heart;
  assert.ok(heart.classList.contains("active"));
  assert.equal(heart.attrs["aria-pressed"], "true");
  assert.match(heart.attrs["aria-label"], /^Remove .* from wishlist$/);
}
assert.match(offer.cards[0].heart.image.src, /heart-filled\.svg$/);
click(extras[1], extras[1].cards[0].card, ".heart-button");
assert.ok(!wishlist.has("29"));
assert.equal(collection.cards[0].heart.attrs["aria-pressed"], "false");
assert.match(offer.cards[0].heart.image.src, /heart\.svg$/);
wishlist.add("29"); events.storage();
assert.ok(collection.cards[0].heart.classList.contains("active"), "A wishlist change in another tab updates every home section");
click(collection, collection.cards[0].card, ".product-quick-add");
assert.deepEqual(adds, [29]);
assert.deepEqual(toasts, ["Added to bag"]);
click(collection, collection.cards[1].card, ".product-quick-add");
assert.equal(location.href, "product-details.html?id=35", "Variable products open their own detail page to select an option");
click(collection, collection.cards[2].card, ".product-quick-add");
assert.deepEqual(adds, [29], "Unavailable products cannot be added");
location.href = "unchanged";
click(collection, collection.cards[0].card, "a");
assert.equal(location.href, "unchanged", "Native image/name links retain ordinary, modified-click and keyboard behavior");
assert.deepEqual(adds, [29], "Opening product details must not add it to cart");
click(collection, null, ".heart-button");
console.log("PASS: live home wishlist across all grids, cross-tab state, Quick Add, variable-product routing and native product links");
