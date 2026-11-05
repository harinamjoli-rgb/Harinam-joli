import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const shop = readFileSync(new URL("../js/shop.js", import.meta.url), "utf8");
const source = shop.slice(shop.indexOf("  const ensureAnnouncementSlider ="), shop.indexOf("  const prefetched ="));
const element = () => ({
  children: [], attrs: {}, handlers: {},
  classList: { add() {} },
  append(...items) { this.children.push(...items); },
  replaceChildren(...items) { this.children = items; },
  setAttribute(name, value) { this.attrs[name] = value; },
  addEventListener(type, handler) { this.handlers[type] = handler; },
  contains(target) { return target === this; },
  animate() {},
});
for (const reduced of [false, true]) {
  const region = element();
  const message = { ...element(), parentElement: region };
  const buttons = [element(), element()];
  const preference = { matches: reduced };
  const document = {
    hidden: false,
    querySelector: () => message,
    querySelectorAll: () => buttons,
    createElement: element,
  };
  let tick;
  runInNewContext(`${source}\nensureAnnouncementSlider();`, {
    document, matchMedia: () => preference,
    setInterval(handler, ms) { tick = handler; assert.equal(ms, 5000); },
  });
  const [accessible, track] = message.children;
  const current = () => track.children.findIndex(item => !item.hidden);
  assert.equal(track.children.length, 3);
  assert.equal(track.attrs["aria-hidden"], "true");
  assert.match(accessible.textContent, /Premium Quality Guaranteed/);
  assert.equal(region.children.length, 0, "No visible play/pause button");
  assert.equal(current(), 0);
  buttons[0].handlers.click(); assert.equal(current(), 2, "Previous wraps");
  buttons[1].handlers.click(); assert.equal(current(), 0, "Next wraps");
  tick(); assert.equal(current(), reduced ? 0 : 1, "Autoplay respects reduced motion");
  preference.matches = false;
  region.handlers.pointerenter(); tick();
  assert.equal(current(), reduced ? 0 : 1, "Hover pauses autoplay");
  region.handlers.pointerleave(); region.handlers.focusin(); tick();
  assert.equal(current(), reduced ? 0 : 1, "Keyboard focus pauses autoplay");
  region.handlers.focusout({ relatedTarget: region }); tick();
  assert.equal(current(), reduced ? 0 : 1, "Focus moving inside retains pause");
  region.handlers.focusout({ relatedTarget: null }); document.hidden = true; tick();
  assert.equal(current(), reduced ? 0 : 1, "Background tabs do not advance");
  document.hidden = false; tick(); assert.equal(current(), reduced ? 1 : 2);
  for (let i = 0; i < 1000; i++) tick();
  assert.equal(track.children.filter(item => !item.hidden).length, 1);
}
runInNewContext(`${source}\nensureAnnouncementSlider();`, {
  document: { querySelector: () => null, querySelectorAll: () => [] },
});
console.log("PASS: automatic announcements, arrows, hover/focus pause and reduced motion");
