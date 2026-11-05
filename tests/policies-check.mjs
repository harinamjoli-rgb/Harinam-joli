import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (file) => readFileSync(new URL(file, root), "utf8");
const policies = [
  ["privacy-policy", "Privacy Policy"],
  ["return-refund-policy", "Return, Refund &amp; Cancellation Policy"],
  ["shipping-delivery-policy", "Shipping &amp; Delivery Policy"],
  ["terms-and-conditions", "Terms and Conditions"],
];
const footerPages = ["store", "products", "product-details", "wishlist", "profile", "tracking", "about", "contact", "account", "cart", "checkout", ...policies.map(([slug]) => slug)];

for (const [slug, title] of policies) {
  const html = read(`${slug}.html`);
  assert.equal((html.match(/<h1>/g) || []).length, 1, `${slug}: one page heading`);
  assert.ok(html.includes(`<h1>${title}</h1>`), `${slug}: correct document title`);
  assert.ok(html.includes('href="css/policies.css?v=1"'), `${slug}: themed shared styles`);
  assert.ok(html.includes(`href="https://harinamjoli.in/${slug}"`), `${slug}: canonical route`);
  assert.doesNotMatch(html, /Lorem ipsum|\[insert|TODO|TBD/i, `${slug}: no unfinished customer copy`);
  const menu = html.match(/<nav class="policy-menu"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(menu?.includes(`href="${slug}.html" aria-current="page"`), `${slug}: active policy navigation`);
  assert.equal((menu.match(/aria-current="page"/g) || []).length, 1);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, new Set(ids).size, `${slug}: unique landmark and form IDs`);
  for (const [, href] of html.matchAll(/\bhref="([^"]+)"/g)) {
    if (href.startsWith("#")) assert.ok(ids.includes(href.slice(1)), `${slug}: working contents link ${href}`);
    else if (!href.startsWith("/") && !/^[a-z]+:/i.test(href))
      assert.ok(existsSync(new URL(href.split(/[?#]/)[0], root)), `${slug}: existing target ${href}`);
  }
  for (const [, src] of html.matchAll(/\bsrc="([^"]+)"/g)) {
    if (!/^[a-z]+:/i.test(src)) assert.ok(existsSync(new URL(src.split(/[?#]/)[0], root)), `${slug}: existing asset ${src}`);
  }
}

for (const page of footerPages) {
  const footer = read(`${page}.html`).split('<footer class="store-footer"')[1];
  assert.ok(footer, `${page}: shared footer exists`);
  for (const [slug, title] of policies)
    assert.ok(footer.includes(`<a href="${slug}.html">${title}</a>`), `${page}: working ${title} footer link`);
  assert.doesNotMatch(footer, /Policy documents are unpublished|aria-disabled="true"/, `${page}: policies are available`);
}

const checkout = read("checkout.html");
const review = checkout.slice(checkout.indexOf('data-checkout-step="review"'), checkout.indexOf('id="place-order"'));
for (const [slug] of policies) assert.ok(review.includes(`${slug}.html`), `Checkout: ${slug} visible before payment`);
const registration = read("account.html").split('id="create-form"')[1].split("</form>")[0];
for (const slug of ["privacy-policy", "terms-and-conditions"])
  assert.ok(registration.includes(`${slug}.html`), `Registration: ${slug} available`);
for (const slug of ["return-refund-policy", "shipping-delivery-policy"])
  assert.ok(read("cart.html").includes(`${slug}.html`), `Cart: ${slug} available`);
assert.ok(read("product-details.html").includes('href="terms-and-conditions.html">Terms &amp; Policies'));
assert.doesNotMatch(read("product-details.html"), /Free Shipping All order|24\/7 Support|TERAMS/);
const routes = policies.map(([slug]) => slug).join("|");
const htaccess = read(".htaccess");
assert.ok(htaccess.includes(`^(${routes})\\.html$ /$1 [R=301,L,NE]`), "Canonical policy redirects configured");
assert.ok(htaccess.includes(`^(${routes})/?$ $1.html [L,NC]`), "Clean policy routes configured");
console.log("PASS: four static policy pages, contents links, assets, shared footers and purchase/account policy links");

if (process.argv[2]) {
  const base = new URL(process.argv[2]);
  for (const [slug, title] of policies) {
    for (const route of [`/${slug}`, `/${slug}/`, `/${slug}.html`]) {
      const response = await fetch(new URL(route, base), { signal: AbortSignal.timeout(10000) });
      assert.equal(response.status, 200, `${route}: HTTP success`);
      assert.match(response.headers.get("content-type"), /text\/html/, `${route}: HTML response`);
      assert.ok((await response.text()).includes(`<h1>${title}</h1>`), `${route}: correct complete page`);
    }
  }
  console.log(`PASS: all policy URLs work with clean paths, trailing slashes and HTML filenames on ${base.origin}`);
}
