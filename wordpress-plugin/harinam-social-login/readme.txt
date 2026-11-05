=== Harinam Social Login ===
Version: 1.0.1
Requires PHP: 7.4
Dependencies: Harinam Store API 1.0.1, Nextend Social Login 3.1.26, WooCommerce.

Connects the static Harinam storefront to verified Google/Facebook customer identities using Nextend. OAuth secrets remain in WordPress settings. No provider credentials or access tokens are placed in storefront files. Provider login is restricted to customer accounts at both the WordPress and storefront entry points; Nextend's separate settings-verification flow remains available to administrators.

SETUP

1. Activate the bridge once, using either this plugin or a PHP snippet. Keep Harinam Store API and Nextend active. On 25 October 2026 the reviewed 1.0.1 bridge was activated on admin.harinamjoli.in as the Code Snippets snippet "Harinam Customer Social Login 1.0.1", set to Run everywhere, priority 10. The standalone plugin is not installed there. Before switching to the plugin, deactivate the snippet; never leave both active.
2. In WordPress > Settings > Nextend Social Login, configure Google and Facebook using their official setup guides. Save, Verify Settings, then Enable each provider. The storefront enables only providers Nextend reports as enabled.
3. Exact OAuth redirect URIs on this WordPress install:
   Google: https://admin.harinamjoli.in/wp-login.php?loginSocial=google
   Facebook: https://admin.harinamjoli.in/wp-login.php?loginSocial=facebook
   Confirm these against Nextend's displayed URI before saving the provider app.
4. Publish auth-callback.html, js/auth-callback.js and the updated shared frontend files with the storefront. Callback origin must be https://harinamjoli.in. Local development supports http://127.0.0.1:8000 and http://localhost:8000 through the existing dev-server.mjs /api proxy.
5. Provider account owner must complete Terms, app registration, consent settings and any required verification. Facebook public access may require Meta business verification / Advanced Access review. Google's Testing restrictions have an exception for basic name/email/profile-only sign-in: those users do not need to be added as test users. Adding any other OAuth scopes removes that exception. App-name/logo branding review is separate.
6. Use a customer test email/account for the acceptance check. A browser already signed in as WordPress administrator will be rejected by the storefront callback; use a separate browser profile for customer tests. Existing administrator/editor roles are never changed. Only newly registered social users receive the WooCommerce customer role.

VERIFY BEFORE CALLING AUTH LIVE

- Both providers: Sign in, return to original popup, popup closes, correct customer appears in My Account.
- Reload and confirm session persists; sign out and confirm protected profile/order routes reject access.
- Test both existing email customers and new social customers with the owner's consent. Do not create orders or make payments for an auth test.
- Repeat through local dev-server.mjs. A WordPress browser cookie alone cannot sign in the local proxy; the single-use bridge must complete.
- All public provider-app URLs, including Privacy Policy and any Meta data-deletion instructions, must be live and owner-reviewed.

SECURITY

POST /harinam/v1/auth/social/start and /finish use the existing Store API origin, IP/user-agent CSRF and rate checks. The callback uses the actual WordPress authenticated customer cookie. A 64-character one-use grant expires after 60 seconds, is stored only as a hash and is returned in a frontend URL fragment. The initiating window must present that grant plus its original CSRF. A database unique key prevents concurrent or repeated redemption. Administrator/mixed privileged roles are rejected. No raw cookie, OAuth token or user details are returned in redirect URLs.

The callback relay has no external resources, clears its fragment immediately and uses an exact-origin opener message plus a same-origin BroadcastChannel fallback for Google COOP. Cancelling, timeout, unavailable providers and blocked popup windows show a retry message and retain email login.

LOCAL CHECKS

node tests/social-auth-check.mjs
php tests/social-auth-bridge-check.php
php tests/social-auth-bridge-check.php --snippet
node tests/auth-check.mjs
node tests/auth-dialog-check.mjs

Official provider setup:
https://social-login.nextendweb.com/documentation/providers/google/
https://social-login.nextendweb.com/documentation/providers/facebook/
https://support.google.com/cloud/answer/15549945

CURRENT CONNECTION STATUS (26 October 2026)

- Public /wp-json/harinam/v1/auth/social/providers responds HTTP 200 with google=true and facebook=false.
- Nextend Google settings verification passed and Google is Enabled. OAuth credentials are stored only in Nextend's server settings.
- Local storefront Google button opens Google's real account chooser. An existing WordPress administrator session is rejected as intended without changing its role or signing it out.
- Customer acceptance test reached Google's passkey identity verification; the account owner must complete that prompt before session persistence can be verified.
- The updated storefront and auth callback were published at https://harinamjoli.in on 26 October 2026. Store API 1.0.2 is active; the production providers endpoint still reports google=true and facebook=false. Customer Google sign-in/session persistence remains unverified until the account owner completes identity verification.
