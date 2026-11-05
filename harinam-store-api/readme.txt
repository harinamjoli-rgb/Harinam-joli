=== Harinam Store API ===
Contributors: harinamjoli
Tags: woocommerce, rest-api, headless, paytm, paypal
Requires at least: 6.5
Requires PHP: 7.4
Stable tag: 1.0.2
License: GPLv2 or later

Secure WooCommerce API for the static storefront at https://harinamjoli.in.

== Requirements ==

* WordPress and WooCommerce on https://admin.harinamjoli.in.
* HTTPS on both domains.
* Official Paytm Payment Gateway plugin (WordPress.org slug: paytm-payments), enabled and configured for INR orders.
* Official WooCommerce PayPal Payments plugin, with the PayPal wallet gateway ID ppcp-gateway enabled and connected.
* An existing WooCommerce-compatible multi-currency plugin if international orders must use a currency other than the store currency. This plugin never converts currency.

== Installation ==

1. In WordPress Admin open Plugins > Add New > Upload Plugin.
2. Upload harinam-store-api.zip, select Install Now, then Activate.
3. Open WooCommerce > Settings > Payments and configure Paytm and WooCommerce PayPal Payments.
4. Open WooCommerce > Settings > General and confirm the selling/shipping countries, tax settings, store currency, and customer address defaults.
5. Open WooCommerce > Settings > Shipping and configure zones and methods for every supported country.
6. Upload the changed static frontend files to https://harinamjoli.in and clear all WordPress, CDN and browser caches.

No products, customers, orders or settings are created, changed, or deleted on plugin activation/deactivation/uninstall.

== Payment routing ==

* Validated shipping country IN: Paytm only; active WooCommerce currency must be INR.
* Any other validated shipping country: official WooCommerce PayPal Payments only; active currency must be supported by PayPal.
* COD, cheque, BACS and every gateway outside the country rule are removed from checkout availability.
* Paytm provides its own supported UPI options, including available UPI apps. No PhonePe or BHIM gateway is duplicated here.
* The API creates a pending-payment WooCommerce order and returns its WooCommerce order-pay URL. Official gateway pages and callbacks own payment authorization and status changes.
* The storefront treats an order as paid only when WooCommerce reports is_paid() after the official callback/webhook.

== Public endpoints ==

* GET /wp-json/harinam/v1/products
* GET /wp-json/harinam/v1/products/{id}
* GET /wp-json/harinam/v1/session

== Authenticated endpoints ==

* POST /wp-json/harinam/v1/logout
* PATCH /wp-json/harinam/v1/profile
* POST /wp-json/harinam/v1/checkout/quote
* POST /wp-json/harinam/v1/checkout
* GET /wp-json/harinam/v1/orders
* GET /wp-json/harinam/v1/orders/{id}
* GET /wp-json/harinam/v1/tracking/{order-number}
* POST /wp-json/harinam/v1/products/{id} (review)

Registration, login, password reset, cart validation and checkout writes are rate limited. Authenticated writes require the WordPress REST nonce. Guest writes require the short-lived CSRF token returned by /session. CORS credentials are allowed only for https://harinamjoli.in.

== Sandbox checkout ==

= Paytm =

1. Install the official Paytm Payment Gateway plugin.
2. In WooCommerce > Settings > Payments > Paytm select Test/Staging.
3. Enter the Paytm staging Merchant ID and Merchant Key from the Paytm merchant dashboard; use WEBSTAGING when the gateway requests the staging Website value.
4. Enable the official Paytm webhook and copy the exact webhook URL shown by that plugin into the Paytm staging dashboard.
5. Use a shipping address with country India and confirm the API quote returns gateway id paytm and currency INR.
6. Complete a Paytm staging payment on its hosted checkout. Confirm WooCommerce, not a return query parameter, changes the order to Processing/Completed.

= PayPal =

1. Install WooCommerce PayPal Payments from WooCommerce/WordPress.org.
2. In WooCommerce > Settings > Payments > PayPal connect a PayPal Sandbox merchant account and enable the PayPal wallet gateway.
3. Follow the plugin onboarding screen to confirm webhook registration/status.
4. Use a non-India shipping country while the active WooCommerce currency is PayPal-supported.
5. Complete payment with a PayPal Sandbox buyer account. Confirm the PayPal webhook/capture changes the WooCommerce order to Processing/Completed.

Never enter gateway credentials in this plugin, the static frontend, test scripts, URLs or logs.

== Verification checklist ==

1. GET products returns published WooCommerce products, numeric product/variation IDs, live prices, images and stock.
2. Stop/block the API temporarily: listing/detail pages must show an error and never display demo products.
3. Register, log in with valid/invalid credentials, reload, update profile, log out, and verify no sensitive localStorage keys exist.
4. Send an expired X-WP-Nonce: expect rest_cookie_invalid_nonce/403; the frontend refreshes /session and retries once.
5. Request another customer's order ID: expect 404 with no order/address data.
6. Validate an empty cart, invalid product, invalid variation, quantity 0/100, changed/expired expected_price_token and out-of-stock item: expect 4xx errors.
7. Compare quote shipping/tax/total with WooCommerce Admin settings for India and one international zone.
8. India quote must expose only paytm/INR. International quote must expose only ppcp-gateway and a PayPal-supported active currency.
9. Send gateway cod, cheque, bacs, PayPal for India, or Paytm internationally to /checkout: expect rejection.
10. Send the same checkout body twice with the same Idempotency-Key: the second response must reuse the same WooCommerce order.
11. Cancel and fail one sandbox payment. The frontend must show cancelled/failed from the authenticated order endpoint and must not offer another country's gateway.
12. Leave one payment incomplete: the frontend must show pending, then reflect an official webhook retry without creating a new order.
13. Add fake ?success=1 or similar return parameters: the frontend must still show pending unless WooCommerce is_paid() is true.
14. Complete one verified Paytm sandbox payment and one verified PayPal sandbox payment; confirm transaction/order notes and paid date in WooCommerce Admin.
15. Confirm each order appears under WooCommerce > Orders, only in its owner's history/tracking, with correct items, shipping, tax, total and stock handling.
16. Repeat the checkout on a narrow mobile viewport, including hosted gateway return.

== Rollback ==

Deactivate Harinam Store API, restore the previous static frontend JavaScript/HTML files, and purge caches. Deactivation does not delete WooCommerce data. Pending/paid orders already created remain in WooCommerce.

== Changelog ==

= 1.0.0 =
* Initial production integration.

== Product categories ==

Products come only from published WooCommerce products. Category membership includes each assigned category and its ancestors, so a product assigned to Digital Print also appears in Japa Bag. Featured images, gallery, names, prices and stock come from the same backend product.
