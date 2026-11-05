<?php
/**
 * Load from wp-config.php before wp-settings.php, not as a regular plugin.
 * Keep storefront and WooCommerce customer cookies separate from wp-admin.
 */
defined( 'ABSPATH' ) || exit;

function harinam_customer_session_request() {
	$path   = parse_url( $_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH ) ?: '/';
	$script = $_SERVER['SCRIPT_NAME'] ?? '';
	$route  = $_GET['rest_route'] ?? null;
	if ( preg_match( '#/wp-json(?:/(.*))?$#', $path, $matches ) ) {
		$route = '/' . ( $matches[1] ?? '' );
	}
	if ( null !== $route ) {
		return is_string( $route ) && 1 === preg_match( '#^/harinam/v1(?:/|$)#', $route );
	}
	if ( preg_match( '#/wp-admin(?:/|$)#', $path ) || preg_match( '#/wp-admin(?:/|$)#', $script ) ) {
		return false;
	}
	if ( 'wp-login.php' === basename( $path ) || 'wp-login.php' === basename( $script ) ) {
		return 'customer' === ( $_GET['harinam_session'] ?? '' ) ||
			in_array( $_GET['loginSocial'] ?? '', array( 'google', 'facebook' ), true );
	}
	if ( 'true' === ( $_GET['preview'] ?? '' ) || isset( $_GET['preview_id'], $_GET['preview_nonce'] ) ) {
		return false;
	}
	return ! ( defined( 'WP_CLI' ) && WP_CLI ) &&
		! in_array( basename( $script ?: $path ), array( 'wp-cron.php', 'xmlrpc.php' ), true );
}

function harinam_customer_session_login_url( $url, $path ) {
	return preg_match( '#^wp-login\.php(?:[?]|$)#', ltrim( $path, '/' ) )
		? add_query_arg( 'harinam_session', 'customer', $url )
		: $url;
}

if ( harinam_customer_session_request() ) {
	define( 'AUTH_COOKIE', 'harinam_customer_auth' );
	define( 'SECURE_AUTH_COOKIE', 'harinam_customer_sec' );
	define( 'LOGGED_IN_COOKIE', 'harinam_customer_logged_in' );
	// wp-config runs before add_filter(); WordPress normalizes these hooks on startup.
	foreach ( array( 'site_url', 'network_site_url' ) as $hook ) {
		$GLOBALS['wp_filter'][ $hook ][10][] = array(
			'function'      => 'harinam_customer_session_login_url',
			'accepted_args' => 2,
		);
	}
}
