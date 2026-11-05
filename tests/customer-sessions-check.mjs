import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Install @wp-playground/cli in a temporary directory; point PLAYGROUND_CLI_MODULE at its index.js.
const { runCLI } = await import(process.env.PLAYGROUND_CLI_MODULE || '@wp-playground/cli');
const instance = await runCLI({ command: 'server', php: '8.3', wp: 'latest', port: 8011, login: false, workers: 1, internalCookieStore: false });
const php = instance.playground;
const json = value => `json_decode(base64_decode('${Buffer.from(JSON.stringify(value)).toString('base64')}'), true)`;
const jar = {};

async function request(route, code, cookies = jar) {
  const url = new URL(route, 'http://localhost');
  const script = url.pathname.startsWith('/wp-admin/') ? url.pathname : url.pathname === '/wp-login.php' ? url.pathname : '/index.php';
  const response = await php.run({ code: `<?php
    $_SERVER['REQUEST_URI'] = ${json(route)};
    $_SERVER['SCRIPT_NAME'] = ${json(script)};
    $_GET = ${json(Object.fromEntries(url.searchParams))};
    $_COOKIE = ${json(cookies)};
    require '/wordpress/wp-load.php';
    ${code}
  ` });
  assert.equal(response.exitCode, 0, response.errors);
  assert.equal(response.errors, '', response.errors);
  const text = new TextDecoder().decode(response.bytes);
  return { data: text ? JSON.parse(text) : null, headers: response.headers };
}

function applyCookies(response) {
  for (const header of response.headers['set-cookie'] || []) {
    const cookie = header.split(';')[0];
    const index = cookie.indexOf('=');
    const name = cookie.slice(0, index);
    if (/Max-Age=0(?:;|$)/i.test(header)) delete jar[name];
    else jar[name] = decodeURIComponent(cookie.slice(index + 1));
  }
}

const identity = `echo json_encode(['id' => get_current_user_id(), 'admin' => current_user_can('manage_options'), 'cookie' => LOGGED_IN_COOKIE, 'nonce' => wp_create_nonce('wp_rest'), 'previewNonce' => wp_create_nonce('post_preview_123'), 'login' => wp_login_url(), 'logout' => wp_logout_url(), 'reset' => network_site_url('wp-login.php?action=rp', 'login')]);`;

try {
  await php.writeFile('/wordpress/wp-content/harinam-customer-sessions.php', readFileSync(new URL('../wordpress-plugin/harinam-customer-sessions.php', import.meta.url), 'utf8'));
  const config = await php.readFileAsText('/wordpress/wp-config.php');
  const marker = "require_once ABSPATH . 'wp-settings.php';";
  assert.ok(config.includes(marker));
  await php.writeFile('/wordpress/wp-config.php', config.replace(marker, "require_once __DIR__ . '/wp-content/harinam-customer-sessions.php';\n" + marker));
  const setup = await request('/wp-admin/', `
    add_role('customer', 'Customer', ['read' => true]);
    $id = wp_create_user('session_customer', 'local-session-test-only', 'customer@example.test');
    get_userdata($id)->set_role('customer');
    echo json_encode(['customer' => $id, 'admin' => get_user_by('login', 'admin')->ID]);
  `);
  const ids = setup.data;

  const routes = [
    ['/', true], ['/my-account/', true], ['/checkout/order-pay/108/', true],
    ['/wp-json/harinam/v1/session', true], ['/?rest_route=/harinam/v1/orders', true],
    ['/wp-login.php?loginSocial=google', true], ['/wp-login.php?loginSocial=facebook', true],
    ['/wp-login.php?harinam_session=customer', true], ['/wp-login.php?action=logout&harinam_session=customer', true],
    ['/wp-admin/', false], ['/wp-admin/admin-ajax.php?harinam_session=customer', false],
    ['/wp-admin/admin.php?page=wc-settings', false], ['/wp-login.php', false],
    ['/wp-login.php?action=logout', false], ['/wp-json/wp/v2/users', false],
    ['/?rest_route=/wp/v2/users&harinam_session=customer', false], ['/wp-json/harinam/v10/session', false],
    ['/?post_type=product&p=123&preview=true', false],
  ];
  for (const [route, customer] of routes) {
    const { data } = await request(route, identity, {});
    assert.equal(data.cookie === 'harinam_customer_logged_in', customer, route);
    assert.equal(new URL(data.login).searchParams.get('harinam_session') === 'customer', customer, `${route}: login namespace`);
    assert.equal(new URL(data.logout.replaceAll('&amp;', '&')).searchParams.get('harinam_session') === 'customer', customer, `${route}: logout namespace`);
    assert.equal(new URL(data.reset).searchParams.get('harinam_session') === 'customer', customer, `${route}: reset namespace`);
  }

  applyCookies(await request('/wp-login.php', `wp_set_auth_cookie(${ids.admin}, true, true);`));
  const admin = (await request('/wp-admin/', identity)).data;
  assert.equal(admin.id, ids.admin);
  assert.equal(admin.admin, true);
  assert.equal((await request('/wp-json/harinam/v1/session', identity)).data.id, 0, 'An admin cookie never becomes a customer session');
  const adminCookies = { ...jar };

  const login = await request('/wp-json/harinam/v1/login', `
    $user = wp_signon(['user_login' => 'session_customer', 'user_password' => 'local-session-test-only', 'remember' => true], true);
    if (is_wp_error($user)) throw new Exception($user->get_error_message());
  `);
  applyCookies(login);
  for (const [name, value] of Object.entries(adminCookies)) assert.equal(jar[name], value, `Customer sign-in preserves ${name}`);
  const customer = (await request('/wp-json/harinam/v1/session', identity)).data;
  assert.equal(customer.id, ids.customer);
  assert.equal(customer.admin, false);
  assert.equal((await request('/wp-admin/', identity)).data.id, ids.admin, 'Both identities coexist');
  assert.equal((await request('/wp-json/wp/v2/users', identity)).data.id, ids.admin, 'Admin REST retains the admin identity');
  assert.equal((await request(`/?preview_id=123&preview_nonce=${admin.previewNonce}`, identity)).data.id, ids.admin, 'Signed draft previews retain the admin identity');
  assert.equal((await request('/checkout/order-pay/108/', identity)).data.id, ids.customer, 'Payment handoff retains the customer identity');
  assert.equal((await request('/wp-admin/', identity, Object.fromEntries(Object.entries(jar).filter(([name]) => name.startsWith('harinam_customer_'))))).data.id, 0, 'Customer cookies cannot authenticate wp-admin');
  const nonce = await request('/wp-json/harinam/v1/profile', `echo json_encode([wp_verify_nonce(${json(customer.nonce)}, 'wp_rest') !== false, wp_verify_nonce(${json(admin.nonce)}, 'wp_rest') !== false]);`);
  assert.deepEqual(nonce.data, [true, false], 'Nonces stay bound to their own identity');

  const savedCustomerCookies = { ...jar };
  applyCookies(await request('/wp-json/harinam/v1/logout', 'wp_logout();'));
  assert.equal((await request('/wp-admin/', identity)).data.id, ids.admin, 'Customer logout preserves admin login');
  assert.equal((await request('/wp-json/harinam/v1/session', identity, savedCustomerCookies)).data.id, 0, 'Customer logout revokes its session token');
  applyCookies(await request('/wp-json/harinam/v1/register', `wp_set_auth_cookie(${ids.customer}, true, true);`));
  applyCookies(await request('/wp-login.php?action=logout', 'wp_logout();'));
  assert.equal((await request('/wp-admin/', identity)).data.id, 0);
  assert.equal((await request('/wp-json/harinam/v1/session', identity)).data.id, ids.customer, 'Admin logout preserves customer login');
  applyCookies(await request('/wp-login.php?loginSocial=google', `wp_set_auth_cookie(${ids.customer}, true, true);`));
  assert.equal((await request('/wp-json/harinam/v1/session', identity)).data.id, ids.customer, 'Social provider cookies use the customer namespace');
  applyCookies(await request('/wp-login.php?action=logout&harinam_session=customer', 'wp_logout();'));
  assert.equal((await request('/my-account/', identity)).data.id, 0, 'Customer web logout clears only the customer session');
  console.log('PASS: WordPress route isolation, concurrent admin/customer identities, password/social cookie issuance, nonce separation, role restrictions, payment identity and independent logout/token revocation');
} finally {
  await instance[Symbol.asyncDispose]();
}
