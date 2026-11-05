<?php
// In-memory WordPress boundary fixture; run with PHP, never against production accounts.
define( 'ABSPATH', '/' );
define( 'HARINAM_STORE_API_NAMESPACE', 'harinam/v1' );
define( 'MINUTE_IN_SECONDS', 60 );
$transients = array(); $options = array(); $routes = array(); $users = array(); $current_user = 0; $cookies = array(); $scheduled = array(); $filters = array();
class WP_Error { public $code; public function __construct( $code, $message = '', $data = array() ) { $this->code = $code; } }
class WP_REST_Response {
	public $data; public $status; public $headers = array();
	public function __construct( $data, $status = 200 ) { $this->data = $data; $this->status = $status; }
	public function get_data() { return $this->data; }
	public function header( $key, $value ) { $this->headers[ $key ] = $value; }
}
class TestUser { public $roles; public function __construct( $roles ) { $this->roles = $roles; } public function set_role( $role ) { $this->roles = array( $role ); } }
class TestRequest {
	public $params; public $csrf; public $allowed;
	public function __construct( $params = array(), $csrf = 'initiating-csrf', $allowed = true ) { $this->params = $params; $this->csrf = $csrf; $this->allowed = $allowed; }
	public function get_param( $key ) { return $this->params[ $key ] ?? null; }
	public function get_header( $key ) { return 'x-harinam-csrf' === $key ? $this->csrf : ''; }
}
class TestProvider { public function getLoginUrl() { return 'https://admin.harinamjoli.in/wp-login.php?loginSocial=google'; } }
class NextendSocialLogin { public static $enabledProviders = array(); public static function isProviderEnabled( $id ) { return isset( self::$enabledProviders[ $id ] ); } }
function add_action() {}
function add_filter( $name, $callback, $priority, $args ) { $GLOBALS['filters'][ $name ] = array( $callback, $args ); }
function register_rest_route( $ns, $route, $args ) { $GLOBALS['routes'][ $route ] = $args; }
function rest_ensure_response( $data ) { return new WP_REST_Response( $data ); }
function is_wp_error( $result ) { return $result instanceof WP_Error; }
function get_userdata( $id ) { return $GLOBALS['users'][ $id ] ?? false; }
function get_current_user_id() { return $GLOBALS['current_user']; }
function get_role( $role ) { return true; }
function wp_set_current_user( $id ) { $GLOBALS['current_user'] = $id; }
function wp_set_auth_cookie( $id, $remember, $secure ) { $GLOBALS['cookies'][] = array( $id, $remember, $secure ); }
function harinam_store_api_restore_cookie_user() {}
function harinam_store_api_origin() { return 'https://harinamjoli.in'; }
function harinam_store_api_public_write_checks( $request ) { return $request->allowed ? true : new WP_Error( 'csrf_denied' ); }
function wp_generate_password( $length ) { return substr( bin2hex( random_bytes( $length ) ), 0, $length ); }
function set_transient( $key, $value, $ttl ) { $GLOBALS['transients'][ $key ] = array( $value, time() + $ttl ); }
function get_transient( $key ) { $entry = $GLOBALS['transients'][ $key ] ?? null; return $entry && $entry[1] >= time() ? $entry[0] : false; }
function delete_transient( $key ) { unset( $GLOBALS['transients'][ $key ] ); }
function add_option( $key, $value ) { if ( isset( $GLOBALS['options'][ $key ] ) ) { return false; } $GLOBALS['options'][ $key ] = $value; return true; }
function delete_option( $key ) { unset( $GLOBALS['options'][ $key ] ); }
function wp_schedule_single_event( $time, $hook, $args ) { $GLOBALS['scheduled'][] = array( $time, $hook, $args ); }
function rest_url( $path ) { return 'https://admin.harinamjoli.in/wp-json/' . $path; }
function add_query_arg( $key, $value, $url ) { return $url . ( false === strpos( $url, '?' ) ? '?' : '&' ) . http_build_query( array( $key => $value ) ); }
function check( $valid, $message ) { if ( ! $valid ) { throw new Exception( $message ); } }
function error_is( $result, $code ) { check( is_wp_error( $result ) && $result->code === $code, 'Expected ' . $code ); }
$plugin_file = __DIR__ . '/../wordpress-plugin/harinam-social-login/harinam-social-login.php';
if ( in_array( '--snippet', $argv, true ) ) {
	$body = explode( "defined( 'ABSPATH' ) || exit;\n\n", file_get_contents( $plugin_file ), 2 )[1];
	$snippet = "if ( ! function_exists( 'harinam_social_routes' ) ) {\n" . $body . "\n}\n";
	eval( $snippet );
	eval( $snippet );
} else {
	require $plugin_file;
}

harinam_social_routes();
check( 4 === count( $routes ), 'All four endpoints are registered.' );
check( array( 'google' => false, 'facebook' => false ) === harinam_social_providers()->get_data(), 'Unconfigured providers stay unavailable.' );
$start = new TestRequest( array( 'provider' => 'google', 'returnOrigin' => 'http://127.0.0.1:8000' ) );
error_is( harinam_social_start( $start ), 'harinam_social_unavailable' );
NextendSocialLogin::$enabledProviders['google'] = new TestProvider();
foreach ( array( 'https://evil.example', 'https://harinamjoli.in.evil.example', 'http://localhost:9000', 'http://127.0.0.1:8000/path', 'https://harinamjoli.in/' ) as $origin ) {
	error_is( harinam_social_start( new TestRequest( array( 'provider' => 'google', 'returnOrigin' => $origin ) ) ), 'harinam_social_origin' );
}
error_is( harinam_social_start( new TestRequest( $start->params, 'bad', false ) ), 'csrf_denied' );
error_is( harinam_social_start( new TestRequest( array( 'provider' => 'javascript', 'returnOrigin' => 'https://harinamjoli.in' ) ) ), 'harinam_social_unavailable' );
error_is( harinam_social_start( new TestRequest( array( 'provider' => array( 'google' ), 'returnOrigin' => 'https://harinamjoli.in' ) ) ), 'harinam_social_unavailable' );
$flow = harinam_social_start( $start )->get_data();
$key = harinam_social_key( $flow['state'] );
parse_str( parse_url( $flow['url'], PHP_URL_QUERY ), $query );
check( 'google' === $query['loginSocial'] && false !== strpos( $query['redirect'], '/auth/social/complete?state=' ), 'Provider uses the server callback.' );
check( 'http://127.0.0.1:8000' === get_transient( $key )['origin'], 'Local callback is allowlisted.' );
check( false === harinam_social_key( '../../anything' ), 'Malformed state never becomes a storage key.' );
error_is( harinam_social_complete( new TestRequest( array( 'state' => 'invalid' ) ) ), 'harinam_social_expired' );
$saved_start = get_transient( $key );
$complete_request = new TestRequest( array( 'state' => $flow['state'] ) );
$users[1] = new TestUser( array( 'administrator' ) );
$users[2] = new TestUser( array( 'customer', 'administrator' ) );
foreach ( array( 0, 1, 2 ) as $current_user ) {
	set_transient( $key, $saved_start, 600 );
	$denied = harinam_social_complete( $complete_request );
	check( false !== strpos( $denied->headers['Location'], '&error=customer_required' ), 'Non-customer callbacks return a safe, visible error.' );
	check( false === strpos( $denied->headers['Location'], 'grant=' ), 'A privileged or guest account never gets a grant.' );
}
set_transient( $key, $saved_start, 600 );
$users[7] = new TestUser( array( 'customer' ) ); $current_user = 7;
foreach ( array( 'google', 'facebook' ) as $provider ) {
	$filter = $filters[ 'nsl_' . $provider . '_is_login_allowed' ];
	check( 3 === $filter[1], 'Customer-only provider filter receives the authenticated user ID.' );
	check( true === $filter[0]( true, null, 7 ), 'Customer social login stays available.' );
	check( false === $filter[0]( false, null, 7 ), 'Another plugin login restriction cannot be bypassed.' );
	check( false === $filter[0]( true, null, 1 ) && false === $filter[0]( true, null, 2 ), 'Administrator and mixed roles cannot gain a Google/Facebook login method at wp-login.php.' );
}
$complete = harinam_social_complete( $complete_request );
check( 303 === $complete->status && 'no-store' === $complete->headers['Cache-Control'], 'Callback is an uncached redirect.' );
check( 0 === strpos( $complete->headers['Location'], 'http://127.0.0.1:8000/auth-callback.html#' ), 'Grant is in the frontend fragment only.' );
parse_str( parse_url( $complete->headers['Location'], PHP_URL_FRAGMENT ), $relay );
$saved_flow = get_transient( $key );
check( $relay['grant'] !== $saved_flow['grant'], 'Only the grant hash is stored.' );
error_is( harinam_social_complete( $complete_request ), 'harinam_social_expired' );
error_is( harinam_social_finish( new TestRequest( $relay, 'different-browser-csrf' ) ), 'harinam_social_expired' );
error_is( harinam_social_finish( new TestRequest( array_merge( $relay, array( 'grant' => str_repeat( 'X', 64 ) ) ) ) ), 'harinam_social_expired' );
error_is( harinam_social_finish( new TestRequest( array_merge( $relay, array( 'grant' => array( $relay['grant'] ) ) ) ) ), 'harinam_social_expired' );
error_is( harinam_social_finish( new TestRequest( $relay, 'initiating-csrf', false ) ), 'csrf_denied' );
check( ! $cookies, 'Invalid attempts never set a login cookie.' );
$users[7]->roles = array( 'administrator' );
error_is( harinam_social_finish( new TestRequest( $relay ) ), 'harinam_social_expired' );
$users[7]->roles = array( 'customer' );
$current_user = 0;
$success = harinam_social_finish( new TestRequest( $relay ) );
check( true === $success->get_data()['authenticated'] && 7 === $current_user, 'Valid grant authenticates the intended customer.' );
check( array( array( 7, true, true ) ) === $cookies, 'A secure server-side cookie is created.' );
error_is( harinam_social_finish( new TestRequest( $relay ) ), 'harinam_social_expired' );
set_transient( $key, $saved_flow, 60 );
error_is( harinam_social_finish( new TestRequest( $relay ) ), 'harinam_social_expired' );
check( 1 === count( $cookies ), 'Even a stale cached flow cannot redeem a grant twice.' );
$transients[ $key ][1] = time() - 1;
error_is( harinam_social_finish( new TestRequest( $relay ) ), 'harinam_social_expired' );
$users[8] = new TestUser( array( 'subscriber' ) ); harinam_social_customer_role( 8 );
check( array( 'customer' ) === $users[8]->roles, 'New social customers get the WooCommerce customer role.' );
harinam_social_delete_used_grant( $scheduled[0][2][0] );
check( ! $options, 'Single-use markers can be cleaned up after expiry.' );
echo "PASS: PHP bridge provider gating, exact callback allowlist, origin/CSRF boundary, expiry, customer roles, hashed grants, single use and secure cookies\n";
