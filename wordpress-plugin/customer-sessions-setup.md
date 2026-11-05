# Customer and admin sessions

Copy `harinam-customer-sessions.php` to the backend's `wp-content/` directory.
In the backend's `wp-config.php`, after `ABSPATH` is defined and immediately
before the existing `require_once ABSPATH . 'wp-settings.php';`, add:

```php
require_once __DIR__ . '/wp-content/harinam-customer-sessions.php';
```

This file must run before WordPress defines its cookie names. It is not a
normal plugin or Code Snippets snippet. Native WordPress cookie signing,
session tokens, expiry, nonces and role checks continue to apply.

The storefront API, Google/Facebook login and WooCommerce customer pages use
`harinam_customer_*` cookies. `/wp-admin/`, its AJAX requests, the normal
`wp-login.php`, signed draft preview requests and other REST namespaces keep WordPress's original cookies.
Customer login, password-reset and logout URLs keep their customer namespace.
Changing cookie names requires customers to sign in again once; it does not
delete accounts, orders or saved addresses.

Before release, verify password login, logout and Google login with an admin
session in the same browser; verify customer-only order access and the
WooCommerce order-pay page. Keep a copy of the original `wp-config.php`
outside the public root. Roll back by removing the new require line first;
then remove the helper file. Do not change authentication salts or user roles.

Regression check (PHP 8.3 and disposable WordPress; dependencies stay outside the project):

```sh
npm install --prefix /private/tmp/harinam-session-qa --no-audit --no-fund @wp-playground/cli@3.1.61
PLAYGROUND_CLI_MODULE=/private/tmp/harinam-session-qa/node_modules/@wp-playground/cli/index.js node tests/customer-sessions-check.mjs
```
