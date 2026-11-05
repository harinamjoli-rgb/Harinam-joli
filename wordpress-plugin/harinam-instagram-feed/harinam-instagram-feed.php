<?php
/**
 * Plugin Name: Harinam Instagram Feed
 * Description: Public photos and reels for the Harinam Joli storefront, using the connected Instagram source.
 * Version: 1.0.1
 * Requires PHP: 7.4
 * Requires Plugins: instagram-feed
 */
defined( 'ABSPATH' ) || exit;

add_action( 'rest_api_init', function () {
	register_rest_route( 'harinam/v1', '/instagram', array(
		'methods' => 'GET',
		'permission_callback' => '__return_true',
		'callback' => 'harinam_instagram_feed',
		'args' => array( 'cursor' => array(
			'default' => '',
			'validate_callback' => function ( $value ) { return is_string( $value ) && ( '' === $value || preg_match( '/^[a-f0-9]{32}$/D', $value ) ); },
		) ),
	) );
} );

function harinam_instagram_public_posts( $posts ) {
	$result = array();
	foreach ( $posts as $post ) {
		if ( ! is_array( $post ) || empty( $post['id'] ) ) {
			continue;
		}
		$permalink = esc_url_raw( $post['permalink'] ?? '', array( 'https' ) );
		if ( ! in_array( wp_parse_url( $permalink, PHP_URL_HOST ), array( 'instagram.com', 'www.instagram.com' ), true ) ) {
			continue;
		}
		$items = 'CAROUSEL_ALBUM' === ( $post['media_type'] ?? '' ) && ! empty( $post['children']['data'] ) ? $post['children']['data'] : array( $post );
		foreach ( $items as $item ) {
			$url = esc_url_raw( $item['media_url'] ?? '', array( 'https' ) );
			if ( ! $url || false !== strpos( $url, 'access_token=' ) ) {
				continue;
			}
			$thumbnail = esc_url_raw( $item['thumbnail_url'] ?? '', array( 'https' ) );
			$result[] = array(
				'id' => sanitize_text_field( $item['id'] ?? $post['id'] ),
				'type' => 'VIDEO' === ( $item['media_type'] ?? '' ) ? 'VIDEO' : 'IMAGE',
				'url' => $url,
				'thumbnail' => false === strpos( $thumbnail, 'access_token=' ) ? $thumbnail : '',
				'permalink' => $permalink,
				'caption' => sanitize_textarea_field( $post['caption'] ?? '' ),
			);
		}
	}
	return $result;
}

function harinam_instagram_feed( $request ) {
	if ( ! class_exists( '\InstagramFeed\Builder\SBI_Db' ) || ! class_exists( 'SB_Instagram_API_Connect' ) ) {
		return new WP_Error( 'instagram_not_ready', 'Instagram connection is not configured.', array( 'status' => 503 ) );
	}
	// shortcut: Uses the connector's PHP API; recheck this adapter when upgrading beyond 6.14.
	$rows = \InstagramFeed\Builder\SBI_Db::source_query( array( 'username' => 'harinamjoli' ) );
	if ( empty( $rows ) || ! empty( $rows[0]['error'] ) ) {
		return new WP_Error( 'instagram_not_connected', 'Reconnect @harinamjoli in Instagram Feed settings.', array( 'status' => 503 ) );
	}
	$accounts = \InstagramFeed\Builder\SBI_Source::convert_sources_to_connected_accounts( array( $rows[0] ) );
	$account = reset( $accounts );
	if ( ! $account || ! empty( $account['private'] ) ) {
		return new WP_Error( 'instagram_not_public', 'A public Instagram account is required.', array( 'status' => 503 ) );
	}
	$cursor = (string) $request->get_param( 'cursor' );
	$cache_key = 'harinam_ig_' . md5( $account['user_id'] . '|' . $cursor );
	$cached = get_transient( $cache_key );
	if ( false !== $cached ) {
		return rest_ensure_response( $cached );
	}
	if ( $cursor ) {
		$state = get_transient( 'harinam_ig_next_' . $cursor );
		if ( ! is_array( $state ) || $state['account'] !== (string) $account['user_id'] ) {
			return new WP_Error( 'instagram_cursor_expired', 'Reload the Instagram feed.', array( 'status' => 410 ) );
		}
		$connection = new SB_Instagram_API_Connect( $state['url'] );
	} else {
		$connection = new SB_Instagram_API_Connect( $account, 'users', array( 'num' => 50 ) );
	}
	$connection->connect();
	if ( $connection->has_encryption_error() || $connection->is_wp_error() || $connection->is_instagram_error() ) {
		return new WP_Error( 'instagram_unavailable', 'Instagram is temporarily unavailable.', array( 'status' => 503 ) );
	}
	$data = $connection->get_data();
	$next_url = $connection->get_next_page( 'users' );
	$next = '';
	if ( $next_url && 'https' === wp_parse_url( $next_url, PHP_URL_SCHEME ) && in_array( wp_parse_url( $next_url, PHP_URL_HOST ), array( 'graph.instagram.com', 'graph.facebook.com' ), true ) ) {
		$next = wp_hash( $next_url );
		// Keep the provider's next URL and access token on the server, behind an opaque cursor.
		set_transient( 'harinam_ig_next_' . $next, array( 'url' => $next_url, 'account' => (string) $account['user_id'] ), HOUR_IN_SECONDS );
	}
	$payload = array( 'posts' => harinam_instagram_public_posts( is_array( $data ) ? $data : array() ), 'next' => $next );
	set_transient( $cache_key, $payload, 10 * MINUTE_IN_SECONDS );
	return rest_ensure_response( $payload );
}
