<?php
/**
 * Plugin Name: Harinam Social Login
 * Description: Connects Nextend Google and Facebook login to Harinam storefront customer sessions.
 * Version: 1.0.1
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * Requires Plugins: harinam-store-api, nextend-facebook-connect
 */

defined( 'ABSPATH' ) || exit;

add_action( 'rest_api_init', 'harinam_social_routes' );
add_action( 'nsl_register_new_user', 'harinam_social_customer_role' );
add_action( 'harinam_social_delete_used_grant', 'harinam_social_delete_used_grant' );
add_filter( 'nsl_google_is_login_allowed', 'harinam_social_allow_customer_login', 10, 3 );
add_filter( 'nsl_facebook_is_login_allowed', 'harinam_social_allow_customer_login', 10, 3 );

function harinam_social_routes() {
	if ( ! function_exists( 'harinam_store_api_public_write_checks' ) ) {
		return;
	}
	foreach ( array( 'providers' => 'GET', 'start' => 'POST', 'complete' => 'GET', 'finish' => 'POST' ) as $route => $method ) {
		register_rest_route( HARINAM_STORE_API_NAMESPACE, '/auth/social/' . $route, array(
			'methods'             => $method,
			'callback'            => 'harinam_social_' . $route,
			'permission_callback' => '__return_true',
		) );
	}
}

function harinam_social_providers() {
	$providers = array();
	foreach ( array( 'google', 'facebook' ) as $provider ) {
		$providers[ $provider ] = class_exists( 'NextendSocialLogin' ) && NextendSocialLogin::isProviderEnabled( $provider );
	}
	return rest_ensure_response( $providers );
}

function harinam_social_customer_role( $user_id ) {
	$user = get_userdata( $user_id );
	if ( $user && get_role( 'customer' ) ) {
		// Nextend fires this hook only for a newly registered social account.
		$user->set_role( 'customer' );
	}
}

function harinam_social_customer( $user_id ) {
	$user = get_userdata( $user_id );
	return $user && array( 'customer' ) === array_values( (array) $user->roles );
}

function harinam_social_allow_customer_login( $allowed, $provider, $user_id ) {
	return $allowed && harinam_social_customer( $user_id );
}

function harinam_social_key( $state ) {
	return is_string( $state ) && preg_match( '/\A[A-Za-z0-9]{64}\z/', $state ) ? 'harinam_social_' . hash( 'sha256', $state ) : false;
}

function harinam_social_expired() {
	return new WP_Error( 'harinam_social_expired', 'This sign-in has expired or was already used. Please try again.', array( 'status' => 400 ) );
}

function harinam_social_start( $request ) {
	$check = harinam_store_api_public_write_checks( $request, 'social_start', 10, 10 * MINUTE_IN_SECONDS );
	if ( is_wp_error( $check ) ) {
		return $check;
	}
	$provider  = $request->get_param( 'provider' );
	$providers = harinam_social_providers()->get_data();
	if ( ! is_string( $provider ) || empty( $providers[ $provider ] ) ) {
		return new WP_Error( 'harinam_social_unavailable', 'This sign-in option is currently unavailable. Please use email.', array( 'status' => 503 ) );
	}
	$origin = $request->get_param( 'returnOrigin' );
	if ( ! in_array( $origin, array( harinam_store_api_origin(), 'http://127.0.0.1:8000', 'http://localhost:8000' ), true ) ) {
		return new WP_Error( 'harinam_social_origin', 'The sign-in return address is not allowed.', array( 'status' => 400 ) );
	}
	$state = wp_generate_password( 64, false, false );
	set_transient( harinam_social_key( $state ), array(
		'origin' => $origin,
		'csrf'   => hash( 'sha256', (string) $request->get_header( 'x-harinam-csrf' ) ),
	), 10 * MINUTE_IN_SECONDS );
	$callback = add_query_arg( 'state', $state, rest_url( HARINAM_STORE_API_NAMESPACE . '/auth/social/complete' ) );
	$url      = add_query_arg( 'redirect', $callback, NextendSocialLogin::$enabledProviders[ $provider ]->getLoginUrl() );
	return rest_ensure_response( array( 'state' => $state, 'url' => $url ) );
}

function harinam_social_complete( $request ) {
	$state = $request->get_param( 'state' );
	$key   = harinam_social_key( $state );
	$flow  = $key ? get_transient( $key ) : false;
	if ( ! is_array( $flow ) || isset( $flow['grant'] ) ) {
		return harinam_social_expired();
	}
	harinam_store_api_restore_cookie_user();
	$user_id = get_current_user_id();
	$fragment = 'state=' . $state;
	if ( ! harinam_social_customer( $user_id ) ) {
		delete_transient( $key );
		$fragment .= '&error=customer_required';
	} else {
		$grant           = wp_generate_password( 64, false, false );
		$flow['grant']   = hash( 'sha256', $grant );
		$flow['user_id'] = $user_id;
		set_transient( $key, $flow, MINUTE_IN_SECONDS );
		$fragment .= '&grant=' . $grant;
	}
	// The grant reaches only the initiating storefront, never a polling client or a query string.
	$response = new WP_REST_Response( null, 303 );
	$response->header( 'Location', $flow['origin'] . '/auth-callback.html#' . $fragment );
	$response->header( 'Cache-Control', 'no-store' );
	$response->header( 'Referrer-Policy', 'no-referrer' );
	return $response;
}

function harinam_social_finish( $request ) {
	$check = harinam_store_api_public_write_checks( $request, 'social_finish', 20, 10 * MINUTE_IN_SECONDS );
	if ( is_wp_error( $check ) ) {
		return $check;
	}
	$state = $request->get_param( 'state' );
	$grant = $request->get_param( 'grant' );
	$key   = harinam_social_key( $state );
	$flow  = $key ? get_transient( $key ) : false;
	if ( ! is_array( $flow ) || empty( $flow['grant'] ) || ! is_string( $grant ) || ! preg_match( '/\A[A-Za-z0-9]{64}\z/', $grant ) ||
		! hash_equals( $flow['csrf'], hash( 'sha256', (string) $request->get_header( 'x-harinam-csrf' ) ) ) ||
		! hash_equals( $flow['grant'], hash( 'sha256', $grant ) ) || ! harinam_social_customer( $flow['user_id'] ) ) {
		return harinam_social_expired();
	}
	// A database unique key prevents simultaneous redemption, including with a persistent object cache.
	$used = 'harinam_social_used_' . hash( 'sha256', $state );
	if ( ! add_option( $used, time(), '', false ) ) {
		return harinam_social_expired();
	}
	wp_schedule_single_event( time() + 10 * MINUTE_IN_SECONDS, 'harinam_social_delete_used_grant', array( $used ) );
	delete_transient( $key );
	wp_set_current_user( $flow['user_id'] );
	wp_set_auth_cookie( $flow['user_id'], true, true );
	return rest_ensure_response( array( 'authenticated' => true ) );
}

function harinam_social_delete_used_grant( $key ) {
	if ( preg_match( '/\Aharinam_social_used_[a-f0-9]{64}\z/', $key ) ) {
		delete_option( $key );
	}
}
