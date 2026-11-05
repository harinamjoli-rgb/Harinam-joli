import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { runInNewContext } from "node:vm";

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const pages = ["store", "products", "product-details", "wishlist", "profile", "tracking", "about", "contact", "account", "cart", "checkout", "privacy-policy", "return-refund-policy", "shipping-delivery-policy", "terms-and-conditions"];
for (const page of pages) {
  const html = read(`${page}.html`);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, `${page}: unique IDs keep header and checkout messages separate`);
  assert.match(html, /<body class="[^"]*storefront-page/, page);
  assert.match(html, /<nav class="navbar storefront-nav"/, page);
  const header = html.split('<nav class="navbar storefront-nav"')[1].split('</nav>')[0];
  assert.ok(header.includes('src="assets/header-logo-horizontal.png?v=1"'), `${page}: supplied horizontal header logo`);
  assert.equal((html.match(/shipping-arrow"/g) || []).length, 2, `${page}: announcement controls`);
  assert.equal((html.match(/<footer class="store-footer"/g) || []).length, 1, `${page}: shared footer`);
  assert.ok(html.indexOf("css/storefront.css") > html.indexOf("css/footer.css"), `${page}: shared styles take precedence`);
  assert.ok(html.indexOf("js/storefront.js") > html.indexOf("js/shop.js"), `${page}: navigation follows application setup`);
  for (const [, path] of html.matchAll(/(?:src|href)="((?:css|js)\/[^"?]+)/g))
    assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), `${page}: asset ${path}`);
}
const links = [
  ["/", "home"], ["products.html", "all"], ["products.html?category=Japa%20Bag", "japa"],
  ["products.html?category=Japa%20Bag", "japa-sub"], ["products.html?category=Digital%20Print", "digital"],
  ["products.html?category=Books", "books"], ["contact.html", "contact"],
].map(([href, id]) => ({
  href: new URL(href, "https://harinamjoli.in/").href, id, active: false, attrs: {},
  classList: { contains: name => id === "japa" && name === "nav-category-link", toggle(name, value) { links.find(link => link.id === id).active = value; } },
  setAttribute(name, value) { this.attrs[name] = value; },
  removeAttribute(name) { delete this.attrs[name]; },
}));
const location = { href: "https://harinamjoli.in/" };
const handlers = {};
runInNewContext(read("js/storefront.js"), {
  URL, location,
  document: { querySelectorAll: () => links },
  window: { addEventListener(name, handler) { handlers[name] = handler; } },
});
for (const [route, selected] of [
  ["/", ["home"]], ["/store.html", ["home"]], ["/products.html", ["all"]],
  ["/products/?search=bag", ["all"]], ["/products?category=Japa%20Bag", ["japa", "japa-sub"]],
  ["/products.html?category=Digital%20Print", ["japa", "digital"]],
  ["/products?category=Books", ["books"]], ["/contact.html", ["contact"]], ["/privacy-policy", []],
]) {
  location.href = `https://harinamjoli.in${route}`;
  handlers["harinam:catalog-route"]();
  assert.deepEqual(links.filter(link => link.active).map(link => link.id), selected, route);
  assert.equal(links.find(link => link.id === "japa").attrs["aria-current"], selected.includes("digital") ? undefined : selected.includes("japa") ? "page" : undefined);
}
location.href = "https://harinamjoli.in/products?category=Books";
handlers.popstate();
assert.ok(links.find(link => link.id === "books").active, "Back/forward updates the active category");
for (const type of ['navigate', 'back_forward', 'reload']) {
  const scrolls = [], smoothScrolls = [], lifecycle = {}, history = { scrollRestoration: 'auto' };
  let frame;
  class Lenis { scrollTo(position, options) { smoothScrolls.push([position, options]); } }
  runInNewContext(read('js/storefront.js'), {
    URL, location, Lenis,
    document: { querySelectorAll: () => links },
    window: { Lenis, history, performance: { getEntriesByType: () => [{ type }] }, scrollTo: options => scrolls.push(options), addEventListener(name, handler) { lifecycle[name] = handler; } },
    requestAnimationFrame(callback) { frame = callback; },
  });
  assert.equal(scrolls.length, type === 'reload' ? 1 : 0, 'Only a refresh resets scrolling; normal navigation and browser Back retain their behavior');
  if (type === 'reload') {
    assert.equal(history.scrollRestoration, 'manual');
    lifecycle.pageshow(); frame();
    assert.equal(history.scrollRestoration, 'auto', 'Restore normal history behavior after the refresh');
    assert.equal(scrolls.length, 2);
    assert.ok(scrolls.every(options => options.top === 0 && options.left === 0 && options.behavior === 'instant'));
    assert.ok(smoothScrolls.every(([position, options]) => position === 0 && options.immediate && options.force));
  }
}
console.log("PASS: shared shell on 15 pages; clean/HTML routes, parent category and browser navigation");

const heroSource = read("js/script.js").split("const whySlides =")[0];
for (const count of [1, 2]) {
  let advance;
  const slides = Array.from({ length: count }, (_, i) => {
    const classes = new Set(i === 0 ? ["is-active"] : []);
    return { classes, classList: { add: name => classes.add(name), remove: name => classes.delete(name) } };
  });
  runInNewContext(heroSource, {
    document: { querySelectorAll: () => slides },
    setInterval(handler) { advance = handler; }, setTimeout() {},
  });
  if (count === 1) assert.equal(advance, undefined, "A single home image stays stable");
  else {
    advance();
    assert.ok(!slides[0].classes.has("is-active") && slides[1].classes.has("is-active"));
  }
}

if (process.argv[2]) {
  const base = new URL(process.argv[2]);
  for (const page of pages) {
    const clean = page === "store" ? "/" : page === "product-details" ? "/product" : `/${page}`;
    for (const route of new Set([clean, `${clean.replace(/\/$/, "")}/`, `/${page}.html`])) {
      const response = await fetch(new URL(route, base), { signal: AbortSignal.timeout(10000) });
      assert.equal(response.status, 200, route);
      const html = await response.text();
      assert.ok(html.includes('class="navbar storefront-nav"'), `${route}: correct storefront document`);
      assert.ok(!new URL(response.url).pathname.endsWith("/") || clean === "/", `${route}: nested relative assets remain valid`);
    }
  }
  for (const path of ["/css/storefront.css?v=3", "/js/storefront.js?v=3", "/assets/header-logo-horizontal.png?v=1", "/css/vendor/lenis-1.3.27.css", "/js/vendor/lenis-1.3.27.min.js"])
    assert.equal((await fetch(new URL(path, base))).status, 200, path);
  console.log(`PASS: all storefront routes, canonical trailing slash redirects and shared assets on ${base.origin}`);
}
