import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../js/auth.js", import.meta.url), "utf8");
const popup = source.slice(source.indexOf("  let authDialog;"), source.lastIndexOf("})();"));
const events = () => ({
  handlers: {},
  addEventListener(name, handler) { this.handlers[name] = handler; },
  fire(name, event = {}) { return this.handlers[name]?.(event); },
});
const fixture = ({ inline = false, inlineHidden = false, fail = false, signedIn = false, seen = false, storageFails = false, hidden = false, otherDialog = false, sessionReady = Promise.resolve() } = {}) => {
  const page = {};
  const email = { focus() { this.focused = true; } };
  const root = {
    isConnected: inline, parentElement: inline ? page : null, hidden: inlineHidden,
    querySelector() { return { elements: { email } }; },
    before(marker) { marker.parent = this.parentElement; },
  };
  const accountButton = { focus() { this.focused = true; }, click() { this.clicked = true; } };
  const close = events();
  const dialog = {
    ...events(), open: false, attrs: {},
    setAttribute(name, value) { this.attrs[name] = value; },
    querySelector() { return close; },
    append(node) { node.isConnected = true; node.parentElement = this; },
    showModal() { this.open = true; },
    close() { this.open = false; this.fire("close"); },
  };
  let requests = 0, imports = 0, user = signedIn ? {} : null;
  let shown = seen;
  const timers = [];
  const document = {
    ...events(), body: { append() {} }, hidden,
    querySelector(selector) {
      if (selector === "#auth-guest") return root.isConnected ? root : null;
      if (selector === "dialog[open]") return otherDialog || dialog.open ? dialog : null;
      return accountButton;
    },
    querySelectorAll() { return [accountButton]; },
    createElement() { return dialog; },
    importNode(node, deep) { assert.equal(deep, true); imports++; return node; },
    createComment() { return { replaceWith(node) { node.parentElement = this.parent; } }; },
  };
  const window = { ...events(), HarinamAuth: {} }, location = {};
  runInNewContext(popup, {
    document, window, location,
    HarinamShop: { currentUser: () => user, sessionReady },
    init() {}, show() {}, requestAnimationFrame: callback => callback(),
    setTimeout(callback, delay) { timers.push({ callback, delay }); },
    sessionStorage: {
      getItem(key) { if (storageFails) throw new Error('Blocked'); assert.equal(key, 'harinam-login-popup-shown'); return shown ? '1' : null; },
      setItem(key, value) { if (storageFails) throw new Error('Blocked'); assert.equal(key, 'harinam-login-popup-shown'); assert.equal(value, '1'); shown = true; },
    },
    fetch: async () => {
      requests++;
      if (fail) throw new Error("Offline");
      return { ok: true, text: async () => '<div id="auth-guest"></div>' };
    },
    DOMParser: class { parseFromString() { return { querySelector: () => root }; } },
  });
  const click = overrides => {
    const event = { target: { closest: () => ({ href: "https://harinamjoli.in/account.html" }) }, preventDefault() { this.prevented = true; }, ...overrides };
    document.fire("click", event);
    return event;
  };
  return { root, dialog, close, email, page, accountButton, window, location, click, timers, shown: () => shown, requests: () => requests, imports: () => imports, reveal() { document.hidden = false; return document.fire('visibilitychange'); }, closeOtherDialog() { otherDialog = false; return document.fire('close'); }, signIn() { user = {}; window.fire("harinam:account"); } };
};
const settled = () => new Promise(resolve => setImmediate(resolve));
for (const inline of [false, true]) {
  const f = fixture({ inline });
  assert.ok(!f.click({ ctrlKey: true }).prevented, "Modified links retain normal navigation");
  assert.equal(f.requests(), 0);
  f.click(); f.click();
  await settled();
  assert.ok(f.dialog.open && f.email.focused && f.accountButton.clicked);
  assert.ok(f.shown(), "Manual login also prevents a later automatic prompt in the visit");
  assert.equal(f.root.parentElement, f.dialog);
  assert.equal(f.requests(), inline ? 0 : 1, "Concurrent openings share one form request");
  f.close.fire("click");
  assert.ok(!f.dialog.open && f.accountButton.focused);
  assert.equal(f.root.parentElement, inline ? f.page : f.dialog, "The account page gets its form back after closing");
  f.click(); await settled();
  assert.ok(f.dialog.open);
  f.dialog.fire("click", { target: f.dialog });
  assert.ok(!f.dialog.open, "Backdrop click closes the popup");
  f.click(); await settled();
  f.signIn();
  assert.ok(!f.dialog.open, "Successful authentication closes the popup");
  assert.equal(f.imports(), inline ? 0 : 1, "Reopening never creates duplicate forms");
}
const offline = fixture({ fail: true });
offline.click(); await settled();
assert.equal(offline.location.href, "https://harinamjoli.in/account.html", "Unavailable popup content falls back to the account page");
const popupOnly = fixture({ inline: true, inlineHidden: true });
await popupOnly.window.HarinamAuth.open();
assert.ok(popupOnly.dialog.open && !popupOnly.root.hidden);
popupOnly.close.fire('click');
assert.ok(popupOnly.root.hidden && popupOnly.root.parentElement === popupOnly.page, 'The account route never reveals a separate inline login form after its popup closes');

const automatic = fixture();
assert.equal(automatic.timers.length, 1);
assert.equal(automatic.timers[0].delay, 10000, "Guest popup starts after ten seconds");
assert.equal(automatic.requests(), 0, "Do not open or load a popup before its delay");
await automatic.timers[0].callback();
assert.ok(automatic.dialog.open && automatic.email.focused);
assert.ok(automatic.shown(), "Remember the prompt only after the dialog opens");
automatic.close.fire('click');
await automatic.timers[0].callback();
assert.ok(!automatic.dialog.open, "Dismissing the popup prevents another automatic prompt on the same page");
automatic.click(); await settled();
assert.ok(automatic.dialog.open, "Manual account access still works after dismissal");

const returningGuest = fixture({ seen: true });
await returningGuest.timers[0].callback();
await returningGuest.reveal();
await returningGuest.closeOtherDialog();
assert.ok(!returningGuest.dialog.open && returningGuest.requests() === 0, 'Refreshes and other pages in the same visit do not repeat the automatic popup');
returningGuest.click(); await settled();
assert.ok(returningGuest.dialog.open, 'Returning guests can still open login themselves');
for (const options of [{ signedIn: true }, { hidden: true }, { otherDialog: true }]) {
  const skipped = fixture(options);
  await skipped.timers[0].callback();
  assert.equal(skipped.requests(), 0, `Do not interrupt an ineligible visit: ${JSON.stringify(options)}`);
  assert.ok(!skipped.shown(), "Deferred or signed-in visits do not consume the prompt");
}
const background = fixture({ hidden: true });
await background.timers[0].callback();
assert.equal(background.requests(), 0);
await background.reveal();
assert.ok(background.dialog.open, 'A background tab shows the due popup when the visitor returns');
const busy = fixture({ otherDialog: true });
await busy.timers[0].callback();
await busy.closeOtherDialog();
assert.ok(busy.dialog.open, 'A product modal must defer the login prompt rather than cancel it permanently');
const earlyVisibility = fixture({ hidden: true });
await earlyVisibility.reveal();
assert.equal(earlyVisibility.requests(), 0, 'Visibility changes cannot open the prompt before ten seconds');
const privateMode = fixture({ storageFails: true });
await privateMode.timers[0].callback();
assert.ok(!privateMode.dialog.open, "When a visit cannot be remembered, skip automatic prompts rather than repeat them on every page");
privateMode.click(); await settled();
assert.ok(privateMode.dialog.open, "Manual login still works when session storage is blocked");
const unavailable = fixture({ fail: true });
await unavailable.timers[0].callback();
assert.ok(!unavailable.dialog.open && !unavailable.location.href, "Automatic popup errors must not navigate away from shopping");
assert.ok(!unavailable.shown(), "A failed form request must not be recorded as an opened popup");
let resolveSession;
const delayed = fixture({ sessionReady: new Promise(resolve => { resolveSession = resolve; }) });
const delayedTimer = delayed.timers[0].callback();
await delayedTimer;
assert.ok(delayed.dialog.open, 'A slow session request cannot block the ten-second popup indefinitely');
delayed.signIn(); resolveSession(); await settled();
assert.ok(!delayed.dialog.open, 'An authenticated session arriving later immediately closes the guest prompt');
console.log("PASS: one automatic login popup per visit, no repeat on refresh/navigation, manual login, background/modal deferral, blocked storage, auth guards and offline fallback");
