<?php
// Run with an unpacked official paytm-payments plugin path. All payment-network calls are blocked.
$paytm_source = $argv[1] ?? '';
if ( ! is_file( $paytm_source . '/class.paytm.php' ) || ! is_file( $paytm_source . '/includes/PaytmConstants.php' ) ) {
	throw new Exception( 'Usage: php tests/paytm-receipt-check.php /path/to/official/paytm-payments' );
}
require __DIR__ . '/payment-page-check.php';
define( 'WOOCOMMERCE_VERSION', '10.3.4' );
class WC_Payment_Gateway {}
function current_user_can() { return false; }
function get_option() { return array( 'merchant_id' => 'HARINAM_TEST_MID', 'environment' => '0', 'merchant_key' => 'PRIVATE_FIXTURE_KEY' ); }
function wc_get_checkout_url() { return 'http://127.0.0.1:8000/checkout.html'; }
class WC_Order extends FixtureOrder {
	public function __construct( $id ) { check( 999 === $id, 'The configured gateway receives the existing order ID.' ); }
	public function get_billing_first_name() { return 'Local'; }
	public function get_billing_last_name() { return 'Fixture'; }
	public function get_billing_email() { return 'customer@example.test'; }
	public function get_billing_phone() { return ''; }
	public function get_total() { return '1379.50'; }
	public function get_formatted_order_total() { return 'INR 1379.50'; }
	public function get_items() { return array( new FixtureItem( 'Gateway order item', 'collections-blue.png' ) ); }
	public function get_formatted_line_subtotal() { return 'INR 1379.50'; }
	public function get_order_item_totals() { return array( 'order_total' => array( 'label' => 'Total', 'value' => 'INR 1379.50' ) ); }
}
class PaytmHelper {
	public static function getPaytmOrderId( $id ) { return 'TEST_' . $id; }
	public static function getPaytmURL( $path, $environment ) { check( '0' === $environment, 'The fixture uses only the staging SDK origin.' ); return 'https://securestage.paytmpayments.com/' . $path; }
	public static function executecUrl() { throw new Exception( 'Live payment requests are forbidden in this fixture.' ); }
}
require $paytm_source . '/includes/PaytmConstants.php';
require $paytm_source . '/class.paytm.php';
class ReceiptFixturePaytm extends WC_Paytm {
	public $captured;
	public function __construct() {}
	public function blinkCheckoutSend( $params = array() ) {
		$this->captured = $params;
		return array( 'txnToken' => 'LOCAL_ORDER_TOKEN_NOT_VALID_FOR_PAYMENT' );
	}
}
$gateway = new ReceiptFixturePaytm();
ob_start();
$gateway->receipt_page( 999 );
$gateway_html = ob_get_clean();
check( '1379.50' === $gateway->captured['amount'], 'The SDK uses the order total, not the design-preview amount.' );
check( 'TEST_999' === $gateway->captured['order_id'], 'The configured gateway retains its own order-ID mapping.' );
check( false !== strpos( $gateway_html, 'merchantpgpui/checkoutjs/merchants/HARINAM_TEST_MID.js' ), 'The native receipt loads the merchant-specific Paytm SDK.' );
check( false !== strpos( $gateway_html, 'LOCAL_ORDER_TOKEN_NOT_VALID_FOR_PAYMENT' ), 'The native SDK receives the order-scoped transaction token.' );
check( false !== strpos( $gateway_html, 'CheckoutJS.init(config)' ) && false !== strpos( $gateway_html, 'CheckoutJS.invoke()' ), 'The official gateway owns QR and payment-option rendering.' );
$user_id = 7;
$_GET['key'] = 'local-fixture-key';
$fixture_order = new WC_Order( 999 );
$connected_html = $render();
check( false !== strpos( $connected_html, 'id="payment-gateway"' ) && false !== strpos( $connected_html, $gateway_html ), 'The branded payment page preserves the actual official receipt output byte-for-byte.' );
foreach ( array( 'payment-preview-qr.svg', 'data-payment-method=', 'preview-card-number', 'PRIVATE_FIXTURE_KEY' ) as $forbidden ) {
	check( false === strpos( $connected_html, $forbidden ), 'Real gateway rendering cannot include dummy controls or merchant secrets.' );
}
echo "PASS: official Paytm receipt in the branded page, order-specific merchant SDK/token/amount, no sample QR, no merchant-key output and no payment-network requests\n";
