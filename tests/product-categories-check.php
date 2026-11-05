<?php
// WordPress taxonomy boundary fixture; never creates production products or categories.
class WP_Error {}
function is_wp_error( $value ) { return $value instanceof WP_Error; }
function check( $valid, $message ) { if ( ! $valid ) { throw new Exception( $message ); } }
$terms = array();
$parents = array( 23 => array( 17 ), 24 => array( 17 ), 99 => array( 98 ) );
$taxonomy = array( 17 => (object) array( 'term_id' => 17, 'name' => 'Japa Bag' ), 98 => new WP_Error() );
function wp_get_post_terms( $id, $type ) { check( 'product_cat' === $type, 'Uses WooCommerce product categories.' ); return $GLOBALS['terms']; }
function get_ancestors( $id, $type, $resource ) { check( 'product_cat' === $type && 'taxonomy' === $resource, 'Reads actual taxonomy parents.' ); return $GLOBALS['parents'][ $id ] ?? array(); }
function get_term( $id, $type ) { return $GLOBALS['taxonomy'][ $id ] ?? false; }
class Product { public function get_id() { return 29; } }
$source = file_get_contents( __DIR__ . '/../wordpress-plugin/harinam-store-api/harinam-store-api.php' );
$start = strpos( $source, "\t\$terms      = wp_get_post_terms" );
$end = strpos( $source, "\t\$attributes = array();", $start );
check( false !== $start && false !== $end, 'Category mapping remains inside the shared product serializer.' );
eval( 'function categories( $product ) {' . substr( $source, $start, $end - $start ) . 'return $categories;}' );
$product = new Product();
$terms = array( (object) array( 'term_id' => 23, 'name' => 'Digital Print' ) );
check( array( 'Digital Print', 'Japa Bag' ) === categories( $product ), 'A child-only assignment also appears in its main Japa Bag category.' );
$terms[] = (object) array( 'term_id' => 24, 'name' => 'Hand Work Print' );
$terms[] = $taxonomy[17];
check( array( 'Digital Print', 'Japa Bag', 'Hand Work Print' ) === categories( $product ), 'Multiple child assignments retain their categories without duplicate parents.' );
$terms = array( (object) array( 'term_id' => 30, 'name' => 'Books' ) );
check( array( 'Books' ) === categories( $product ), 'An unrelated category never enters Japa Bag.' );
$terms = array( (object) array( 'term_id' => 99, 'name' => 'Orphan' ) );
check( array( 'Orphan' ) === categories( $product ), 'A taxonomy error cannot fabricate a parent category.' );
foreach ( array( array(), new WP_Error() ) as $terms ) {
	check( array() === categories( $product ), 'Missing or failed category data remains empty.' );
}
define( 'ABSPATH', '/' );
function add_action() {}
function add_filter() {}
require __DIR__ . '/../wordpress-plugin/harinam-store-api/harinam-store-api.php';
check( '1.0.3' === HARINAM_STORE_API_VERSION, 'The complete updated plugin parses and loads.' );
echo "PASS: child-only assignments include real parent categories, with deduplication and safe empty/error handling\n";
