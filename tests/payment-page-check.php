<?php
// Local fixture: no WordPress database, gateway request, live order or payment is created.
define( 'ABSPATH', '/' );
class WP_Error {}
$hooks = array();
$pay_page = false;
$user_id = 7;
$cache_calls = 0;
$shortcode_calls = 0;
$head_calls = 0;
$footer_calls = 0;
function check( $condition, $message ) { if ( ! $condition ) { throw new Exception( $message ); } }
function add_action() {}
function remove_action() {}
function add_filter( $name, $callback ) { $GLOBALS['hooks'][ $name ] = $callback; }
function apply_filters( $name, $value ) { return 'harinam_store_frontend_origin' === $name ? 'http://127.0.0.1:8000' : $value; }
function is_checkout_pay_page() { return $GLOBALS['pay_page']; }
function get_query_var() { return 999; }
function absint( $value ) { return abs( (int) $value ); }
function get_current_user_id() { return $GLOBALS['user_id']; }
function is_user_logged_in() { return get_current_user_id() > 0; }
function is_wp_error( $value ) { return $value instanceof WP_Error; }
function wc_get_order() { return $GLOBALS['fixture_order']; }
function nocache_headers() { $GLOBALS['cache_calls']++; }
function esc_html( $value ) { return htmlspecialchars( (string) $value, ENT_QUOTES, 'UTF-8' ); }
function esc_attr( $value ) { return esc_html( $value ); }
function esc_url( $value ) { return esc_attr( $value ); }
function wp_kses_post( $value ) { return $value; }
function wc_clean( $value ) { return trim( $value ); }
function wp_unslash( $value ) { return stripslashes( $value ); }
function sanitize_html_class( $value ) { return preg_replace( '/[^a-zA-Z0-9_-]/', '', $value ); }
function language_attributes() { echo 'lang="en"'; }
function bloginfo() { echo 'UTF-8'; }
function body_class( $value ) { echo 'class="woocommerce woocommerce-checkout woocommerce-order-pay payment-design-preview ' . esc_attr( $value ) . '"'; }
function wp_body_open() { echo '<div class="payment-design-banner">Design preview · Sample QR · No payment is enabled</div>'; }
function wp_head() { $GLOBALS['head_calls']++; echo '<meta name="fixture" content="gateway-head-preserved" /><link rel="stylesheet" href="http://127.0.0.1:8000/tests/payment-qr-preview.css?v=2" />'; }
function wp_footer() { $GLOBALS['footer_calls']++; echo '<script>window.gatewayFooterPreserved = true;</script><script src="http://127.0.0.1:8000/tests/payment-methods-preview.js?v=1"></script>'; }
function plugins_url( $path ) { return 'http://127.0.0.1:8000/wordpress-plugin/harinam-store-api/' . $path; }
function do_shortcode( $shortcode ) {
	check( '[woocommerce_checkout]' === $shortcode, 'The original WooCommerce checkout renderer owns the payment form.' );
	$GLOBALS['shortcode_calls']++;
	return $GLOBALS['gateway_html'];
}
class FixtureItem {
	private $name;
	private $image;
	public function __construct( $name, $image ) { $this->name = $name; $this->image = $image; }
	public function get_product() { return $this; }
	public function get_name() { return $this->name; }
	public function get_quantity() { return 1; }
	public function get_image() { return '<img src="http://127.0.0.1:8000/assets/' . esc_attr( $this->image ) . '" width="56" height="70" alt="" />'; }
}
class FixtureOrder {
	public $marked = true;
	public function get_id() { return 999; }
	public function get_customer_id() { return 7; }
	public function get_meta() { return $this->marked; }
	public function get_order_key() { return 'local-fixture-key'; }
	public function get_order_number() { return 'PREVIEW-001'; }
	public function get_payment_method_title() { return 'Paytm'; }
	public function get_formatted_order_total() { return '<span class="woocommerce-Price-amount amount">₹998</span>'; }
	public function get_items() { return array( new FixtureItem( 'Mahaprabhu (Gour) Japa Bag', 'collections-mahaprabhu.png' ), new FixtureItem( 'Hare Krsna Sky Blue Japa Bag', 'collections-blue.png' ) ); }
	public function get_formatted_line_subtotal() { return '₹499'; }
	public function get_order_item_totals() { return array( 'cart_subtotal' => array( 'label' => 'Subtotal', 'value' => '₹998' ), 'shipping' => array( 'label' => 'Shipping', 'value' => 'Free shipping' ), 'payment_method' => array( 'label' => 'Payment method', 'value' => 'Paytm' ), 'order_total' => array( 'label' => 'Total', 'value' => '<strong>₹998</strong>' ) ); }
}
$fixture_order = new FixtureOrder();
require __DIR__ . '/../wordpress-plugin/harinam-store-api/harinam-store-api.php';
check( 'harinam_store_api_payment_template' === $hooks['template_include'], 'The payment template is registered through WordPress.' );
check( 'theme.php' === harinam_store_api_payment_template( 'theme.php' ), 'Ordinary pages keep their theme.' );
$pay_page = true;
$fixture_order->marked = false;
check( 'theme.php' === harinam_store_api_payment_template( 'theme.php' ), 'Other WooCommerce orders keep their theme.' );
$fixture_order = false;
check( 'theme.php' === harinam_store_api_payment_template( 'theme.php' ), 'Missing orders keep the original error handling.' );
$fixture_order = new FixtureOrder();
$template = harinam_store_api_payment_template( 'theme.php' );
check( is_file( $template ) && 1 === $cache_calls, 'Storefront payment pages use the branded, non-cacheable template.' );
$gateway_html = '<form id="order_review" method="post" action="#"><input type="hidden" name="woocommerce-pay-nonce" value="fixture-nonce" />' . file_get_contents( __DIR__ . '/payment-qr-preview.html' ) . '</form><script>window.gatewayFormPreserved = true;</script>';
$render = function () use ( $template ) { ob_start(); include $template; return ob_get_clean(); };
$_GET['key'] = 'local-fixture-key';
$authorized_html = $render();
check( false !== strpos( $authorized_html, $gateway_html ), 'The official form, nonce, scripts and action survive without being rewritten or sanitized away.' );
check( 1 === $shortcode_calls && 1 === $head_calls && 1 === $footer_calls, 'WooCommerce renders once and both WordPress gateway asset hooks remain.' );
check( false !== strpos( $authorized_html, 'payment-summary-title' ) && false !== strpos( $authorized_html, 'PREVIEW-001' ), 'The owner with a valid key sees their actual order summary.' );
check( false !== strpos( $authorized_html, 'aria-current="step"' ) && false !== strpos( $authorized_html, 'Skip to payment' ), 'Progress and keyboard navigation remain accessible.' );
check( false !== strpos( $authorized_html, '/assets/payment-page.css?v=1.0.3' ), 'The payment page loads its versioned stylesheet from its own plugin bundle.' );
check( false !== strpos( $authorized_html, 'payment-preview-qr.svg' ) && is_file( __DIR__ . '/assets/payment-preview-qr.svg' ), 'The design includes a visible sample QR asset.' );
check( false !== strpos( $authorized_html, 'Sample QR · Not for payment' ) && false !== strpos( $authorized_html, 'Sample timer for design preview' ), 'The QR and countdown are clearly identified as illustrative.' );
check( false !== strpos( $authorized_html, 'type="button" disabled' ), 'The design cannot launch a payment request.' );
foreach ( array( 'qr', 'upi', 'card' ) as $method ) {
	check( false !== strpos( $authorized_html, 'data-payment-method="' . $method . '"' ) && false !== strpos( $authorized_html, 'id="payment-panel-' . $method . '"' ), 'QR, UPI ID and card designs are present.' );
}
foreach ( array( 0, 8 ) as $other_user ) {
	$user_id = $other_user;
	check( false === strpos( $render(), 'payment-summary-title' ), 'Logged-out and other customers cannot see the custom order summary.' );
}
$user_id = 7;
foreach ( array( '', 'wrong-key', array( 'invalid' ) ) as $invalid_key ) {
	$_GET['key'] = $invalid_key;
	check( false === strpos( $render(), 'payment-summary-title' ), 'Missing, invalid and non-string order keys cannot expose the custom summary.' );
}
if ( in_array( '--preview', $argv, true ) ) {
	file_put_contents( __DIR__ . '/payment-page-preview.html', $authorized_html );
}
echo "PASS: payment-only routing, other-page isolation, owner/key-gated summary, no-cache, native gateway form/nonces/scripts and WordPress asset hooks\n";
