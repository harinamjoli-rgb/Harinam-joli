import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const source = read("js/auth.js");
const social = source.slice(source.indexOf("  const initSocial ="), source.indexOf("  const show ="));
const state = "S".repeat(64), grant = "G".repeat(64);
const settle = () => new Promise(resolve => setImmediate(resolve));
const events = () => ({
  handlers: {},
  addEventListener(name, fn) { (this.handlers[name] ||= new Set()).add(fn); },
  removeEventListener(name, fn) { this.handlers[name]?.delete(fn); },
  fire(name, event) { return Promise.all([...(this.handlers[name] || [])].map(fn => fn(event))); },
});
const fixture = ({ providers = { google: true, facebook: true }, blocked = false, url = "https://admin.harinamjoli.in/wp-login.php?loginSocial=google", requestFails = false, finishFails = false } = {}) => {
  const buttons = ["google", "facebook"].map(provider => ({ ...events(), dataset: { socialProvider: provider }, disabled: true }));
  const status = { textContent: "" }, cancel = { ...events(), hidden: true };
  const root = {
    querySelector: selector => selector === ".auth-social-login" ? {} : selector === "#auth-social-status" ? status : cancel,
    querySelectorAll: () => buttons,
  };
  const popup = { location: { replace(value) { popup.url = value; } }, close() { popup.closed = true; } };
  const window = { ...events(), open() { return blocked ? null : popup; } };
  const channels = [], timers = [], finishes = [];
  let succeeded = 0, starts = 0;
  const initialized = new WeakMap([[root, () => { succeeded++; }]]);
  const shop = {
    async request() { if (requestFails) throw new Error("Unavailable"); return providers; },
    async beginSocialLogin(provider) {
      starts++;
      return { state, url: provider === "google" ? url : url.replace("google", "facebook"), async finish(value) { finishes.push(value); if (finishFails) throw new Error("Sign-in has expired."); } };
    },
  };
  runInNewContext(`${social}\ninitSocial(root);`, {
    root, initialized, window, HarinamShop: shop, URL,
    location: { origin: "http://127.0.0.1:8000" },
    BroadcastChannel: class {
      constructor(name) { this.name = name; channels.push(this); }
      close() { this.closed = true; }
    },
    setTimeout(fn, delay) { const timer = { fn, delay }; timers.push(timer); return timer; },
    clearTimeout(timer) { if (timer) timer.cleared = true; },
  });
  return { buttons, status, cancel, popup, window, channels, timers, finishes, starts: () => starts, succeeded: () => succeeded };
};
const message = { type: "harinam:social-login", state, grant };
const f = fixture();
await settle();
assert.ok(f.buttons.every(button => !button.disabled));
const pending = f.buttons[0].fire("click");
await settle();
assert.ok(f.buttons.every(button => button.disabled) && !f.cancel.hidden);
assert.equal(f.popup.url, "https://admin.harinamjoli.in/wp-login.php?loginSocial=google");
await f.buttons[1].fire("click");
assert.equal(f.starts(), 1, "Duplicate clicks cannot start another provider flow");
for (const event of [
  { origin: "https://evil.example", source: f.popup, data: message },
  { origin: "http://127.0.0.1:8000", source: {}, data: message },
  { origin: "http://127.0.0.1:8000", source: f.popup, data: { ...message, state: "X".repeat(64) } },
  { origin: "http://127.0.0.1:8000", source: f.popup, data: { ...message, grant: "bad" } },
]) await f.window.fire("message", event);
assert.equal(f.finishes.length, 0, "An unrelated origin, window, state or malformed grant cannot authenticate");
await f.window.fire("message", { origin: "http://127.0.0.1:8000", source: f.popup, data: message });
f.channels[0].onmessage({ data: message });
await pending;
assert.deepEqual(f.finishes, [grant], "postMessage and BroadcastChannel together still redeem only once");
assert.equal(f.succeeded(), 1);
assert.ok(f.popup.closed && f.channels[0].closed && f.timers[0].cleared && f.cancel.hidden);
assert.equal(f.window.handlers.message.size, 0);

const coop = fixture(); await settle();
const coopPending = coop.buttons[1].fire("click"); await settle();
coop.popup.closed = true;
coop.channels[0].onmessage({ data: { ...message, state: "wrong" } });
assert.equal(coop.finishes.length, 0);
coop.channels[0].onmessage({ data: message });
await coopPending;
assert.equal(coop.succeeded(), 1, "Google COOP severing the opener must not cancel a valid same-origin channel callback");

for (const options of [{ providers: { google: false, facebook: false } }, { requestFails: true }]) {
  const unavailable = fixture(options); await settle();
  assert.ok(unavailable.buttons.every(button => button.disabled));
  await unavailable.buttons[0].fire("click");
  assert.equal(unavailable.starts(), 0);
}
const one = fixture({ providers: { google: true, facebook: false } }); await settle();
assert.ok(!one.buttons[0].disabled && one.buttons[1].disabled);
const blocked = fixture({ blocked: true }); await settle(); await blocked.buttons[0].fire("click");
assert.equal(blocked.starts(), 0);
assert.match(blocked.status.textContent, /allow the sign-in window/);
const invalidUrl = fixture({ url: "https://evil.example/wp-login.php?loginSocial=google" });
await settle(); await invalidUrl.buttons[0].fire("click");
assert.equal(invalidUrl.popup.url, undefined);
assert.match(invalidUrl.status.textContent, /invalid address/);
const cancelled = fixture(); await settle();
const cancelledPending = cancelled.buttons[0].fire("click"); await settle();
await cancelled.cancel.fire("click"); await cancelledPending;
assert.equal(cancelled.finishes.length, 0);
assert.match(cancelled.status.textContent, /cancelled/);
assert.ok(cancelled.buttons.every(button => !button.disabled));
const expired = fixture(); await settle();
const expiredPending = expired.buttons[0].fire("click"); await settle();
assert.equal(expired.timers[0].delay, 600000);
expired.timers[0].fn(); await expiredPending;
assert.match(expired.status.textContent, /timed out/);
const failed = fixture({ finishFails: true }); await settle();
const failedPending = failed.buttons[0].fire("click"); await settle();
failed.channels[0].onmessage({ data: message }); await failedPending;
assert.equal(failed.succeeded(), 0);
assert.match(failed.status.textContent, /expired/);
const admin = fixture(); await settle();
const adminPending = admin.buttons[0].fire("click"); await settle();
admin.channels[0].onmessage({ data: { type: message.type, state, error: "customer_required" } });
await adminPending;
assert.equal(admin.finishes.length, 0);
assert.match(admin.status.textContent, /customer account/);

const callback = read("js/auth-callback.js");
const relay = (hash, opener = true) => {
  const messages = [], channelMessages = [], status = {};
  let removed = false, closed = false;
  runInNewContext(callback, {
    URLSearchParams, location: { hash, pathname: "/auth-callback.html", origin: "http://127.0.0.1:8000" },
    history: { replaceState() { removed = true; } },
    document: { querySelector: selector => selector.endsWith("status") ? status : { addEventListener() {} } },
    window: { opener: opener ? { postMessage(data, origin) { assert.ok(removed); messages.push({ data, origin }); } } : null, close() { closed = true; } },
    BroadcastChannel: class { postMessage(data) { assert.ok(removed); channelMessages.push(data); } close() {} },
  });
  return { messages, channelMessages, removed, closed, status };
};
const validRelay = relay(`#state=${state}&grant=${grant}`);
assert.equal(validRelay.messages[0].origin, "http://127.0.0.1:8000");
assert.equal(validRelay.channelMessages.length, 1);
assert.ok(validRelay.removed && validRelay.closed);
assert.equal(relay(`#state=${state}&grant=${grant}`, false).channelMessages.length, 1);
assert.equal(relay(`#state=${state}&error=customer_required`).channelMessages[0].error, "customer_required");
for (const hash of ["", "#state=bad&grant=bad", `#state=${state}&grant=${grant}&state=${state}`, `#state=${state}&error=arbitrary`, `#state=${state}&grant=${grant}&error=customer_required`]) {
  const invalid = relay(hash);
  assert.ok(invalid.removed && !invalid.messages.length && !invalid.channelMessages.length);
}

const shop = read("js/shop.js");
const begin = shop.slice(shop.indexOf("  const beginSocialLogin ="), shop.indexOf("  const syncCategoryNavigation ="));
const requests = [];
let csrf = "old", refreshes = 0;
const context = {
  location: { origin: "http://127.0.0.1:8000" },
  async refreshSession() { context.csrf = `csrf-${++refreshes}`; return { id: 7 }; },
  csrf,
  async request(path, options) { requests.push({ path, options }); return { state, url: "https://admin.harinamjoli.in/wp-login.php?loginSocial=google" }; },
};
runInNewContext(`${begin}\nglobalThis.begin = beginSocialLogin;`, context);
const flow = await context.begin("google");
context.csrf = "changed-in-another-request";
await flow.finish(grant);
assert.equal(requests[0].options.body.returnOrigin, "http://127.0.0.1:8000");
assert.equal(requests[1].options.headers["X-Harinam-CSRF"], "csrf-1", "The callback uses the exact initiating CSRF even when the shared session refreshes");
assert.equal(refreshes, 2, "A fresh session/nonce is read after the server sets the new cookie");
console.log("PASS: Google/Facebook provider availability, popup security, COOP relay, cancellation, replay guards, callback validation and customer session refresh");
