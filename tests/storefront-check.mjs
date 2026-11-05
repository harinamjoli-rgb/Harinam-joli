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
const heroFixture = (count, reduced = false) => {
  let advance;
  const timeouts = [];
  const slides = Array.from({ length: count }, (_, i) => {
    const classes = new Set(i === 0 ? ["is-active"] : []);
    return {
      classes, attrs: { "aria-hidden": String(i !== 0) }, inert: i !== 0,
      classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
      setAttribute(name, value) { this.attrs[name] = value; },
    };
  });
  const link = {
    attrs: {}, handlers: {}, interacting: false,
    matches() { return this.interacting; },
    setAttribute(name, value) { this.attrs[name] = value; },
    addEventListener(name, handler) { this.handlers[name] = handler; },
  };
  const motion = { matches: reduced, addEventListener(name, handler) { this.change = handler; } };
  const document = { hidden: false, querySelectorAll: () => slides, querySelector: () => link };
  runInNewContext(heroSource, {
    document, matchMedia: () => motion,
    setInterval(handler, delay) { assert.equal(delay, 5000); advance = handler; },
    setTimeout(handler) { timeouts.push(handler); },
  });
  return { slides, link, motion, document, advance, finishTransition: () => timeouts.splice(0).forEach(handler => handler()) };
};
for (const count of [1, 2, 3]) {
  const slider = heroFixture(count);
  if (count === 1) assert.equal(slider.advance, undefined, "A single home image stays stable");
  else {
    for (let step = 1; step <= count * 2; step++) {
      slider.advance();
      assert.deepEqual(slider.slides.flatMap((slide, i) => slide.classes.has("is-active") ? [i] : []), [step % count], "Banners advance in order and wrap to the first");
      assert.equal(slider.slides.filter(slide => slide.attrs["aria-hidden"] === "false").length, 1, "Only the current banner is exposed to screen readers");
      assert.deepEqual(slider.slides.flatMap((slide, i) => !slide.inert ? [i] : []), [step % count], "Only the active banner's category link is interactive");
      slider.finishTransition();
      assert.ok(slider.slides.every(slide => !slide.classes.has("is-before")), "Outgoing banners reset before the next transition");
    }
  }
}
const pausedHero = heroFixture(3);
let spacePrevented = false;
const space = { code: "Space", preventDefault() { spacePrevented = true; } };
pausedHero.link.handlers.keydown(space);
pausedHero.advance();
assert.ok(spacePrevented && pausedHero.slides[0].classes.has("is-active"), "Keyboard users can pause without a visible button");
assert.match(pausedHero.link.attrs["aria-label"], /resume/);
pausedHero.link.handlers.keydown(space);
pausedHero.advance();
assert.ok(pausedHero.slides[1].classes.has("is-active"), "Keyboard play resumes rotation");
pausedHero.finishTransition();
pausedHero.link.interacting = true;
pausedHero.advance();
assert.ok(pausedHero.slides[1].classes.has("is-active"), "Hover and keyboard focus pause the banner");
pausedHero.link.interacting = false;
pausedHero.document.hidden = true;
pausedHero.advance();
assert.ok(pausedHero.slides[1].classes.has("is-active"), "Hidden tabs do not advance banners");
const reducedHero = heroFixture(3, true);
reducedHero.advance();
assert.ok(reducedHero.slides[0].classes.has("is-active"), "Reduced-motion visitors do not get autoplay");
reducedHero.motion.change({ matches: false });
reducedHero.advance();
assert.ok(reducedHero.slides[1].classes.has("is-active"), "Motion-preference changes are respected");
const heroMarkup = read("store.html").match(/<section class="hero"[\s\S]*?<\/section>/)[0];
const banners = [...heroMarkup.matchAll(/<img[^>]+src="([^"]+)"/g)].map(match => match[1]);
assert.deepEqual(banners, ["assets/home-banner-1.jpg", "assets/home-banner-2.jpg", "assets/home-banner-3.jpg"]);
for (const banner of banners) assert.ok(existsSync(new URL(`../${banner}`, import.meta.url)), banner);
assert.doesNotMatch(heroMarkup, /<button\b/, "The requested banner has no visible controls");
const heroLinks = [...heroMarkup.matchAll(/<a class="hero-link" href="([^"]+)"[^>]*><\/a>/g)].map(match => match[1]);
assert.deepEqual(heroLinks, Array(3).fill("products.html?category=Digital%20Print"), "Each Shop Collection hotspot opens the products' assigned Digital Print category");
assert.equal((heroMarkup.match(/<a\b/g) || []).length, 3, "Only the three button hotspots are linked; images have no enclosing link");
const heroCss = read("css/home-figma.css").match(/\.site \.hero-link \{([^}]+)\}/)[1];
for (const rule of ["left: 15%", "top: 81.67%", "width: 19.8%", "height: 8.67%"]) assert.ok(heroCss.includes(rule), `The link stays on the printed Shop Collection button: ${rule}`);
console.log("PASS: three banners, category button hotspots only, five-second looping slides, keyboard pause, focus and reduced motion");

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
