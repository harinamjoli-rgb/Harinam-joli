import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../js/script.js", import.meta.url), "utf8");
const navigation = source.slice(source.indexOf("const categoryGrid ="), source.indexOf("const toast ="));

for (const [cardWidth, gap, viewport] of [[(1328 - 160) / 6, 32, 1328], [240, 32, 754], [240, 32, 343]]) {
  const step = cardWidth + gap;
  const events = () => ({
    handlers: {},
    addEventListener(type, handler) { this.handlers[type] = handler; },
  });
  const buttons = [events(), events()];
  const grid = {
    ...events(),
    children: [{ offsetLeft: 0 }, { offsetLeft: step }],
    clientWidth: viewport,
    scrollWidth: 6 * cardWidth + 5 * gap,
    scrollLeft: 0,
    scrollBy(options) {
      assert.ok(!("behavior" in options), "CSS must control reduced-motion scrolling");
      this.scrollLeft = Math.max(0, Math.min(this.scrollWidth - this.clientWidth, this.scrollLeft + options.left));
      this.handlers.scroll();
    },
  };
  const window = events();
  const document = { querySelector: () => grid, querySelectorAll: () => buttons };
  runInNewContext(navigation, { document, window });
  assert.ok(buttons[0].disabled);
  if (grid.scrollWidth <= viewport) {
    assert.ok(buttons[1].disabled, "Both arrows must be disabled when every category is visible");
    continue;
  }
  assert.ok(!buttons[1].disabled);
  buttons[1].handlers.click();
  assert.equal(grid.scrollLeft, Math.min(step, grid.scrollWidth - viewport));
  assert.ok(!buttons[0].disabled);
  while (!buttons[1].disabled) buttons[1].handlers.click();
  assert.equal(grid.scrollLeft, grid.scrollWidth - viewport);
  while (!buttons[0].disabled) buttons[0].handlers.click();
  assert.equal(grid.scrollLeft, 0);
  grid.clientWidth = grid.scrollWidth;
  window.handlers.resize();
  assert.ok(buttons.every(button => button.disabled));
}
console.log("PASS: category arrow steps, both boundaries, responsive widths and reduced-motion behavior");
