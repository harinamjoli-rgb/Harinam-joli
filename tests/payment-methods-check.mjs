import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const html = readFileSync(new URL("payment-qr-preview.html", import.meta.url), "utf8");
const script = readFileSync(new URL("payment-methods-preview.js", import.meta.url), "utf8");
const methods = ["qr", "upi", "card"];
const tabs = methods.map((method, index) => ({
  dataset: { paymentMethod: method }, attrs: { "aria-selected": String(index === 0) }, tabIndex: index ? -1 : 0, handlers: {},
  addEventListener(name, handler) { this.handlers[name] = handler; },
  setAttribute(name, value) { this.attrs[name] = value; },
  focus() { this.focused = true; },
}));
const panels = methods.map((method, index) => ({ dataset: { paymentPanel: method }, hidden: index !== 0 }));
runInNewContext(script, { document: { querySelector: () => ({ querySelectorAll: selector => selector === "[data-payment-method]" ? tabs : panels }) } });
const active = () => tabs.findIndex(tab => tab.attrs["aria-selected"] === "true");
const assertSelected = (index) => {
  assert.equal(active(), index);
  assert.equal(tabs.filter(tab => tab.tabIndex === 0).length, 1);
  assert.deepEqual(panels.map(panel => panel.hidden), methods.map((_, i) => i !== index));
};
assertSelected(0);
tabs.forEach((tab, index) => { tab.handlers.click(); assertSelected(index); });
const key = (name, expected) => {
  let prevented = false;
  tabs[active()].handlers.keydown({ key: name, preventDefault() { prevented = true; } });
  assertSelected(expected);
  assert.ok(prevented && tabs[expected].focused);
};
key("ArrowRight", 0);
key("ArrowLeft", 2);
key("Home", 0);
key("ArrowRight", 1);
key("ArrowLeft", 0);
key("End", 2);
tabs[active()].handlers.keydown({ key: "Tab", preventDefault() { assert.fail("Normal Tab navigation must remain available"); } });
assertSelected(2);
assert.doesNotThrow(() => runInNewContext(script, { document: { querySelector: () => null } }));
for (const method of methods) {
  assert.match(html, new RegExp(`id="payment-method-${method}"[^>]+role="tab"[^>]+aria-controls="payment-panel-${method}"`));
  assert.match(html, new RegExp(`id="payment-panel-${method}"[^>]+role="tabpanel"[^>]+aria-labelledby="payment-method-${method}"`));
}
const inputs = [...html.matchAll(/<input\b[^>]*>/g)].map(match => match[0]);
assert.equal(inputs.length, 5, "UPI ID, card number, expiry, CVV and cardholder fields are displayed");
assert.ok(inputs.every(input => /\bdisabled\b/.test(input)), "Design fields cannot collect real payment details");
assert.equal((html.match(/class="preview-pay-action" type="button" disabled/g) || []).length, 2);
assert.doesNotMatch(script, /fetch|XMLHttpRequest|localStorage|sessionStorage|\.submit\(|location\./, "Preview switching cannot submit or store payment data");
console.log("PASS: QR, UPI ID and card panels, mouse/keyboard switching, focus, and disabled payment fields/actions");
