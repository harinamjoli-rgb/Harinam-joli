import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const script = readFileSync(new URL("../js/script.js", import.meta.url), "utf8");
const source = script.slice(script.indexOf("const syncCollectionImages ="), script.indexOf("const offerSection ="));
const image = (src = "", loaded = false) => ({
  attrs: { src }, handlers: {}, complete: loaded, naturalWidth: loaded ? 600 : 0, alt: "Japa bag",
  get src() { return this.attrs.src; },
  set src(value) { this.attrs.src = value; this.complete = false; this.naturalWidth = 0; },
  getAttribute(name) { return this.attrs[name]; },
  addEventListener(type, handler, options = {}) { (this.handlers[type] ||= []).push({ handler, once: options.once }); },
  fire(type) {
    this.complete = true;
    this.naturalWidth = type === "load" ? 600 : 0;
    const handlers = this.handlers[type] || [];
    this.handlers[type] = handlers.filter(item => !item.once);
    handlers.forEach(item => item.handler());
  },
  after(other) {
    const parent = this.parentElement;
    parent.children.splice(parent.children.indexOf(this) + 1, 0, other);
    other.parentElement = parent;
  },
  remove() {
    if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
    this.parentElement = null;
  },
});
const makeCard = (id, hoverSrc) => {
  const primary = image(`assets/product-${id || "local"}.jpg`, true);
  const photo = {
    dataset: {}, children: [primary, { tag: "button" }],
    querySelector(selector) { return selector === ".product-primary-image" ? primary : this.children.find(item => item.className === "product-hover-image"); },
  };
  primary.parentElement = photo;
  return { primary, photo, dataset: { productId: id && String(id), hoverSrc }, querySelector: () => photo };
};
const fixture = async (cards, catalog = [], offline = false) => {
  const window = { handlers: {}, addEventListener(type, handler) { this.handlers[type] = handler; } };
  const shop = { catalog, catalogReady: offline ? Promise.reject(new Error("offline")) : Promise.resolve() };
  runInNewContext(source, { document: { querySelectorAll: () => cards, createElement: () => image() }, window, HarinamShop: shop });
  await new Promise(resolve => setImmediate(resolve));
  return { window, shop };
};
const main = "https://store.example/g1.png", alternate = "https://store.example/g2.jpg";
const first = makeCard(35), second = makeCard(39), duplicate = makeCard(35), missing = makeCard(99);
const { window } = await fixture([first, second, duplicate, missing], [
  { id: 35, name: "Mahaprabhu Japa Bag", image: main, images: [main, main, alternate] },
  { id: 39, name: "Vitthal Japa Bag", image: "https://store.example/v1.png", images: ["https://store.example/v1.png", "https://store.example/v2.png"] },
]);
for (const card of [first, duplicate]) {
  const hover = card.photo.querySelector(".product-hover-image");
  assert.equal(card.primary.src, main);
  assert.equal(hover.src, alternate, "Only use another image from the same product's gallery");
  assert.equal(card.photo.children[1], hover, "Keep the hover photo behind the wishlist and Quick Add controls");
  assert.equal(card.photo.dataset.hoverReady, undefined, "Keep the primary photo visible while the gallery image loads");
  hover.fire("load");
  assert.equal(card.photo.dataset.hoverReady, undefined, "Both matching product photos must load before swapping");
  card.primary.fire("load");
  assert.equal(card.photo.dataset.hoverReady, "true");
}
assert.equal(second.photo.querySelector(".product-hover-image").src, "https://store.example/v2.png");
assert.equal(missing.photo.querySelector(".product-hover-image"), undefined);
window.handlers["harinam:catalog"]();
assert.equal(first.photo.children.length, 3, "Catalog refresh must not add duplicate hover images");

const broken = makeCard(35);
await fixture([broken], [{ id: 35, image: main, images: [main, alternate] }]);
broken.photo.querySelector(".product-hover-image").fire("error");
assert.equal(broken.photo.querySelector(".product-hover-image"), undefined);
assert.equal(broken.photo.dataset.hoverReady, undefined, "A failed hover image must not hide the main photo");
const brokenMain = makeCard(35);
await fixture([brokenMain], [{ id: 35, image: main, images: [main, alternate] }]);
brokenMain.primary.fire("error");
assert.equal(brokenMain.primary.src, "assets/product-35.jpg");
assert.equal(brokenMain.photo.querySelector(".product-hover-image"), undefined);

const local = makeCard(undefined, "assets/alternate-radha.jpg");
await fixture([local], [], true);
local.photo.querySelector(".product-hover-image").fire("load");
assert.equal(local.photo.dataset.hoverReady, "true", "A matching local gallery must work without the catalog API");
const single = makeCard(35);
await fixture([single], [{ id: 35, image: main, images: [main, main] }]);
assert.equal(single.photo.querySelector(".product-hover-image"), undefined);
console.log("PASS: same-product gallery pairs, duplicate cards, loading guards, image failures and local fallback");
