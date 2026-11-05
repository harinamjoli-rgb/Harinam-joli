import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL('../js/product-details.js', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('const escapeHTML ='), source.indexOf('const readWishlist ='));
const renderer = source.slice(source.indexOf('const renderRecommendations ='), source.indexOf('const selectImage ='));
const product = (id, extra = {}) => ({ id, name: `Bag ${id}`, category: 'Japa Bag', available: true, listed: true, image: '/bag.jpg', price: 499, oldPrice: 599, rating: 4, ...extra });
const render = (catalog, currentProduct = product(1)) => {
  const recommendationGrid = { innerHTML: '' };
  runInNewContext(`${helpers}\n${renderer}\nrenderRecommendations();`, {
    catalog, currentProduct, recommendationGrid, readWishlist: () => new Set(['2']),
  });
  return recommendationGrid.innerHTML;
};
const ids = html => [...html.matchAll(/data-product-id="([^"]+)"/g)].map(([, id]) => id);

const catalog = [product(1), product(2, { category: 'Books' }), product(3), product(4), product(5), product(6), product(7), product(8, { listed: false }), product(9, { available: false })];
const html = render(catalog);
assert.deepEqual(ids(html), ['3', '4', '5', '6', '7'], 'Prefer five related products without the current, hidden or unavailable product');
assert.deepEqual(catalog.map(p => p.id), [1,2,3,4,5,6,7,8,9], 'Ranking must not reorder the storefront catalog');
const filled = render([product(1), product(2, { category: 'Books' }), product(3), product(4, { category: 'Vastra' }), product(5), product(6, { category: 'Books' }), product(7)]);
assert.deepEqual(ids(filled), ['3', '5', '7', '2', '4'], 'Fill remaining slots from other listed products when the category has fewer than five');
assert.match(filled, /recommendation-heart active[^>]*aria-pressed="true"/);
assert.deepEqual(ids(render([product('1'), product(2), product(3)])), ['2', '3'], 'A three-product catalog must show two real recommendations without duplicates or invented products');
assert.equal(render([], null), '');
assert.deepEqual(ids(render([product(1)])), []);
const escaped = render([product(2, { name: '<script>alert(1)</script>' })]);
assert.ok(!escaped.includes('<script>') && escaped.includes('&lt;script&gt;'));
console.log('PASS: five distinct recommendations, category priority, real-catalog fallback, current/hidden/unavailable exclusion, wishlist state and safe rendering');
