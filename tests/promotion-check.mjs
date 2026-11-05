import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../js/script.js", import.meta.url), "utf8");
const motion = source.slice(source.indexOf("const promotionTrack ="), source.indexOf("const syncCollectionImages ="));
const group = () => ({ attrs: {}, setAttribute(key, value) { this.attrs[key] = value; }, cloneNode() { return { ...group(), attrs: { ...this.attrs } }; } });
const classes = new Set();
const track = {
  firstElementChild: group(), copies: [],
  append(...copies) { this.copies.push(...copies); },
  classList: { toggle(name) { classes.has(name) ? classes.delete(name) : classes.add(name); return classes.has(name); } },
};
const toggle = { attrs: {}, setAttribute(key, value) { this.attrs[key] = value; }, addEventListener(type, handler) { this.click = handler; } };
runInNewContext(motion, { document: { querySelector: selector => selector === ".promotion-track" ? track : toggle } });
assert.equal(track.copies.length, 2);
assert.ok(track.copies.every(copy => copy.attrs["aria-hidden"] === "true"));
toggle.click();
assert.ok(classes.has("is-paused"));
assert.equal(toggle.attrs["aria-pressed"], "true");
assert.equal(toggle.attrs["aria-label"], "Resume scrolling offer");
toggle.click();
assert.ok(!classes.has("is-paused"));
assert.equal(toggle.attrs["aria-pressed"], "false");
assert.equal(toggle.attrs["aria-label"], "Pause scrolling offer");
console.log("PASS: seamless offer copies stay hidden from screen readers; pause and resume controls work");
