<?php
/**
 * Plugin Name: Harinam Store API
 * Description: Secure WooCommerce REST API for the Harinam Joli static storefront.
 * Version: 1.0.2
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * WC requires at least: 8.0
 * Text Domain: harinam-store-api
 */

defined( 'ABSPATH' ) || exit;

define( 'HARINAM_STORE_API_VERSION', '1.0.2' );
define( 'HARINAM_STORE_API_NAMESPACE', 'harinam/v1' );
define( 'HARINAM_STORE_FRONTEND_ORIGIN', 'https://harinamjoli.in' );

add_action( 'admin_notices', 'harinam_store_api_admin_notice' );
add_action( 'rest_api_init', 'harinam_store_api_register_routes' );
add_filter( 'rest_allowed_cors_headers', 'harinam_store_api_cors_headers' );
add_filter( 'rest_pre_dispatch', 'harinam_store_api_pre_dispatch', 10, 3 );
add_filter( 'rest_pre_serve_request', 'harinam_store_api_serve_cors', 20, 4 );
add_filter( 'rest_post_dispatch', 'harinam_store_api_cache_headers', 10, 3 );
add_filter( 'woocommerce_available_payment_gateways', 'harinam_store_api_filter_gateways', 999 );
add_filter( 'woocommerce_get_return_url', 'harinam_store_api_gateway_return_url', 10, 2 );
add_filter( 'woocommerce_get_checkout_order_received_url', 'harinam_store_api_gateway_return_url', 10, 2 );
add_filter( 'woocommerce_get_view_order_url', 'harinam_store_api_gateway_return_url', 10, 2 );
add_action( 'set_logged_in_cookie', 'harinam_store_api_secure_logged_in_cookie', 99, 6 );
add_action( 'harinam_store_api_delete_idempotency_key', 'harinam_store_api_delete_idempotency_key' );

function harinam_store_api_origin() {
	return (string) apply_filters( 'harinam_store_frontend_origin', HARINAM_STORE_FRONTEND_ORIGIN );
}

function harinam_store_api_secure_logged_in_cookie( $cookie, $expire ) {
	if ( PHP_VERSION_ID < 70300 || headers_sent() ) {
		return;
	}
	$options = array(
		'expires'  => $expire,
		'path'     => COOKIEPATH ?: '/',
		'domain'   => (string) COOKIE_DOMAIN,
		'secure'   => true,
		'httponly' => true,
		'samesite' => 'Lax',
	);
	setcookie( LOGGED_IN_COOKIE, $cookie, $options );
	if ( SITECOOKIEPATH !== COOKIEPATH ) {
		$options['path'] = SITECOOKIEPATH;
		setcookie( LOGGED_IN_COOKIE, $cookie, $options );
	}
}

function harinam_store_api_admin_notice() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	if ( ! class_exists( 'WooCommerce' ) ) {
		echo '<div class="notice notice-error"><p><strong>Harinam Store API:</strong> WooCommerce is inactive or missing. The API is disabled until WooCommerce is active.</p></div>';
		return;
	}
	$gateways = WC()->payment_gateways()->payment_gateways();
	$missing  = array();
	if ( empty( $gateways['paytm'] ) || ! is_a( $gateways['paytm'], 'WC_Paytm' ) ) {
		$missing[] = 'official Paytm Payment Gateway (gateway ID: paytm)';
	}
	if ( empty( $gateways['ppcp-gateway'] ) || false === strpos( get_class( $gateways['ppcp-gateway'] ), 'WooCommerce\\PayPalCommerce\\' ) ) {
		$missing[] = 'official WooCommerce PayPal Payments (gateway ID: ppcp-gateway)';
	}
	if ( $missing ) {
		echo '<div class="notice notice-warning"><p><strong>Harinam Store API:</strong> Missing ' . esc_html( implode( ' and ', $missing ) ) . '. Checkout will return an exact configuration error; no fallback gateway is used.</p></div>';
	}
}

function harinam_store_api_register_routes() {
	register_rest_route(
		HARINAM_STORE_API_NAMESPACE,
		'/products',
		array(
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'harinam_store_api_products',
			'permission_callback' => '__return_true',
			'args'                => array(
				'page'     => array( 'sanitize_callback' => 'absint', 'default' => 1 ),
				'per_page' => array( 'sanitize_callback' => 'absint', 'default' => 100 ),
			),
		)
	);
	register_rest_route(
		HARINAM_STORE_API_NAMESPACE,
		'/products/(?P<id>\d+)',
		array(
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => 'harinam_store_api_product',
				'permission_callback' => '__return_true',
			),
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => 'harinam_store_api_review',
				'permission_callback' => 'harinam_store_api_user_permission',
			),
		)
	);
	register_rest_route(
		HARINAM_STORE_API_NAMESPACE,
		'/session',
		array(
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'harinam_store_api_session',
			'permission_callback' => '__return_true',
		)
	);
	foreach ( array( 'register', 'login', 'password-reset' ) as $route ) {
		register_rest_route(
			HARINAM_STORE_API_NAMESPACE,
			'/' . $route,
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => 'harinam_store_api_' . str_replace( '-', '_', $route ),
				'permission_callback' => '__return_true',
			)
		);
	}
	register_rest_route(
		HARINAM_STORE_API_NAMESPACE,
		'/logout',
		array(
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => 'harinam_store_api_logout',
			'permission_callback' => 'harinam_store_api_user_permission',
		)
	);
	register_rest_route(
		HARINAM_STORE_API_NAMESPACE,
		'/profile',
		array(
			'methods'             => array( 'PATCH', 'POST' ),
			'callback'            => 'harinam_store_api_profile',
			'permission_callback' => 'harinam_store_api_user_permission',
		)
	);
	register_rest_route(
		HARINAM_STORE_API_NAMESPACE,
		'/cart/validate',
		array(
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => 'harinam_store_api_validate_cart',
			'permission_callback' => '__return_true',
		)
	);
	register_rest_route(
		HARINAM_STORE_API_NAMESPACE,
		'/checkout/quote',
		array(
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => 'harinam_store_api_quote',
			'permission_callback' => 'harinam_store_api_user_permission',
		)
	);
	register_rest_route(
		HARINAM_STORE_API_NAMESPACE,
		'/checkout',
		array(
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => 'harinam_store_api_checkout',
			'permission_callback' => 'harinam_store_api_user_permission',
		)
	);
	register_rest_route(
		HARINAM_STORE_API_NAMESPACE,
		'/orders',
		array(
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'harinam_store_api_orders',
			'permission_callback' => 'harinam_store_api_user_permission',
		)
	);
	register_rest_route(
		HARINAM_STORE_API_NAMESPACE,
		'/orders/(?P<id>\d+)',
		array(
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'harinam_store_api_order',
			'permission_callback' => 'harinam_store_api_user_permission',
		)
	);
	register_rest_route(
		HARINAM_STORE_API_NAMESPACE,
		'/tracking/(?P<reference>[A-Za-z0-9_-]+)',
		array(
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'harinam_store_api_tracking',
			'permission_callback' => 'harinam_store_api_user_permission',
		)
	);
}

function harinam_store_api_user_permission() {
	return class_exists( 'WooCommerce' ) && is_user_logged_in() && harinam_store_api_is_customer()
		? true
		: new WP_Error( 'harinam_auth_required', 'Please sign in to continue.', array( 'status' => 401 ) );
}

function harinam_store_api_is_customer( $user_id = 0 ) {
	$user = get_userdata( $user_id ?: get_current_user_id() );
	return $user && in_array( 'customer', (array) $user->roles, true );
}

function harinam_store_api_cors_headers( $headers ) {
	$headers[] = 'X-Harinam-CSRF';
	$headers[] = 'Idempotency-Key';
	return array_values( array_unique( $headers ) );
}

function harinam_store_api_is_request( $request ) {
	return 0 === strpos( ltrim( $request->get_route(), '/' ), HARINAM_STORE_API_NAMESPACE . '/' );
}

function harinam_store_api_pre_dispatch( $result, $server, $request ) {
	if ( ! harinam_store_api_is_request( $request ) ) {
		return $result;
	}
	$origin = $request->get_header( 'origin' );
	if ( $origin && harinam_store_api_origin() !== $origin ) {
		return new WP_Error( 'harinam_origin_denied', 'Request origin is not allowed.', array( 'status' => 403 ) );
	}
	if ( 'OPTIONS' === $request->get_method() ) {
		return new WP_REST_Response( null, 204 );
	}
	return $result;
}

function harinam_store_api_serve_cors( $served, $result, $request ) {
	if ( ! harinam_store_api_is_request( $request ) ) {
		return $served;
	}
	header_remove( 'Access-Control-Allow-Origin' );
	header_remove( 'Access-Control-Allow-Credentials' );
	if ( harinam_store_api_origin() === $request->get_header( 'origin' ) ) {
		header( 'Access-Control-Allow-Origin: ' . harinam_store_api_origin() );
		header( 'Access-Control-Allow-Credentials: true' );
		header( 'Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS' );
		header( 'Access-Control-Allow-Headers: Content-Type, X-WP-Nonce, X-Harinam-CSRF, Idempotency-Key' );
		header( 'Access-Control-Max-Age: 600' );
	}
	header( 'Vary: Origin', false );
	return $served;
}

function harinam_store_api_cache_headers( $response, $server, $request ) {
	if ( ! harinam_store_api_is_request( $request ) ) {
		return $response;
	}
	if ( 'GET' === $request->get_method() && preg_match( '#^/harinam/v1/products(?:/\d+)?$#', $request->get_route() ) ) {
		$response->header( 'Cache-Control', 'public, max-age=60' );
		$response->header( 'Vary', 'Origin, Cookie' );
	} else {
		$response->header( 'Cache-Control', 'private, no-store, max-age=0' );
		$response->header( 'Pragma', 'no-cache' );
	}
	return $response;
}

function harinam_store_api_require_wc() {
	return class_exists( 'WooCommerce' )
		? true
		: new WP_Error( 'harinam_woocommerce_missing', 'WooCommerce is inactive or missing.', array( 'status' => 503 ) );
}

function harinam_store_api_require_origin( $request ) {
	return harinam_store_api_origin() === $request->get_header( 'origin' )
		? true
		: new WP_Error( 'harinam_origin_required', 'A valid storefront origin is required.', array( 'status' => 403 ) );
}

function harinam_store_api_client_fingerprint() {
	return hash( 'sha256', (string) ( $_SERVER['REMOTE_ADDR'] ?? '' ) . '|' . (string) ( $_SERVER['HTTP_USER_AGENT'] ?? '' ) );
}

function harinam_store_api_guest_csrf() {
	$token = wp_generate_password( 40, false, false );
	set_transient( 'harinam_csrf_' . hash( 'sha256', $token ), harinam_store_api_client_fingerprint(), 15 * MINUTE_IN_SECONDS );
	return $token;
}

function harinam_store_api_require_guest_csrf( $request ) {
	$token = (string) $request->get_header( 'x-harinam-csrf' );
	$valid = $token && hash_equals(
		(string) get_transient( 'harinam_csrf_' . hash( 'sha256', $token ) ),
		harinam_store_api_client_fingerprint()
	);
	return $valid
		? true
		: new WP_Error( 'harinam_invalid_csrf', 'Security token is invalid or expired. Refresh and try again.', array( 'status' => 403 ) );
}

function harinam_store_api_rate_limit( $bucket, $limit, $window ) {
	$key   = 'harinam_rate_' . substr( hash( 'sha256', $bucket . '|' . (string) ( $_SERVER['REMOTE_ADDR'] ?? '' ) ), 0, 40 );
	$value = get_transient( $key );
	$count = is_array( $value ) ? (int) $value['count'] : 0;
	if ( $count >= $limit ) {
		return new WP_Error( 'harinam_rate_limited', 'Too many attempts. Please wait and try again.', array( 'status' => 429 ) );
	}
	set_transient( $key, array( 'count' => $count + 1 ), $window );
	return true;
}

function harinam_store_api_public_write_checks( $request, $bucket, $limit, $window ) {
	foreach ( array( harinam_store_api_require_wc(), harinam_store_api_require_origin( $request ), harinam_store_api_require_guest_csrf( $request ), harinam_store_api_rate_limit( $bucket, $limit, $window ) ) as $check ) {
		if ( is_wp_error( $check ) ) {
			return $check;
		}
	}
	return true;
}

function harinam_store_api_restore_cookie_user() {
	if ( get_current_user_id() ) {
		return;
	}
	$user_id = wp_validate_auth_cookie( '', 'logged_in' );
	if ( $user_id ) {
		wp_set_current_user( $user_id );
	}
}

function harinam_store_api_user_data( $user_id ) {
	$user       = get_userdata( $user_id );
	$first_name = (string) get_user_meta( $user_id, 'first_name', true );
	$last_name  = (string) get_user_meta( $user_id, 'last_name', true );
	$name       = trim( $first_name . ' ' . $last_name );
	return array(
		'id'        => (int) $user_id,
		'name'      => $name ?: $user->display_name,
		'firstName' => $first_name,
		'lastName'  => $last_name,
		'email'     => $user->user_email,
		'phone'     => (string) get_user_meta( $user_id, 'billing_phone', true ),
		'address'   => array(
			'fullName'   => $name ?: $user->display_name,
			'phone'      => (string) get_user_meta( $user_id, 'shipping_phone', true ) ?: (string) get_user_meta( $user_id, 'billing_phone', true ),
			'address'    => (string) get_user_meta( $user_id, 'shipping_address_1', true ),
			'landmark'   => (string) get_user_meta( $user_id, 'shipping_address_2', true ),
			'city'       => (string) get_user_meta( $user_id, 'shipping_city', true ),
			'state'      => (string) get_user_meta( $user_id, 'shipping_state', true ),
			'postalCode' => (string) get_user_meta( $user_id, 'shipping_postcode', true ),
			'country'    => (string) get_user_meta( $user_id, 'shipping_country', true ) ?: 'IN',
		),
	);
}

function harinam_store_api_session() {
	$wc = harinam_store_api_require_wc();
	if ( is_wp_error( $wc ) ) {
		return $wc;
	}
	harinam_store_api_restore_cookie_user();
	$user_id   = harinam_store_api_is_customer() ? get_current_user_id() : 0;
	$countries = WC()->countries->get_shipping_countries();
	$response  = array(
		'authenticated' => (bool) $user_id,
		'csrf'          => harinam_store_api_guest_csrf(),
		'user'          => $user_id ? harinam_store_api_user_data( $user_id ) : null,
		'nonce'         => $user_id ? wp_create_nonce( 'wp_rest' ) : null,
		'countries'     => $countries,
	);
	return rest_ensure_response( $response );
}

function harinam_store_api_register( $request ) {
	$check = harinam_store_api_public_write_checks( $request, 'register', 5, HOUR_IN_SECONDS );
	if ( is_wp_error( $check ) ) {
		return $check;
	}
	$name     = sanitize_text_field( (string) $request->get_param( 'name' ) );
	$email    = sanitize_email( (string) $request->get_param( 'email' ) );
	$password = (string) $request->get_param( 'password' );
	if ( strlen( trim( $name ) ) < 2 || ! is_email( $email ) || strlen( $password ) < 8 ) {
		return new WP_Error( 'harinam_invalid_registration', 'Enter a valid name, email and password of at least 8 characters.', array( 'status' => 400 ) );
	}
	if ( email_exists( $email ) ) {
		return new WP_Error( 'harinam_email_exists', 'An account with this email already exists.', array( 'status' => 409 ) );
	}
	$user_id = wc_create_new_customer( $email, '', $password );
	if ( is_wp_error( $user_id ) ) {
		return new WP_Error( 'harinam_registration_failed', 'Account could not be created. Please try again.', array( 'status' => 400 ) );
	}
	$parts = preg_split( '/\s+/', trim( $name ), 2 );
	wp_update_user(
		array(
			'ID'           => $user_id,
			'first_name'   => $parts[0],
			'last_name'    => $parts[1] ?? '',
			'display_name' => trim( $name ),
		)
	);
	wp_set_current_user( $user_id );
	wp_set_auth_cookie( $user_id, true, true );
	return rest_ensure_response(
		array(
			'authenticated' => true,
			'user'          => harinam_store_api_user_data( $user_id ),
			'nonce'         => wp_create_nonce( 'wp_rest' ),
		)
	);
}

function harinam_store_api_login( $request ) {
	$check = harinam_store_api_public_write_checks( $request, 'login', 10, 10 * MINUTE_IN_SECONDS );
	if ( is_wp_error( $check ) ) {
		return $check;
	}
	$email    = sanitize_email( (string) $request->get_param( 'email' ) );
	$password = (string) $request->get_param( 'password' );
	if ( ! is_email( $email ) || '' === $password ) {
		return new WP_Error( 'harinam_invalid_login', 'Email or password is incorrect.', array( 'status' => 401 ) );
	}
	$candidate = get_user_by( 'email', $email );
	if ( ! $candidate || ! harinam_store_api_is_customer( $candidate->ID ) ) {
		return new WP_Error( 'harinam_invalid_login', 'Email or password is incorrect.', array( 'status' => 401 ) );
	}
	$user = wp_signon(
		array(
			'user_login'    => $email,
			'user_password' => $password,
			'remember'      => true,
		),
		true
	);
	if ( is_wp_error( $user ) ) {
		return new WP_Error( 'harinam_invalid_login', 'Email or password is incorrect.', array( 'status' => 401 ) );
	}
	wp_set_current_user( $user->ID );
	return rest_ensure_response(
		array(
			'authenticated' => true,
			'user'          => harinam_store_api_user_data( $user->ID ),
			'nonce'         => wp_create_nonce( 'wp_rest' ),
		)
	);
}

function harinam_store_api_logout() {
	wp_logout();
	return rest_ensure_response( array( 'authenticated' => false, 'csrf' => harinam_store_api_guest_csrf() ) );
}

function harinam_store_api_password_reset( $request ) {
	$check = harinam_store_api_public_write_checks( $request, 'password_reset', 5, HOUR_IN_SECONDS );
	if ( is_wp_error( $check ) ) {
		return $check;
	}
	$email = sanitize_email( (string) $request->get_param( 'email' ) );
	if ( is_email( $email ) ) {
		$user = get_user_by( 'email', $email );
		if ( $user ) {
			retrieve_password( $user->user_login );
		}
	}
	return rest_ensure_response( array( 'message' => 'If an account exists for this email, a secure reset link has been sent.' ) );
}

function harinam_store_api_profile( $request ) {
	$first_name = sanitize_text_field( (string) $request->get_param( 'firstName' ) );
	$last_name  = sanitize_text_field( (string) $request->get_param( 'lastName' ) );
	$email      = sanitize_email( (string) $request->get_param( 'email' ) );
	$phone      = wc_format_phone_number( (string) $request->get_param( 'phone' ) );
	if ( strlen( $first_name ) < 2 || strlen( $last_name ) < 2 || ! is_email( $email ) || ( $phone && ! WC_Validation::is_phone( $phone ) ) ) {
		return new WP_Error( 'harinam_invalid_profile', 'Enter valid profile details.', array( 'status' => 400 ) );
	}
	$existing = email_exists( $email );
	if ( $existing && get_current_user_id() !== (int) $existing ) {
		return new WP_Error( 'harinam_email_exists', 'An account with this email already exists.', array( 'status' => 409 ) );
	}
	$result = wp_update_user(
		array(
			'ID'           => get_current_user_id(),
			'first_name'   => $first_name,
			'last_name'    => $last_name,
			'display_name' => trim( $first_name . ' ' . $last_name ),
			'user_email'   => $email,
		)
	);
	if ( is_wp_error( $result ) ) {
		return new WP_Error( 'harinam_profile_failed', 'Profile could not be updated.', array( 'status' => 400 ) );
	}
	update_user_meta( get_current_user_id(), 'billing_phone', $phone );
	return rest_ensure_response(
		array(
			'user'  => harinam_store_api_user_data( get_current_user_id() ),
			'nonce' => wp_create_nonce( 'wp_rest' ),
		)
	);
}

function harinam_store_api_product_data( $product ) {
	$images = array();
	foreach ( array_merge( array( $product->get_image_id() ), $product->get_gallery_image_ids() ) as $image_id ) {
		$url = $image_id ? wp_get_attachment_image_url( $image_id, 'full' ) : '';
		if ( $url ) {
			$images[] = $url;
		}
	}
	if ( ! $images ) {
		$images[] = wc_placeholder_img_src( 'woocommerce_single' );
	}
	$terms      = wp_get_post_terms( $product->get_id(), 'product_cat' );
	$categories = array();
	foreach ( is_wp_error( $terms ) ? array() : $terms as $term ) {
		$categories[] = $term->name;
		foreach ( get_ancestors( $term->term_id, 'product_cat', 'taxonomy' ) as $ancestor_id ) {
			$ancestor = get_term( $ancestor_id, 'product_cat' );
			if ( $ancestor && ! is_wp_error( $ancestor ) ) {
				$categories[] = $ancestor->name;
			}
		}
	}
	$categories = array_values( array_unique( $categories ) );
	$attributes = array();
	$style      = '';
	$styles     = array();
	foreach ( $product->get_attributes() as $attribute ) {
		$name    = wc_attribute_label( $attribute->get_name(), $product );
		$options = $attribute->is_taxonomy()
			? wc_get_product_terms( $product->get_id(), $attribute->get_name(), array( 'fields' => 'names' ) )
			: $attribute->get_options();
		$attributes[] = array( 'name' => $name, 'options' => array_values( $options ) );
		if ( 'style' === sanitize_title( $name ) ) {
			$style = implode( ', ', $options );
			$styles = array_values( $options );
		}
	}
	$variations = array();
	if ( $product->is_type( 'variable' ) ) {
		foreach ( $product->get_children() as $variation_id ) {
			$variation = wc_get_product( $variation_id );
			if ( ! $variation || 'publish' !== $variation->get_status() ) {
				continue;
			}
			$values = array();
			foreach ( $variation->get_variation_attributes() as $key => $value ) {
				$taxonomy = str_replace( 'attribute_', '', $key );
				$term     = taxonomy_exists( $taxonomy ) ? get_term_by( 'slug', $value, $taxonomy ) : false;
				$values[] = array( 'name' => wc_attribute_label( $taxonomy, $product ), 'value' => $term ? $term->name : $value );
			}
			$variation_image = wp_get_attachment_image_url( $variation->get_image_id(), 'full' );
			$variations[]    = array(
				'id'         => $variation->get_id(),
				'sku'        => $variation->get_sku(),
				'attributes' => $values,
				'price'      => (float) wc_get_price_to_display( $variation ),
				'priceToken' => harinam_store_api_price_token( $variation ),
				'oldPrice'   => (float) wc_get_price_to_display( $variation, array( 'price' => $variation->get_regular_price() ?: $variation->get_price() ) ),
				'image'      => $variation_image ?: $images[0],
				'available'  => $variation->is_purchasable() && $variation->is_in_stock(),
				'stock'      => $variation->managing_stock() ? $variation->get_stock_quantity() : null,
			);
		}
	}
	$reviews = get_comments(
		array(
			'post_id' => $product->get_id(),
			'status'  => 'approve',
			'type'    => 'review',
			'number'  => 10,
		)
	);
	$price_product = $product;
	$price         = $product->is_type( 'variable' ) ? $product->get_variation_price( 'min', true ) : wc_get_price_to_display( $price_product );
	$regular       = $product->is_type( 'variable' ) ? $product->get_variation_regular_price( 'min', true ) : wc_get_price_to_display( $price_product, array( 'price' => $product->get_regular_price() ?: $product->get_price() ) );
	return array(
		'id'          => $product->get_id(),
		'slug'        => $product->get_slug(),
		'sku'         => $product->get_sku(),
		'name'        => $product->get_name(),
		'type'        => $product->get_type(),
		'description'      => wp_strip_all_tags( $product->get_short_description() ?: $product->get_description() ),
		'shortDescription' => wp_strip_all_tags( $product->get_short_description() ),
		'fullDescription'  => wp_strip_all_tags( $product->get_description() ),
		'image'       => $images[0],
		'images'      => array_values( array_unique( $images ) ),
		'imageKey'    => $product->get_slug(),
		'category'    => is_wp_error( $categories ) || ! $categories ? 'Products' : $categories[0],
		'categories'  => is_wp_error( $categories ) ? array() : array_values( $categories ),
		'style'       => $style,
		'styles'      => $styles,
		'attributes'  => $attributes,
		'variations'  => $variations,
		'price'       => (float) $price,
		'priceToken'  => harinam_store_api_price_token( $product ),
		'oldPrice'    => (float) ( $regular ?: $price ),
		'currency'    => get_woocommerce_currency(),
		'rating'      => (float) $product->get_average_rating(),
		'reviewCount' => (int) $product->get_review_count(),
		'totalSales'  => (int) $product->get_total_sales(),
		'available'   => $product->is_purchasable() && $product->is_in_stock() && ( ! $product->is_type( 'variable' ) || (bool) $variations ),
		'stock'       => $product->managing_stock() ? $product->get_stock_quantity() : null,
		'listed'      => true,
		'reviews'     => array_map(
			function ( $review ) {
				return array(
					'id'     => (int) $review->comment_ID,
					'name'   => $review->comment_author,
					'date'   => mysql2date( 'F j, Y', $review->comment_date ),
					'rating' => (int) get_comment_meta( $review->comment_ID, 'rating', true ),
					'text'   => wp_strip_all_tags( $review->comment_content ),
				);
			},
			$reviews
		),
	);
}

function harinam_store_api_price_token( $product ) {
	$modified = $product->get_date_modified();
	$raw_price = (string) get_post_meta( $product->get_id(), '_price', true );
	return wp_hash( $product->get_id() . '|' . $raw_price . '|' . ( $modified ? $modified->getTimestamp() : 0 ), 'harinam_price' );
}

function harinam_store_api_products( $request ) {
	$wc = harinam_store_api_require_wc();
	if ( is_wp_error( $wc ) ) {
		return $wc;
	}
	$page     = max( 1, (int) $request->get_param( 'page' ) );
	$per_page = min( 100, max( 1, (int) $request->get_param( 'per_page' ) ) );
	$result   = wc_get_products(
		array(
			'status'   => 'publish',
			'limit'    => $per_page,
			'page'     => $page,
			'paginate' => true,
			'orderby'  => 'menu_order',
			'order'    => 'ASC',
		)
	);
	return rest_ensure_response(
		array(
			'products'    => array_map( 'harinam_store_api_product_data', $result->products ),
			'page'        => $page,
			'total'       => (int) $result->total,
			'total_pages' => (int) $result->max_num_pages,
		)
	);
}

function harinam_store_api_product( $request ) {
	$wc = harinam_store_api_require_wc();
	if ( is_wp_error( $wc ) ) {
		return $wc;
	}
	$product = wc_get_product( absint( $request['id'] ) );
	return $product && 'publish' === $product->get_status()
		? rest_ensure_response( harinam_store_api_product_data( $product ) )
		: new WP_Error( 'harinam_product_not_found', 'Product not found.', array( 'status' => 404 ) );
}

function harinam_store_api_review( $request ) {
	$limit = harinam_store_api_rate_limit( 'review_' . get_current_user_id(), 5, HOUR_IN_SECONDS );
	if ( is_wp_error( $limit ) ) {
		return $limit;
	}
	$product = wc_get_product( absint( $request['id'] ) );
	$rating  = absint( $request->get_param( 'rating' ) );
	$text    = sanitize_textarea_field( (string) $request->get_param( 'text' ) );
	if ( ! $product || 'publish' !== $product->get_status() || $rating < 1 || $rating > 5 || mb_strlen( $text ) < 10 ) {
		return new WP_Error( 'harinam_invalid_review', 'Enter a valid rating and review.', array( 'status' => 400 ) );
	}
	$user       = wp_get_current_user();
	if ( 'yes' === get_option( 'woocommerce_review_rating_verification_required' ) && ! wc_customer_bought_product( $user->user_email, $user->ID, $product->get_id() ) ) {
		return new WP_Error( 'harinam_verified_owner_required', 'Only verified owners can review this product.', array( 'status' => 403 ) );
	}
	$comment_id = wp_insert_comment(
		array(
			'comment_post_ID'      => $product->get_id(),
			'comment_author'       => $user->display_name,
			'comment_author_email' => $user->user_email,
			'comment_content'      => $text,
			'comment_type'         => 'review',
			'comment_parent'       => 0,
			'user_id'              => $user->ID,
			'comment_approved'     => get_option( 'comment_moderation' ) ? 0 : 1,
		)
	);
	if ( ! $comment_id ) {
		return new WP_Error( 'harinam_review_failed', 'Review could not be submitted.', array( 'status' => 400 ) );
	}
	update_comment_meta( $comment_id, 'rating', $rating );
	return new WP_REST_Response( array( 'message' => 'Review submitted for moderation.' ), 201 );
}

function harinam_store_api_validate_items( $raw_items, $check_expected_price = true ) {
	if ( ! is_array( $raw_items ) || ! $raw_items ) {
		return new WP_Error( 'harinam_empty_cart', 'Your cart is empty.', array( 'status' => 400 ) );
	}
	$items = array();
	foreach ( $raw_items as $raw ) {
		$product_id   = absint( $raw['product_id'] ?? $raw['productId'] ?? $raw['id'] ?? 0 );
		$variation_id = absint( $raw['variation_id'] ?? $raw['variationId'] ?? 0 );
		$quantity     = filter_var( $raw['quantity'] ?? null, FILTER_VALIDATE_INT );
		$parent       = wc_get_product( $product_id );
		$product      = $variation_id ? wc_get_product( $variation_id ) : $parent;
		if ( ! $parent || 'publish' !== $parent->get_status() ) {
			return new WP_Error( 'harinam_invalid_product', 'One or more products are invalid or unavailable.', array( 'status' => 400 ) );
		}
		if ( $variation_id && ( ! $product || ! $product->is_type( 'variation' ) || $product->get_parent_id() !== $product_id ) ) {
			return new WP_Error( 'harinam_invalid_variation', 'The selected product variation is invalid.', array( 'status' => 400 ) );
		}
		if ( $parent->is_type( 'variable' ) && ! $variation_id ) {
			return new WP_Error( 'harinam_variation_required', 'Select a product variation before checkout.', array( 'status' => 400 ) );
		}
		if ( false === $quantity || $quantity < 1 || $quantity > 99 || ( $product->is_sold_individually() && 1 !== $quantity ) ) {
			return new WP_Error( 'harinam_invalid_quantity', 'One or more product quantities are invalid.', array( 'status' => 400 ) );
		}
		if ( ! $product->is_purchasable() || ! $product->is_in_stock() || ! $product->has_enough_stock( $quantity ) ) {
			return new WP_Error( 'harinam_out_of_stock', 'One or more products are out of stock.', array( 'status' => 409 ) );
		}
		$display_price = (float) wc_get_price_to_display( $product );
		if ( $check_expected_price ) {
			$expected = sanitize_text_field( (string) ( $raw['expected_price_token'] ?? $raw['priceToken'] ?? '' ) );
			if ( ! $expected || ! hash_equals( harinam_store_api_price_token( $product ), $expected ) ) {
				return new WP_Error( 'harinam_price_changed', 'A product price has changed. Refresh your cart before checkout.', array( 'status' => 409 ) );
			}
		}
		$items[] = array(
			'product_id'   => $product_id,
			'variation_id' => $variation_id,
			'quantity'     => $quantity,
			'product'      => $product,
			'name'         => $product->get_name(),
			'image'        => wp_get_attachment_image_url( $product->get_image_id(), 'woocommerce_thumbnail' ) ?: wc_placeholder_img_src(),
			'price'        => $display_price,
			'price_token'  => harinam_store_api_price_token( $product ),
		);
	}
	return $items;
}

function harinam_store_api_public_item( $item ) {
	return array(
		'productId'   => $item['product_id'],
		'variationId' => $item['variation_id'],
		'quantity'    => $item['quantity'],
		'name'        => $item['name'],
		'image'       => $item['image'],
		'price'       => $item['price'],
		'priceToken'  => $item['price_token'],
		'currency'    => get_woocommerce_currency(),
	);
}

function harinam_store_api_validate_cart( $request ) {
	$check = harinam_store_api_public_write_checks( $request, 'cart_validate', 60, 10 * MINUTE_IN_SECONDS );
	if ( is_wp_error( $check ) ) {
		return $check;
	}
	$items = harinam_store_api_validate_items( $request->get_param( 'items' ) );
	if ( is_wp_error( $items ) ) {
		return $items;
	}
	return rest_ensure_response( array( 'valid' => true, 'items' => array_map( 'harinam_store_api_public_item', $items ) ) );
}

function harinam_store_api_address( $raw ) {
	if ( ! is_array( $raw ) ) {
		return new WP_Error( 'harinam_invalid_address', 'Enter a valid delivery address.', array( 'status' => 400 ) );
	}
	$country  = strtoupper( sanitize_text_field( (string) ( $raw['country'] ?? '' ) ) );
	$countries = WC()->countries->get_shipping_countries();
	if ( ! isset( $countries[ $country ] ) ) {
		return new WP_Error( 'harinam_invalid_country', 'Shipping is not available for this country.', array( 'status' => 400 ) );
	}
	$full_name = sanitize_text_field( (string) ( $raw['fullName'] ?? '' ) );
	$parts     = preg_split( '/\s+/', trim( $full_name ), 2 );
	$phone     = wc_format_phone_number( (string) ( $raw['phone'] ?? '' ) );
	$postcode  = wc_format_postcode( sanitize_text_field( (string) ( $raw['postalCode'] ?? '' ) ), $country );
	$address   = sanitize_text_field( (string) ( $raw['address'] ?? '' ) );
	$city      = sanitize_text_field( (string) ( $raw['city'] ?? '' ) );
	$state     = sanitize_text_field( (string) ( $raw['state'] ?? '' ) );
	$states    = WC()->countries->get_states( $country );
	if ( is_array( $states ) && $states ) {
		$state_key = strtoupper( $state );
		if ( ! isset( $states[ $state_key ] ) ) {
			$state_key = array_search( strtolower( $state ), array_map( 'strtolower', $states ), true );
		}
		if ( false === $state_key ) {
			return new WP_Error( 'harinam_invalid_state', 'Select a valid state or region.', array( 'status' => 400 ) );
		}
		$state = $state_key;
	}
	if ( strlen( $full_name ) < 2 || strlen( $address ) < 5 || strlen( $city ) < 2 || ! WC_Validation::is_phone( $phone ) || ! WC_Validation::is_postcode( $postcode, $country ) ) {
		return new WP_Error( 'harinam_invalid_address', 'Enter a valid name, phone, address, city and postal code.', array( 'status' => 400 ) );
	}
	return array(
		'fullName'   => $full_name,
		'first_name' => $parts[0],
		'last_name'  => $parts[1] ?? '',
		'phone'      => $phone,
		'address_1'  => $address,
		'address_2'  => sanitize_text_field( (string) ( $raw['landmark'] ?? '' ) ),
		'city'       => $city,
		'state'      => $state,
		'postcode'   => $postcode,
		'country'    => $country,
	);
}

function harinam_store_api_prepare_cart( $items, $address, $requested_methods = array() ) {
	if ( ! WC()->session ) {
		WC()->initialize_session();
	}
	if ( ! WC()->cart ) {
		WC()->initialize_cart();
	}
	$customer = new WC_Customer( get_current_user_id(), true );
	foreach ( array( 'country', 'state', 'postcode', 'city', 'address_1', 'address_2' ) as $field ) {
		$setter = 'set_shipping_' . $field;
		$customer->$setter( $address[ $field ] );
	}
	$customer->set_billing_country( $address['country'] );
	$customer->set_calculated_shipping( true );
	WC()->customer = $customer;
	WC()->cart->empty_cart( true );
	foreach ( $items as $item ) {
		$attributes = $item['variation_id'] ? $item['product']->get_variation_attributes() : array();
		$added      = WC()->cart->add_to_cart( $item['product_id'], $item['quantity'], $item['variation_id'], $attributes );
		if ( ! $added ) {
			wc_clear_notices();
			return new WP_Error( 'harinam_cart_rejected', 'WooCommerce rejected one or more cart items.', array( 'status' => 409 ) );
		}
	}
	WC()->session->set( 'chosen_shipping_methods', array() );
	WC()->cart->calculate_shipping();
	WC()->cart->calculate_totals();
	$packages = WC()->shipping()->get_packages();
	$chosen   = array();
	foreach ( $packages as $index => $package ) {
		$rates = $package['rates'] ?? array();
		if ( ! $rates && WC()->cart->needs_shipping() ) {
			return new WP_Error( 'harinam_shipping_unavailable', 'No WooCommerce shipping method is available for this address.', array( 'status' => 409 ) );
		}
		$requested = sanitize_text_field( (string) ( $requested_methods[ $index ] ?? '' ) );
		$chosen[]  = $requested && isset( $rates[ $requested ] ) ? $requested : ( $rates ? array_key_first( $rates ) : '' );
	}
	WC()->session->set( 'chosen_shipping_methods', $chosen );
	WC()->cart->calculate_shipping();
	WC()->cart->calculate_totals();
	return array( 'packages' => WC()->shipping()->get_packages(), 'chosen' => $chosen );
}

function harinam_store_api_gateway( $country ) {
	$currency = get_woocommerce_currency();
	if ( 'IN' === $country && 'INR' !== $currency ) {
		return new WP_Error( 'harinam_india_currency_blocker', 'India checkout requires WooCommerce currency INR. Configure the existing multi-currency solution to return INR for India.', array( 'status' => 409 ) );
	}
	$paypal_currencies = apply_filters( 'harinam_paypal_supported_currencies', array( 'AUD', 'BRL', 'CAD', 'CNY', 'CZK', 'DKK', 'EUR', 'HKD', 'HUF', 'ILS', 'JPY', 'MYR', 'MXN', 'TWD', 'NZD', 'NOK', 'PHP', 'PLN', 'GBP', 'SGD', 'SEK', 'CHF', 'THB', 'USD' ) );
	if ( 'IN' !== $country && ! in_array( $currency, $paypal_currencies, true ) ) {
		return new WP_Error( 'harinam_paypal_currency_blocker', 'PayPal does not support the active WooCommerce currency ' . $currency . '. Configure the existing WooCommerce multi-currency solution with a PayPal-supported currency; no custom conversion is performed.', array( 'status' => 409 ) );
	}
	$id       = 'IN' === $country ? 'paytm' : 'ppcp-gateway';
	$gateways = WC()->payment_gateways()->payment_gateways();
	$gateway  = $gateways[ $id ] ?? null;
	if ( ! $gateway || 'yes' !== $gateway->enabled || ! $gateway->is_available() ) {
		return new WP_Error( 'harinam_gateway_unavailable', ( 'paytm' === $id ? 'Official Paytm Payment Gateway' : 'Official WooCommerce PayPal Payments' ) . ' is not installed, enabled, configured or available for this order.', array( 'status' => 409 ) );
	}
	if ( 'paytm' === $id ) {
		$settings = get_option( 'woocommerce_paytm_settings', array() );
		if ( ! is_a( $gateway, 'WC_Paytm' ) || empty( $settings['merchant_id'] ) || empty( $settings['merchant_key'] ) || empty( $settings['website'] ) ) {
			return new WP_Error( 'harinam_paytm_configuration_blocker', 'Official Paytm gateway settings are incomplete. Configure Merchant ID, Merchant Key and Website in WooCommerce > Settings > Payments > Paytm.', array( 'status' => 409 ) );
		}
	}
	if ( 'ppcp-gateway' === $id && false === strpos( get_class( $gateway ), 'WooCommerce\\PayPalCommerce\\' ) ) {
		return new WP_Error( 'harinam_paypal_plugin_blocker', 'The official WooCommerce PayPal Payments plugin is required.', array( 'status' => 409 ) );
	}
	return $gateway;
}

function harinam_store_api_quote_data( $request ) {
	$items = harinam_store_api_validate_items( $request->get_param( 'items' ) );
	if ( is_wp_error( $items ) ) {
		return $items;
	}
	$address = harinam_store_api_address( $request->get_param( 'shipping' ) );
	if ( is_wp_error( $address ) ) {
		return $address;
	}
	$cart = harinam_store_api_prepare_cart( $items, $address, (array) $request->get_param( 'shippingMethods' ) );
	if ( is_wp_error( $cart ) ) {
		return $cart;
	}
	foreach ( $items as &$item ) {
		$item['price'] = (float) wc_get_price_to_display( $item['product'] );
	}
	unset( $item );
	$gateway = harinam_store_api_gateway( $address['country'] );
	if ( is_wp_error( $gateway ) ) {
		return $gateway;
	}
	$methods = array();
	foreach ( $cart['packages'] as $index => $package ) {
		$choices = array();
		foreach ( $package['rates'] ?? array() as $rate ) {
			$choices[] = array(
				'id'    => $rate->get_id(),
				'label' => $rate->get_label(),
				'cost'  => (float) $rate->get_cost() + array_sum( $rate->get_taxes() ),
			);
		}
		$methods[] = array( 'package' => $index, 'selected' => $cart['chosen'][ $index ] ?? '', 'choices' => $choices );
	}
	$totals = WC()->cart->get_totals();
	return array(
		'items'            => $items,
		'address'          => $address,
		'gateway'          => $gateway,
		'gateway_data'     => array( 'id' => $gateway->id, 'title' => wp_strip_all_tags( $gateway->get_title() ) ),
		'packages'         => $cart['packages'],
		'shipping_methods' => $methods,
		'totals'           => array(
			'subtotal' => (float) $totals['subtotal'],
			'shipping' => (float) $totals['shipping_total'],
			'tax'      => (float) $totals['total_tax'],
			'total'    => (float) $totals['total'],
			'currency' => get_woocommerce_currency(),
		),
	);
}

function harinam_store_api_public_quote( $quote ) {
	return array(
		'items'           => array_map( 'harinam_store_api_public_item', $quote['items'] ),
		'gateway'         => $quote['gateway_data'],
		'shippingMethods' => $quote['shipping_methods'],
		'totals'          => $quote['totals'],
	);
}

function harinam_store_api_quote( $request ) {
	$limit = harinam_store_api_rate_limit( 'quote_' . get_current_user_id(), 30, 10 * MINUTE_IN_SECONDS );
	if ( is_wp_error( $limit ) ) {
		return $limit;
	}
	$quote = harinam_store_api_quote_data( $request );
	return is_wp_error( $quote ) ? $quote : rest_ensure_response( harinam_store_api_public_quote( $quote ) );
}

function harinam_store_api_checkout( $request ) {
	$limit = harinam_store_api_rate_limit( 'checkout_' . get_current_user_id(), 10, 10 * MINUTE_IN_SECONDS );
	if ( is_wp_error( $limit ) ) {
		return $limit;
	}
	$key = sanitize_text_field( (string) $request->get_header( 'idempotency-key' ) );
	if ( ! preg_match( '/^[A-Za-z0-9_-]{16,128}$/', $key ) ) {
		return new WP_Error( 'harinam_idempotency_required', 'A valid checkout Idempotency-Key is required.', array( 'status' => 400 ) );
	}
	$option   = 'harinam_checkout_' . substr( hash( 'sha256', get_current_user_id() . '|' . $key ), 0, 40 );
	$existing = get_option( $option );
	if ( is_array( $existing ) && ! empty( $existing['started'] ) && (int) $existing['started'] < time() - 5 * MINUTE_IN_SECONDS ) {
		delete_option( $option );
		$existing = false;
	}
	if ( is_array( $existing ) && ! empty( $existing['order_id'] ) ) {
		$order = wc_get_order( absint( $existing['order_id'] ) );
		if ( $order && get_current_user_id() === (int) $order->get_customer_id() ) {
			return rest_ensure_response( array( 'reused' => true, 'order' => harinam_store_api_order_data( $order ) ) );
		}
	}
	if ( $existing ) {
		return new WP_Error( 'harinam_checkout_in_progress', 'This checkout request is already being processed. Retry with the same key.', array( 'status' => 409 ) );
	}
	if ( ! add_option( $option, array( 'started' => time() ), '', false ) ) {
		return new WP_Error( 'harinam_checkout_in_progress', 'This checkout request is already being processed. Retry with the same key.', array( 'status' => 409 ) );
	}
	$quote = harinam_store_api_quote_data( $request );
	if ( is_wp_error( $quote ) ) {
		delete_option( $option );
		return $quote;
	}
	$requested_gateway = sanitize_key( (string) $request->get_param( 'gateway' ) );
	if ( ! $requested_gateway || $requested_gateway !== $quote['gateway']->id || in_array( $requested_gateway, array( 'cod', 'cheque', 'bacs' ), true ) ) {
		delete_option( $option );
		return new WP_Error( 'harinam_gateway_rejected', 'The selected payment method is not allowed for this country.', array( 'status' => 400 ) );
	}
	$order = wc_create_order( array( 'customer_id' => get_current_user_id(), 'status' => 'pending', 'created_via' => 'harinam-store-api' ) );
	if ( is_wp_error( $order ) ) {
		delete_option( $option );
		return new WP_Error( 'harinam_order_failed', 'The order could not be created.', array( 'status' => 500 ) );
	}
	update_option( $option, array( 'order_id' => $order->get_id(), 'created' => time() ), false );
	wp_schedule_single_event( time() + DAY_IN_SECONDS, 'harinam_store_api_delete_idempotency_key', array( $option ) );
	try {
		$address = $quote['address'];
		$user    = wp_get_current_user();
		$billing = array_merge( $address, array( 'email' => $user->user_email ) );
		$order->set_address( $address, 'shipping' );
		$order->set_address( $billing, 'billing' );
		$order->set_currency( get_woocommerce_currency() );
		foreach ( $quote['items'] as $item ) {
			$order->add_product( $item['product'], $item['quantity'] );
		}
		foreach ( $quote['shipping_methods'] as $package ) {
			$selected = $package['selected'];
			$rate     = $quote['packages'][ $package['package'] ]['rates'][ $selected ] ?? null;
			if ( $rate ) {
				$shipping = new WC_Order_Item_Shipping();
				$shipping->set_method_title( $rate->get_label() );
				$shipping->set_method_id( $rate->get_method_id() );
				$shipping->set_instance_id( $rate->get_instance_id() );
				$shipping->set_total( $rate->get_cost() );
				$shipping->set_taxes( $rate->get_taxes() );
				$order->add_item( $shipping );
			}
		}
		$order->set_payment_method( $quote['gateway'] );
		$order->update_meta_data( '_harinam_store_api', HARINAM_STORE_API_VERSION );
		$order->update_meta_data( '_harinam_idempotency_hash', hash( 'sha256', $key ) );
		$order->calculate_taxes( array( 'country' => $address['country'], 'state' => $address['state'], 'postcode' => $address['postcode'], 'city' => $address['city'] ) );
		$order->calculate_totals( false );
		$order->save();
		$customer = new WC_Customer( get_current_user_id() );
		foreach ( array( 'first_name', 'last_name', 'country', 'state', 'postcode', 'city', 'address_1', 'address_2' ) as $field ) {
			$shipping_setter = 'set_shipping_' . $field;
			$billing_setter  = 'set_billing_' . $field;
			$customer->$shipping_setter( $address[ $field ] );
			$customer->$billing_setter( $address[ $field ] );
		}
		$customer->set_billing_phone( $address['phone'] );
		if ( is_callable( array( $customer, 'set_shipping_phone' ) ) ) {
			$customer->set_shipping_phone( $address['phone'] );
		}
		$customer->save();
		if ( function_exists( 'wc_reserve_stock_for_order' ) ) {
			wc_reserve_stock_for_order( $order );
		}
		do_action( 'woocommerce_checkout_order_processed', $order->get_id(), array(), $order );
		return new WP_REST_Response( array( 'reused' => false, 'order' => harinam_store_api_order_data( $order ) ), 201 );
	} catch ( Throwable $error ) {
		$order->add_order_note( 'Harinam Store API checkout failed before payment handoff.' );
		$order->update_status( 'failed' );
		return new WP_Error( 'harinam_order_failed', 'The order could not be prepared for secure payment.', array( 'status' => 500 ) );
	}
}

function harinam_store_api_delete_idempotency_key( $option ) {
	if ( 0 === strpos( (string) $option, 'harinam_checkout_' ) ) {
		delete_option( $option );
	}
}

function harinam_store_api_payment_state( $order ) {
	if ( $order->is_paid() ) {
		return 'paid';
	}
	if ( $order->has_status( 'cancelled' ) ) {
		return 'cancelled';
	}
	if ( $order->has_status( 'failed' ) ) {
		return 'failed';
	}
	return 'pending';
}

function harinam_store_api_tracking_data( $order ) {
	$status  = $order->get_status();
	$paid    = $order->is_paid();
	$current = 'pending';
	if ( $order->has_status( array( 'failed', 'cancelled' ) ) ) {
		$current = $status;
	} elseif ( $paid ) {
		$current = in_array( $status, array( 'completed', 'shipped', 'out-for-delivery' ), true ) ? $status : 'processing';
	}
	$steps = array(
		array( 'status' => 'pending', 'label' => 'Payment verification' ),
		array( 'status' => 'processing', 'label' => 'Preparing your order' ),
		array( 'status' => 'shipped', 'label' => 'Shipped' ),
		array( 'status' => 'out-for-delivery', 'label' => 'Out for delivery' ),
		array( 'status' => 'completed', 'label' => 'Delivered' ),
	);
	if ( in_array( $current, array( 'failed', 'cancelled' ), true ) ) {
		$steps = array( array( 'status' => $current, 'label' => 'Payment ' . $current, 'state' => 'current', 'at' => $order->get_date_modified()->date( DATE_ATOM ) ) );
	} else {
		$index = array_search( $current, wp_list_pluck( $steps, 'status' ), true );
		foreach ( $steps as $position => &$step ) {
			$step['state'] = $position < $index ? 'complete' : ( $position === $index ? 'current' : 'upcoming' );
			$step['at']    = 0 === $position ? $order->get_date_created()->date( DATE_ATOM ) : ( 1 === $position && $paid && $order->get_date_paid() ? $order->get_date_paid()->date( DATE_ATOM ) : null );
		}
		unset( $step );
	}
	$shipment = $order->get_meta( '_wc_shipment_tracking_items', true );
	return array(
		'currentStatus' => $current,
		'steps'         => $steps,
		'shipment'      => is_array( $shipment ) ? array_map(
			function ( $item ) {
				return array(
					'provider' => sanitize_text_field( (string) ( $item['tracking_provider'] ?? $item['custom_tracking_provider'] ?? '' ) ),
					'number'   => sanitize_text_field( (string) ( $item['tracking_number'] ?? '' ) ),
					'url'      => esc_url_raw( (string) ( $item['custom_tracking_link'] ?? '' ) ),
				);
			},
			$shipment
		) : array(),
	);
}

function harinam_store_api_order_data( $order ) {
	$items = array();
	foreach ( $order->get_items() as $item ) {
		$product = $item->get_product();
		$items[] = array(
			'productId'   => $product && $product->is_type( 'variation' ) ? $product->get_parent_id() : $item->get_product_id(),
			'variationId' => $item->get_variation_id(),
			'name'        => $item->get_name(),
			'quantity'    => $item->get_quantity(),
			'total'       => (float) $order->get_line_total( $item, true ),
			'image'       => $product ? ( wp_get_attachment_image_url( $product->get_image_id(), 'woocommerce_thumbnail' ) ?: wc_placeholder_img_src() ) : '',
		);
	}
	$shipping = $order->get_address( 'shipping' );
	return array(
		'id'           => $order->get_id(),
		'number'       => $order->get_order_number(),
		'status'       => $order->get_status(),
		'statusLabel'  => wc_get_order_status_name( $order->get_status() ),
		'paymentState' => harinam_store_api_payment_state( $order ),
		'paid'         => $order->is_paid(),
		'payment'      => array( 'method' => $order->get_payment_method(), 'label' => $order->get_payment_method_title() ),
		'paymentUrl'   => $order->needs_payment() ? $order->get_checkout_payment_url( true ) : null,
		'items'        => $items,
		'totals'       => array(
			'subtotal' => (float) $order->get_subtotal(),
			'shipping' => (float) $order->get_shipping_total(),
			'tax'      => (float) $order->get_total_tax(),
			'total'    => (float) $order->get_total(),
			'currency' => $order->get_currency(),
		),
		'shipping'     => array(
			'fullName'   => trim( $shipping['first_name'] . ' ' . $shipping['last_name'] ),
			'phone'      => $order->get_billing_phone(),
			'address'    => $shipping['address_1'],
			'landmark'   => $shipping['address_2'],
			'city'       => $shipping['city'],
			'state'      => $shipping['state'],
			'postalCode' => $shipping['postcode'],
			'country'    => $shipping['country'],
		),
		'createdAt'    => $order->get_date_created()->date( DATE_ATOM ),
		'tracking'     => harinam_store_api_tracking_data( $order ),
	);
}

function harinam_store_api_owned_order( $id ) {
	$order = wc_get_order( absint( $id ) );
	return $order && get_current_user_id() === (int) $order->get_customer_id()
		? $order
		: new WP_Error( 'harinam_order_not_found', 'Order not found.', array( 'status' => 404 ) );
}

function harinam_store_api_orders() {
	$orders = wc_get_orders(
		array(
			'customer_id' => get_current_user_id(),
			'limit'       => 50,
			'orderby'     => 'date',
			'order'       => 'DESC',
		)
	);
	return rest_ensure_response( array( 'orders' => array_map( 'harinam_store_api_order_data', $orders ) ) );
}

function harinam_store_api_order( $request ) {
	$order = harinam_store_api_owned_order( $request['id'] );
	return is_wp_error( $order ) ? $order : rest_ensure_response( harinam_store_api_order_data( $order ) );
}

function harinam_store_api_tracking( $request ) {
	$reference = sanitize_text_field( (string) $request['reference'] );
	$order     = ctype_digit( $reference ) ? harinam_store_api_owned_order( $reference ) : null;
	if ( ! $order || is_wp_error( $order ) ) {
		$orders = wc_get_orders( array( 'customer_id' => get_current_user_id(), 'limit' => 100 ) );
		$order  = null;
		foreach ( $orders as $candidate ) {
			if ( 0 === strcasecmp( $reference, (string) $candidate->get_order_number() ) ) {
				$order = $candidate;
				break;
			}
		}
	}
	if ( ! $order ) {
		return new WP_Error( 'harinam_order_not_found', 'Order not found.', array( 'status' => 404 ) );
	}
	return rest_ensure_response( array( 'order' => harinam_store_api_order_data( $order ), 'tracking' => harinam_store_api_tracking_data( $order ) ) );
}

function harinam_store_api_filter_gateways( $gateways ) {
	foreach ( array( 'cod', 'cheque', 'bacs' ) as $offline ) {
		unset( $gateways[ $offline ] );
	}
	$order_id = absint( get_query_var( 'order-pay' ) );
	$order    = $order_id ? wc_get_order( $order_id ) : null;
	if ( $order && $order->get_meta( '_harinam_store_api' ) ) {
		$allowed = $order->get_payment_method();
	} else {
		$country = WC()->customer ? WC()->customer->get_shipping_country() : '';
		$allowed = 'IN' === $country ? 'paytm' : 'ppcp-gateway';
	}
	foreach ( array_keys( $gateways ) as $id ) {
		if ( $id !== $allowed ) {
			unset( $gateways[ $id ] );
		}
	}
	return $gateways;
}

function harinam_store_api_gateway_return_url( $url, $order ) {
	if ( $order instanceof WC_Order && $order->get_meta( '_harinam_store_api' ) ) {
		return add_query_arg( 'order', $order->get_id(), harinam_store_api_origin() . '/checkout.html' );
	}
	return $url;
}
