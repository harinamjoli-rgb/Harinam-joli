import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const script = read("js/auth.js");
const formsSource = script.slice(script.indexOf("  const initialized ="), script.indexOf("  let authDialog;"));
const node = () => ({
  attrs: {}, handlers: {}, classes: new Set(), hidden: false,
  addEventListener(name, handler) { (this.handlers[name] ||= []).push(handler); },
  setAttribute(name, value) { this.attrs[name] = value; },
  focus() { this.focused = true; },
  fire(name, event = {}) { return this.handlers[name]?.[0]({ preventDefault() {}, ...event }); },
  get classList() { return { toggle: (name, active) => active ? this.classes.add(name) : this.classes.delete(name), add: name => this.classes.add(name), remove: name => this.classes.delete(name) }; },
});
const field = (value = "", type = "text") => ({ ...node(), value, type });
const makeForm = id => {
  const button = { ...node(), textContent: id === "login" ? "Login" : id === "create" ? "Create Account" : "Send reset link", disabled: false };
  const message = { ...node(), textContent: "" };
  return {
    ...node(), id: `${id}-form`, button, message,
    elements: { email: field("devotee@example.com", "email"), name: field("Test Devotee"), password: field("example-password", "password"), confirmPassword: field("example-password", "password") },
    querySelector(selector) { return selector === "button[type=submit]" ? button : message; },
  };
};
const forms = [makeForm("login"), makeForm("create"), makeForm("reset-request")];
const tabs = ["login", "create"].map(view => ({ ...node(), dataset: { authTab: view } }));
const passwordToggle = { ...node(), dataset: { passwordToggle: "login-password" }, textContent: "Show" };
const tablist = node(), forgot = node(), back = node();
const lookup = { "#login-form": forms[0], "#create-form": forms[1], "#reset-request-form": forms[2], "#login-password": forms[0].elements.password, "#forgot-password-button": forgot, ".auth-tabs": tablist };
const root = {
  querySelector: selector => lookup[selector],
  querySelectorAll: selector => selector === "[data-auth-tab]" ? tabs : selector === ".auth-form" ? forms : selector === "[data-password-toggle]" ? [passwordToggle] : [back],
};
const calls = [];
let resolveLogin, loginFails = false;
const shop = {
  signIn(values) {
    calls.push(["login", values]);
    if (loginFails) return Promise.reject(new Error("Email or password is incorrect."));
    return new Promise(resolve => { resolveLogin = resolve; });
  },
  async createUser(values) { calls.push(["create", values]); return { name: values.name }; },
  async requestPasswordReset(email) { calls.push(["reset", email]); return { message: "Please check your email." }; },
};
const window = {};
runInNewContext(formsSource, {
  window, HarinamShop: shop,
  FormData: class { constructor(form) { this.form = form; } [Symbol.iterator]() { return Object.entries(this.form.elements).map(([name, input]) => [name, input.value])[Symbol.iterator](); } },
});
let succeeded = 0;
window.HarinamAuth.init(root);
window.HarinamAuth.init(root, () => { succeeded++; });
assert.equal(forms[0].handlers.submit.length, 1, "Popup reuse never duplicates authentication requests");
assert.ok(!forms[0].hidden && forms[1].hidden);
tabs[1].fire("click");
assert.ok(forms[0].hidden && !forms[1].hidden);
assert.equal(tabs[1].tabIndex, 0);
tabs[1].fire("keydown", { key: "ArrowRight" });
assert.ok(tabs[0].focused && !forms[0].hidden);
passwordToggle.fire("click");
assert.equal(forms[0].elements.password.type, "text");
assert.equal(passwordToggle.attrs["aria-label"], "Hide password");
passwordToggle.fire("click");
assert.equal(forms[0].elements.password.type, "password");
forgot.fire("click");
assert.equal(forms[2].elements.email.value, "devotee@example.com");
assert.ok(tablist.hidden && !forms[2].hidden);
back.fire("click");
assert.ok(!tablist.hidden && !forms[0].hidden);

const pending = forms[0].fire("submit", { currentTarget: forms[0] });
assert.ok(forms[0].button.disabled);
assert.equal(forms[0].button.textContent, "Signing in…");
await forms[0].fire("submit", { currentTarget: forms[0] });
assert.equal(calls.length, 1, "A pending request blocks duplicate submissions");
resolveLogin({ name: "Test Devotee" });
await pending;
assert.equal(succeeded, 1, "The account page callback survives initialization by the popup");
assert.ok(!forms[0].button.disabled);
assert.equal(forms[0].button.textContent, "Login");
loginFails = true;
await forms[0].fire("submit", { currentTarget: forms[0] });
assert.equal(forms[0].message.textContent, "Email or password is incorrect.");
assert.ok(!forms[0].message.classes.has("success") && !forms[0].button.disabled);
forms[1].elements.confirmPassword.value = "different-password";
await forms[1].fire("submit", { currentTarget: forms[1] });
assert.equal(forms[1].message.textContent, "Passwords do not match.");
assert.ok(!calls.some(([action]) => action === "create"), "A mismatched confirmation never reaches registration");
forms[1].elements.confirmPassword.value = forms[1].elements.password.value;
await forms[1].fire("submit", { currentTarget: forms[1] });
assert.equal(succeeded, 2);
await forms[2].fire("submit", { currentTarget: forms[2] });
assert.equal(forms[2].message.textContent, "Please check your email.");
assert.equal(succeeded, 2, "A reset request must not be treated as authentication");
assert.ok(calls.some(([action, email]) => action === "reset" && email === "devotee@example.com"));

const account = read("account.html");
for (const id of ["login", "create", "reset-request"])
  assert.match(account, new RegExp(`id="${id}-form" method="post"`), "No password can fall back to a query-string submission");
assert.match(account, /autocomplete="current-password"/);
assert.match(account, /autocomplete="new-password"[^>]*minlength="8"/);
assert.ok(read("js/account.js").includes('returnTo && /^[a-z0-9_-]+\\.html(?:\\?.*)?$/i.test(returnTo)'), "Existing return-route validation remains in place");
for (const page of ["store", "products", "product-details", "about", "contact", "account", "cart", "checkout", "wishlist", "profile", "tracking", "privacy-policy", "return-refund-policy", "shipping-delivery-policy", "terms-and-conditions"]) {
  const html = read(`${page}.html`);
  assert.ok(html.includes('href="css/auth.css?v=4"'), `${page}: shared auth design`);
  assert.ok(html.includes('src="js/auth.js?v=6"'), `${page}: shared popup behavior`);
  assert.ok(html.indexOf('js/auth.js') > html.indexOf('js/shop.js'), `${page}: API ready before auth binding`);
}
console.log("PASS: shared auth views, keyboard tabs, password visibility, duplicate requests, signup mismatch, errors, reset and protected returns");
