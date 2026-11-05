import { readFileSync } from "node:fs";

const plugin = readFileSync(
  new URL("../wordpress-plugin/harinam-store-api/harinam-store-api.php", import.meta.url),
  "utf8",
);
const htaccess = readFileSync(new URL("../.htaccess", import.meta.url), "utf8");
const shop = readFileSync(new URL("../js/shop.js", import.meta.url), "utf8");
const checkout = readFileSync(
  new URL("../js/checkout.js", import.meta.url),
  "utf8",
);
const checkoutHtml = readFileSync(
  new URL("../checkout.html", import.meta.url),
  "utf8",
);
const cart = readFileSync(new URL("../js/cart.js", import.meta.url), "utf8");
const flows = readFileSync(new URL("../css/flows.css", import.meta.url), "utf8");
const shopCss = readFileSync(new URL("../css/shop.css", import.meta.url), "utf8");
const home = readFileSync(new URL("../store.html", import.meta.url), "utf8");
const homeCss = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const footerCss = readFileSync(new URL("../css/footer.css", import.meta.url), "utf8");
const homeScript = readFileSync(new URL("../js/script.js", import.meta.url), "utf8");
const storefrontScript = readFileSync(new URL("../js/storefront.js", import.meta.url), "utf8");
const devServer = readFileSync(new URL("../dev-server.mjs", import.meta.url), "utf8");
const productsCss = readFileSync(
  new URL("../css/products.css", import.meta.url),
  "utf8",
);
const productDetails = readFileSync(
  new URL("../js/product-details.js", import.meta.url),
  "utf8",
);
const productDetailsCss = readFileSync(
  new URL("../css/product-details.css", import.meta.url),
  "utf8",
);
const footerPages = [
  "store.html",
  "products.html",
  "product-details.html",
  "wishlist.html",
  "profile.html",
  "tracking.html",
  "about.html",
  "contact.html",
  "privacy-policy.html",
  "return-refund-policy.html",
  "shipping-delivery-policy.html",
  "terms-and-conditions.html",
].map((file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));

const checks = {
  "home banner rotates only when multiple slides exist": homeScript.includes("if (heroSlides.length > 1) setInterval(advanceHero, 5000)"),
  "explicit index.html redirects to canonical home":
    htaccess.includes("%{THE_REQUEST}") &&
    htaccess.includes("RewriteRule ^index\\.html$ / [R=301,L]"),
  "public pages use clean browser URLs":
    htaccess.includes("(about|account|cart|checkout|contact|products|profile|tracking|wishlist)\\.html$") &&
    htaccess.includes("RewriteRule ^product-details\\.html$ /product") &&
    htaccess.includes("RewriteRule ^product/?$ product-details.html"),
  "home banner always exits left": homeCss.includes(".hero-slide:not(.is-active):not(.is-before)") && homeCss.includes("transition: none"),
  "shared page scrolling uses the reference smooth-scroll behavior":
    home.includes("js/vendor/lenis-1.3.27.min.js") &&
    storefrontScript.includes("autoRaf: true") && storefrontScript.includes("allowNestedScroll: true"),
  "why images rotate smoothly": home.includes("why-slide") && homeScript.includes("whyIndex") && homeScript.includes("}, 4000)"),
  "testimonials use one live review row":
    (home.match(/class="review-row/g) || []).length === 1 &&
    !home.includes("review-row-two") &&
    homeScript.includes("product.reviews || []") &&
    homeScript.includes('textContent = "Website"'),
  "special choices video opens in a modal":
    home.includes('src="assets/some-special-choices.mp4"') &&
    home.includes('class="video-dialog"') &&
    homeScript.includes("videoDialog.showModal()") &&
    homeScript.includes("devotionalVideo.pause()"),
  "versioned REST namespace": plugin.includes("harinam/v1"),
  "exact storefront CORS origin": plugin.includes("https://harinamjoli.in"),
  "offline gateways removed": ["cod", "cheque", "bacs"].every((id) =>
    plugin.includes(`'${id}'`),
  ),
  "Paytm and PayPal gateway IDs": ["'paytm'", "'ppcp-gateway'"].every((id) =>
    plugin.includes(id),
  ),
  "no duplicate payment gateway class": !plugin.includes("extends WC_Payment_Gateway"),
  "server currency rules": ["harinam_india_currency_blocker", "harinam_paypal_currency_blocker"].every(
    (code) => plugin.includes(code),
  ),
  "pending-payment order": plugin.includes("'status' => 'pending'"),
  "WooCommerce stock reservation": plugin.includes("wc_reserve_stock_for_order"),
  "idempotency lock": plugin.includes("add_option( $option"),
  "verified paid-state check": plugin.includes("$order->is_paid()"),
  "customer ownership check": plugin.includes("$order->get_customer_id()"),
  "storefront auth accepts only WooCommerce customers":
    plugin.includes("function harinam_store_api_is_customer") &&
    plugin.includes("is_user_logged_in() && harinam_store_api_is_customer()") &&
    plugin.includes("harinam_store_api_is_customer() ? get_current_user_id() : 0") &&
    plugin.includes("! $candidate || ! harinam_store_api_is_customer( $candidate->ID )"),
  "credentialed frontend fetch": shop.includes('credentials: "include"'),
  "local proxy retries only safe reads":
    devServer.includes('const attempts = ["GET", "HEAD"].includes(request.method) ? 3 : 1') &&
    devServer.includes("if (attempt === attempts) throw error"),
  "announcement messages rotate automatically":
    shop.includes("ensureAnnouncementSlider") &&
    shop.includes('className = "announcement-track"') &&
    shop.includes('}, 5000)') && !shop.includes('className = "announcement-toggle"'),
  "stored cart refreshes live price token":
    shop.includes("priceToken: selected.priceToken") &&
    shop.includes("getCart().flatMap"),
  "REST nonce header": shop.includes('headers["X-WP-Nonce"]'),
  "no local demo catalog": !shop.includes("jagannath-1"),
  "Woo featured image and gallery API":
    plugin.includes("$product->get_image_id()") &&
    plugin.includes("$product->get_gallery_image_ids()") &&
    plugin.includes("'images'      => array_values( array_unique( $images ) )"),
  "product detail gallery renderer":
    productDetails.includes("Array.isArray(product.images)") &&
    productDetails.includes('class="detail-thumbnail'),
  "separate short and full product descriptions":
    plugin.includes("'shortDescription' => wp_strip_all_tags( $product->get_short_description() )") &&
    plugin.includes("'fullDescription'  => wp_strip_all_tags( $product->get_description() )") &&
    productDetails.includes("product.shortDescription || product.description") &&
    productDetails.includes("product.fullDescription || product.description"),
  "Instagram tiles open store profile":
    shop.includes(".instagram-grid > img, .instagram-grid > video") &&
    shop.includes("https://www.instagram.com/harinamjoli/"),
  "footer social content is consistent": footerPages.every(
    (page) =>
      page.includes(">@harinamjoli<") &&
      page.includes("assets/tracking-instagram.svg") &&
      page.includes('aria-label="Chat with Harinam Joli on WhatsApp"') &&
      !page.slice(page.indexOf('<footer class="store-footer"')).includes('href="#footer"'),
  ),
  "shared footer uses the same logo and support contacts": footerPages.every(
    (page) => page.includes('class="store-footer"') &&
      page.includes('href="css/footer.css?v=13"') &&
      page.includes('href="mailto:harinamjoli@gmail.com"') &&
      page.includes('src="assets/footer-emblem.png"') &&
      page.includes('src="assets/footer-wordmark.png"'),
  ),
  "home header uses the supplied horizontal logo and shared styles":
    home.includes('src="assets/header-logo-horizontal.png?v=1"') &&
    /href="css\/storefront\.css(?:\?[^"]*)?"/.test(home),
  "small mobile footer cannot widen the page":
    footerCss.includes("repeat(2, minmax(0, 1fr))") &&
    footerCss.includes("overflow-wrap: anywhere") &&
    footerCss.includes("width: calc(100% - 32px)"),
  "small product detail stays inside viewport":
    productDetailsCss.includes(".detail-payments > div") &&
    productDetailsCss.includes("justify-content: center"),
  "secure checkout CTA": checkoutHtml.includes("Proceed to Secure Payment"),
  "no COD checkout copy": !checkoutHtml.match(/cash on delivery|cod order/i),
  "verified return copy": checkout.includes("No payment success is assumed"),
  "empty cart centered": cart.includes('classList.toggle("is-empty"') && flows.includes(".cart-layout.is-empty"),
  "header cart uses fresh page": home.includes('href="cart.html?v=2"'),
  "shared header dimensions": shopCss.includes(".site-header + .navbar") && shopCss.includes(".site > .navbar"),
  "home navigation remains sticky": homeCss.includes("overflow: clip") && homeCss.includes("position: sticky"),
  "desktop landing keeps fixed design proportions":
    homeCss.includes("@media (min-width: 1051px) and (max-width: 1919px)") &&
    homeCss.includes("--site-scale: calc(100vw / 1440px)") &&
    homeCss.includes("zoom: var(--site-scale)") &&
    homeCss.includes("@media (max-width: 1050px)"),
  "WhatsApp support floats across storefront":
    shop.includes("https://wa.me/919913032130") &&
    shop.includes("assets/whatsapp-logo.png") &&
    shop.includes("ensureWhatsApp()") &&
    shopCss.includes(".whatsapp-float") &&
    shopCss.includes("position: fixed"),
};

let failed = false;
for (const [name, passed] of Object.entries(checks)) {
  console.log(`${passed ? "PASS" : "FAIL"}: ${name}`);
  failed ||= !passed;
}
if (failed) process.exitCode = 1;
