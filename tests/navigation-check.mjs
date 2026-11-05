import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { runInNewContext } from "node:vm";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const shop = read("js/shop.js");
const source = shop.slice(shop.indexOf("  const ensureNavigation ="), shop.indexOf("  const ensureAccountMenu ="));

for (const menuId of ["home-nav-menu", "nav-menu"]) {
  const events = () => ({
    handlers: {},
    addEventListener(type, handler) { this.handlers[type] = handler; },
    fire(type, event = {}) { this.handlers[type](event); },
  });
  const button = {
    ...events(),
    attrs: { "aria-controls": menuId },
    getAttribute(name) { return this.attrs[name]; },
    setAttribute(name, value) { this.attrs[name] = value; },
    focus() { this.focused = true; },
  };
  const summary = { ...events(), focus() { this.focused = true; } };
  const categoryLink = events();
  const category = { ...events(), querySelector: () => categoryLink };
  const dropdown = { open: false, querySelector: () => summary, closest: () => category };
  const classes = new Set();
  const menu = {
    ...events(),
    querySelector: () => dropdown,
    classList: {
      contains: (name) => classes.has(name),
      remove: (name) => classes.delete(name),
      toggle: (name, open) => open ? classes.add(name) : classes.delete(name),
    },
  };
  const document = {
    ...events(),
    querySelector: () => button,
    getElementById(id) { assert.equal(id, menuId); return menu; },
  };
  runInNewContext(`${source}\nensureNavigation();`, { document });
  assert.equal(category.handlers.pointerenter, undefined, "Hovering the category wrapper must not open the submenu");
  summary.fire("pointerenter", { pointerType: "mouse" });
  assert.ok(dropdown.open);
  let prevented = false;
  summary.fire("click", { detail: 1, preventDefault() { prevented = true; } });
  assert.ok(prevented && dropdown.open, "Clicking the hovered arrow must keep it open");
  categoryLink.fire("pointerenter");
  assert.ok(!dropdown.open, "Hovering the Japa Bags text must close the submenu");
  summary.fire("pointerenter", { pointerType: "mouse" });
  category.fire("pointerleave", { pointerType: "mouse" });
  assert.ok(!dropdown.open, "Moving beside the category must close the submenu");
  summary.fire("pointerenter", { pointerType: "touch" });
  assert.ok(!dropdown.open, "Touch must use the native summary click instead of hover");
  prevented = false;
  summary.fire("click", { detail: 1, preventDefault() { prevented = true; } });
  assert.ok(!prevented);
  summary.fire("pointerenter", { pointerType: "mouse" });
  prevented = false;
  summary.fire("click", { detail: 0, preventDefault() { prevented = true; } });
  assert.ok(!prevented, "Keyboard activation must retain native toggle behavior");
  button.fire("click");
  assert.equal(button.attrs["aria-expanded"], "true");
  assert.ok(classes.has("open"));
  dropdown.open = true;
  document.fire("click", { target: { closest: selector => selector === ".navbar" ? {} : null } });
  assert.ok(!dropdown.open && classes.has("open"), "Clicking header space must close only the submenu");
  dropdown.open = true;
  menu.fire("click", { target: { closest: () => null } });
  assert.ok(dropdown.open, "Opening the dropdown must keep the mobile menu open");
  document.fire("keydown", { key: "Escape" });
  assert.ok(!dropdown.open && summary.focused);
  assert.ok(classes.has("open"), "First Escape closes only the dropdown");
  document.fire("keydown", { key: "Escape" });
  assert.ok(!classes.has("open") && button.focused);
  button.fire("click");
  dropdown.open = true;
  menu.fire("click", { target: { closest: () => ({}) } });
  assert.ok(!classes.has("open") && !dropdown.open);
  button.fire("click");
  document.fire("click", { target: { closest: () => null } });
  assert.equal(button.attrs["aria-expanded"], "false");
}

for (const page of ["store", "products", "product-details", "wishlist", "profile", "tracking", "cart", "checkout", "account", "about", "contact"]) {
  const html = read(`${page}.html`);
  assert.equal((html.match(/<details class="nav-dropdown">/g) || []).length, 1, page);
  assert.ok(html.includes('<a class="nav-category-link" href="products.html?category=Japa%20Bag">JAPA BAGS</a>'), page);
  assert.ok(html.includes('<summary aria-label="Open Japa Bags submenu"><img'), page);
  assert.match(html, /src="assets\/nav-menu\.svg(?:\?[^\"]*)?"/, page);
  assert.match(html, /src="assets\/nav-arrow-down\.svg(?:\?[^\"]*)?" width="14" height="14"/, page);
  assert.ok(html.includes('href="products.html?category=Digital%20Print"'), page);
  assert.ok(html.slice(0, html.indexOf("</nav>")).includes('href="products.html?category=Books">BOOKS</a>'), page);
  assert.ok(html.slice(0, html.indexOf("</nav>")).includes('href="contact.html"'), page);
  if (!["about", "contact"].includes(page))
    assert.ok(!read(`js/${page === "store" ? "script" : page}.js`).includes('classList.toggle("open")'), page);
}
for (const asset of ["nav-menu.svg", "nav-arrow-down.svg"]) {
  assert.ok(statSync(new URL(`../assets/${asset}`, import.meta.url)).size > 0);
}
console.log("PASS: shared header links, assets, mobile toggle, dropdown, outside click and Escape");
