import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../js/instagram.js", import.meta.url), "utf8");
const element = (tag = "div") => ({
  tag, children: [], attrs: {}, handlers: {}, paused: true,
  addEventListener(type, handler) { this.handlers[type] = handler; },
  setAttribute(name, value) { this.attrs[name] = value; },
  append(...children) { this.children.push(...children); },
  replaceChildren(...children) { this.children = children; },
  contains(value) { return this.children.includes(value); },
});
const fixture = async ({ reduced = false, posts, pages, offline = false, source: initialSource } = {}) => {
  const grid = Object.assign(element(), {
    scrollLeft: 0, scrollWidth: 2000, clientWidth: 1000,
    firstElementChild: { offsetWidth: 302 },
    querySelectorAll() { return this.children.filter(child => child.tag === "article").flatMap(child => child.children.filter(media => media.tag === "video")); },
    scrollBy({ left }) { this.scrollLeft = Math.max(0, Math.min(1000, this.scrollLeft + left)); },
  });
  grid.children = [element("a")];
  const previous = element("button"), next = element("button");
  const controls = { ".instagram-grid": grid, "[data-instagram-previous]": previous, "[data-instagram-next]": next };
  const section = { dataset: initialSource ? { instagramSource: initialSource } : {}, querySelector: selector => controls[selector] };
  const motion = Object.assign(element(), { matches: reduced });
  let frame;
  let now = 0;
  let request;
  const requests = [];
  const document = { hidden: false, querySelectorAll: () => [section], createElement: element };
  runInNewContext(source, {
    document, window: { HarinamConfig: { apiBase: "/api" } }, URL, AbortSignal,
    performance: { now: () => now },
    matchMedia: () => motion,
    getComputedStyle: () => ({ gap: "24px" }),
    ResizeObserver: class { constructor(callback) { this.callback = callback; } observe() { this.callback(); } },
    IntersectionObserver: class { constructor(callback) { this.callback = callback; } observe() { this.callback([{ isIntersecting: true }]); } },
    requestAnimationFrame(callback) { frame = callback; },
    async fetch(url, options) {
      request = { url, options };
      requests.push(url);
      if (offline) throw new Error("offline");
      return { ok: true, async json() { return pages ? pages[requests.length - 1] : { posts: posts || [] }; } };
    },
  });
  await new Promise(resolve => setImmediate(resolve));
  return { grid, previous, next, section, motion, document, request, requests, frame: time => { now = time; frame(time); } };
};

const gallery = await fixture({ offline: true });
assert.equal(gallery.grid.children.length, 1, "Keep gallery photos if the Instagram connection fails");
assert.equal(gallery.section.dataset.instagramSource, "gallery");
assert.equal(gallery.grid.attrs["aria-busy"], "false");
const curated = await fixture({ offline: true, source: "curated" });
assert.equal(curated.section.dataset.instagramSource, "curated", "Saved Instagram previews must remain available without the WordPress endpoint");
assert.equal(curated.grid.children.length, 1);
gallery.frame(100); gallery.frame(150);
assert.ok(gallery.grid.scrollLeft > 0, "Visible posts must move automatically");
const position = gallery.grid.scrollLeft;
gallery.grid.handlers.pointerenter({ pointerType: "mouse" });
gallery.frame(200);
assert.equal(gallery.grid.scrollLeft, position, "Hover must stop motion so a post can be selected");
gallery.grid.handlers.pointerleave();
gallery.next.handlers.click();
assert.equal(gallery.grid.scrollLeft, position + 326);
gallery.frame(300);
assert.equal(gallery.grid.scrollLeft, position + 326, "Manual navigation must have time to settle");
gallery.frame(6300);
assert.ok(gallery.grid.scrollLeft > position + 326);
gallery.document.hidden = true;
const hiddenPosition = gallery.grid.scrollLeft;
gallery.frame(6350);
assert.equal(gallery.grid.scrollLeft, hiddenPosition, "A background tab must not advance the feed");

const reduced = await fixture({ reduced: true });
reduced.frame(100); reduced.frame(150);
assert.equal(reduced.grid.scrollLeft, 0, "Reduced-motion visitors must opt in to automatic scrolling");

const live = await fixture({ posts: [
  { type: "IMAGE", url: "https://cdninstagram.com/photo.jpg", permalink: "https://www.instagram.com/p/photo/", caption: "A devotional bag" },
  { type: "VIDEO", url: "https://cdninstagram.com/reel.mp4", thumbnail: "https://cdninstagram.com/poster.jpg", permalink: "https://www.instagram.com/reel/video/" },
  { type: "IMAGE", url: "javascript:alert(1)", permalink: "https://www.instagram.com/p/invalid/" },
  { type: "IMAGE", url: "https://cdninstagram.com/photo.jpg", permalink: "https://evil.example/" },
  { type: "IMAGE", url: "https://graph.instagram.com/media?access_token=SECRET", permalink: "https://www.instagram.com/p/invalid/" },
] });
assert.equal(live.request.url, "/api/instagram");
assert.equal(live.request.options.credentials, "omit", "Public feed requests must not include storefront credentials");
assert.equal(live.section.dataset.instagramSource, "live");
assert.equal(live.grid.children.length, 2, "Reject unsafe media and post URLs");
const [photo, reel] = live.grid.children;
assert.equal(photo.href, "https://www.instagram.com/p/photo/");
assert.equal(photo.children[0].alt, "A devotional bag");
assert.equal(reel.tag, "article", "Reel controls must not be nested inside a link");
assert.equal(reel.children[0].controls, true);
assert.equal(reel.children[0].poster, "https://cdninstagram.com/poster.jpg");
reel.children[0].paused = false;
live.frame(100); live.frame(150);
assert.equal(live.grid.scrollLeft, 0, "Playing a reel must stop feed movement");

const post = { id: "1", type: "IMAGE", url: "https://cdninstagram.com/first.jpg", permalink: "https://www.instagram.com/p/first/" };
const older = { ...post, id: "2", url: "https://cdninstagram.com/older.jpg" };
const cursor = "a".repeat(32);
const paginated = await fixture({ pages: [{ posts: [post], next: cursor }, { posts: [post, older], next: cursor }] });
assert.deepEqual(paginated.requests, ["/api/instagram", `/api/instagram?cursor=${cursor}`]);
assert.equal(paginated.grid.children.length, 2, "Load older feed pages without duplicating posts or repeating a pagination cursor");

for (const page of ["store", "products", "product-details", "wishlist", "profile", "tracking"]) {
  const html = readFileSync(new URL(`../${page}.html`, import.meta.url), "utf8");
  assert.ok(html.includes('src="js/instagram.js?v=4"'), page);
  assert.ok(html.includes('href="css/instagram.css?v=5"'), page);
  assert.ok(!html.includes('data-instagram-toggle'), "No Play/Pause button should be shown");
  assert.equal((html.match(/data-instagram-feed/g) || []).length, 1, page);
  assert.ok(html.includes('data-instagram-source="curated"'), page);
  const previews = [...html.matchAll(/<a class="instagram-post-link instagram-preview" href="([^"]+)"[^>]*><img[^>]*src="([^"]+)"[^>]*>/g)];
  assert.equal(previews.length, 14, `${page}: Actual post and reel previews must be present before JavaScript or an API responds`);
  assert.equal(new Set(previews.map(([, link]) => link)).size, 14, `${page}: Each preview must open its own Instagram post`);
  assert.equal(previews.filter(([, link]) => link.includes('/reel/')).length, 5, `${page}: Include the five real reel previews`);
  for (const [, link, image] of previews) {
    assert.match(link, /^https:\/\/www\.instagram\.com\/(p|reel)\/[\w-]+\/$/);
    assert.ok(image.startsWith('assets/instagram/'), 'Serve durable local thumbnails instead of expiring Instagram CDN links');
    const bytes = readFileSync(new URL(`../${image}`, import.meta.url));
    assert.equal(bytes.subarray(0, 2).toString('hex'), 'ffd8', `${image}: A valid JPEG must exist`);
  }
  assert.ok(!html.includes('src="assets/instagram-post-5.jpg"'), "Do not present the Coming Soon placeholder as a live post");
}
console.log("PASS: 14 actual post/reel previews across 6 pages without login, distinct links, safe live media, auto-scroll and reduced motion");
