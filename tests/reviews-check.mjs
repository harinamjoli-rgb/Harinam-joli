import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const script = readFileSync(new URL("../js/script.js", import.meta.url), "utf8");
const source = script.slice(script.indexOf("const reviewRow ="), script.indexOf("const categoryHoverImages ="));
const node = (tag = "span") => ({
  tag, dataset: {}, attrs: {}, children: [], textContent: "", handlers: {},
  setAttribute(name, value) { this.attrs[name] = value; },
  addEventListener(type, handler) { this.handlers[type] = handler; },
  replaceChildren(...children) { this.children = children; },
});
const card = (original) => {
  const result = node("article");
  const fields = Object.fromEntries(["h3", ".review-user p", ".review-user small", "blockquote", "time", "footer span"].map(key => [key, node()]));
  if (original) {
    result.dataset = { ...original.dataset };
    for (const key of Object.keys(fields)) fields[key].textContent = original.querySelector(key).textContent;
  }
  const photo = node("img");
  photo.replaceWith = value => { result.avatar = value; };
  result.querySelector = selector => selector === ".review-user > img" ? photo : fields[selector];
  result.cloneNode = () => card(result);
  return result;
};
const real = id => ({ id, name: `Customer ${id}`, rating: id % 5 + 1, text: `Real review ${id}`, date: "October 24, 2026" });
const fixture = async (reviews = [], { reduced = false, offline = false } = {}) => {
  const row = Object.assign(node("div"), {
    children: Array.from({ length: 10 }, () => card()),
    scrollLeft: 0, scrollWidth: 4000, clientWidth: 1606,
    querySelectorAll() { return this.children; },
    contains(value) { return this.children.includes(value); },
  });
  const shop = { catalog: [{ reviews }], catalogReady: offline ? Promise.reject(new Error("offline")) : Promise.resolve() };
  const window = node();
  const document = { hidden: false, querySelector: () => row, createElement: node };
  let frame, now = 0;
  runInNewContext(source, {
    document, window, HarinamShop: shop,
    matchMedia: () => ({ matches: reduced }),
    performance: { now: () => now },
    IntersectionObserver: class { constructor(callback) { this.callback = callback; } observe() { this.callback([{ isIntersecting: true }]); } },
    requestAnimationFrame(callback) { frame = callback; },
  });
  await new Promise(resolve => setImmediate(resolve));
  return { row, shop, window, document, frame: time => { now = time; frame(time); } };
};

for (const count of [0, 1, 9, 10, 12]) {
  const { row } = await fixture(Array.from({ length: count }, (_, index) => real(index + 1)));
  assert.equal(row.dataset.realReviewCount, String(count));
  assert.equal(row.children.filter(item => item.dataset.reviewSource === "real").length, count);
  assert.equal(row.children.filter(item => item.dataset.reviewSource === "demo").length, Math.max(0, 10 - count));
  assert.equal(row.children.length, Math.max(10, count), "Keep all real reviews, without duplicate animation tracks");
  if (count) {
    const first = row.children[0];
    assert.equal(first.querySelector("h3").textContent, "Customer 1");
    assert.equal(first.avatar.textContent, "C1", "Real reviews must use initials instead of another customer's demo photo");
    assert.equal(first.querySelector(".review-user p").children[0].textContent, "★★☆☆☆");
    assert.equal(first.querySelector("footer span").textContent, "Website");
    assert.equal(first.querySelector(".review-user small").textContent, "Customer review", "Do not invent verified-purchase status");
  }
}

const duplicate = await fixture([...Array.from({ length: 9 }, (_, i) => real(i + 1)), real(1), null, { ...real(10), text: " " }, { ...real(11), rating: 0 }]);
assert.equal(duplicate.row.dataset.realReviewCount, "9", "Duplicate and invalid reviews must not trigger the threshold");
duplicate.shop.catalog.push({ reviews: [real(10)] });
duplicate.window.handlers["harinam:catalog"]();
assert.equal(duplicate.row.children.length, 10);
assert.ok(duplicate.row.children.every(item => item.dataset.reviewSource === "real"), "The tenth real review must remove every demo card on catalog refresh");

const fallback = await fixture([], { offline: true });
assert.ok(fallback.row.children.every(item => item.querySelector(".review-user small").textContent === "Demo review"));
fallback.frame(100); fallback.frame(150);
assert.ok(fallback.row.scrollLeft > 0, "The review row must scroll automatically");
let position = fallback.row.scrollLeft;
fallback.row.handlers.pointerenter({ pointerType: "mouse" }); fallback.frame(200);
assert.equal(fallback.row.scrollLeft, position, "Hover must stop movement for reading");
fallback.row.handlers.pointerleave(); fallback.frame(250);
assert.ok(fallback.row.scrollLeft > position);
fallback.row.handlers.wheel(); fallback.frame(300);
position = fallback.row.scrollLeft;
fallback.frame(350);
assert.equal(fallback.row.scrollLeft, position, "Manual scrolling must temporarily stop automatic movement");
fallback.frame(6400);
assert.ok(fallback.row.scrollLeft > position, "Automatic scrolling must resume after manual browsing");
const reduced = await fixture([], { reduced: true });
reduced.frame(100); reduced.frame(150);
assert.equal(reduced.row.scrollLeft, 0);

console.log("PASS: real-review thresholds 0/1/9/10/12, deduplication, catalog refresh, truthful ratings and automatic scrolling");
