<?php
defined( 'ABSPATH' ) || exit;

$frontend = rtrim( harinam_store_api_origin(), '/' );
$payment_order    = harinam_store_api_owned_order( get_query_var( 'order-pay' ) );
$key      = $_GET['key'] ?? '';
$show_order = is_user_logged_in() && ! is_wp_error( $payment_order ) && is_string( $key ) &&
	hash_equals( $payment_order->get_order_key(), wc_clean( wp_unslash( $key ) ) );
// WooCommerce retains its own order access checks, payment forms, nonces and gateway hooks.
$payment_content = do_shortcode( '[woocommerce_checkout]' );
remove_action( 'wp_head', '_wp_render_title_tag', 1 );
?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<meta name="robots" content="noindex, nofollow" />
	<meta name="referrer" content="same-origin" />
	<title>Secure Payment | Harinam Joli</title>
	<?php wp_head(); ?>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Jacques+Francois&display=swap" rel="stylesheet" />
	<link rel="stylesheet" href="<?php echo esc_url( plugins_url( 'assets/payment-page.css', dirname( __DIR__ ) . '/harinam-store-api.php' ) ); ?>?v=<?php echo esc_attr( HARINAM_STORE_API_VERSION ); ?>" />
</head>
<body <?php body_class( 'harinam-payment-page' ); ?>>
<?php wp_body_open(); ?>
<a class="payment-skip" href="#payment-main">Skip to payment</a>
<div class="payment-announcement">Made for your daily devotion.</div>
<header class="payment-header">
	<div class="payment-shell payment-header-inner">
		<a class="payment-brand" href="<?php echo esc_url( $frontend . '/' ); ?>" aria-label="Harinam Joli home"><img src="<?php echo esc_url( $frontend . '/assets/header-logo-horizontal.png?v=1' ); ?>" width="148" height="72" alt="Harinam Joli" /></a>
		<span class="payment-secure"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/></svg>Secure checkout</span>
		<a class="payment-header-help" href="<?php echo esc_url( $frontend . '/contact.html' ); ?>">Need help?</a>
	</div>
</header>
<main class="payment-shell payment-main" id="payment-main">
	<ol class="payment-progress" aria-label="Checkout progress">
		<li class="done"><span aria-hidden="true">✓</span>Address</li>
		<li class="done"><span aria-hidden="true">✓</span>Payment method</li>
		<li class="done"><span aria-hidden="true">✓</span>Review order</li>
		<li aria-current="step"><span aria-hidden="true">4</span>Secure payment</li>
	</ol>
	<div class="payment-intro"><p class="payment-eyebrow">One last step</p><h1>Complete your payment</h1><p>Follow the instructions below to complete your order.</p></div>
	<div class="payment-layout<?php echo $show_order ? '' : ' payment-layout-single'; ?>">
		<section class="payment-card payment-provider<?php echo $show_order ? ' has-order-summary' : ''; ?>" aria-labelledby="payment-provider-title">
			<div class="payment-card-heading"><div><p class="payment-eyebrow">Payment</p><h2 id="payment-provider-title"><?php echo $show_order ? esc_html( $payment_order->get_payment_method_title() ) : 'Secure payment'; ?></h2></div><span class="payment-status">Secure checkout</span></div>
			<?php if ( $show_order ) : ?>
			<div class="payment-amount"><span>Order total</span><strong><?php echo wp_kses_post( $payment_order->get_formatted_order_total() ); ?></strong></div>
			<?php endif; ?>
			<div class="payment-content" id="payment-gateway"><?php echo $payment_content; // Trusted WooCommerce output includes the official gateway's forms and scripts. ?></div>
			<p class="payment-provider-note">Complete payment with your selected provider. You will return to Harinam Joli to view your order status.</p>
		</section>
		<?php if ( $show_order ) : ?>
		<aside class="payment-card payment-summary" aria-labelledby="payment-summary-title">
			<div class="payment-summary-heading"><div><p class="payment-eyebrow">Your order</p><h2 id="payment-summary-title">Order summary</h2></div><span>#<?php echo esc_html( $payment_order->get_order_number() ); ?></span></div>
			<ul class="payment-items">
				<?php foreach ( $payment_order->get_items() as $item ) : $payment_product = $item->get_product(); ?>
				<li><?php if ( $payment_product ) { echo wp_kses_post( $payment_product->get_image( 'woocommerce_thumbnail' ) ); } ?><div><b><?php echo esc_html( $item->get_name() ); ?></b><span>Qty <?php echo esc_html( $item->get_quantity() ); ?></span></div><strong><?php echo wp_kses_post( $payment_order->get_formatted_line_subtotal( $item ) ); ?></strong></li>
				<?php endforeach; ?>
			</ul>
			<dl class="payment-totals">
				<?php foreach ( $payment_order->get_order_item_totals() as $name => $total ) : ?>
				<div class="<?php echo esc_attr( sanitize_html_class( $name ) ); ?>"><dt><?php echo wp_kses_post( $total['label'] ); ?></dt><dd><?php echo wp_kses_post( $total['value'] ); ?></dd></div>
				<?php endforeach; ?>
			</dl>
			<a class="payment-order-link" href="<?php echo esc_url( $frontend . '/checkout.html?order=' . $payment_order->get_id() ); ?>">View order status <span aria-hidden="true">→</span></a>
		</aside>
		<?php endif; ?>
	</div>
	<div class="payment-support"><span>Need help with your payment?</span><a href="https://wa.me/919913032130" target="_blank" rel="noopener noreferrer">WhatsApp us ↗</a><a href="mailto:harinamjoli@gmail.com">harinamjoli@gmail.com</a></div>
</main>
<footer class="payment-footer"><div class="payment-shell"><a href="<?php echo esc_url( $frontend . '/' ); ?>">Harinam Joli</a><nav aria-label="Payment policies"><a href="<?php echo esc_url( $frontend . '/privacy-policy.html' ); ?>">Privacy Policy</a><a href="<?php echo esc_url( $frontend . '/return-refund-policy.html' ); ?>">Return &amp; Refund</a><a href="<?php echo esc_url( $frontend . '/terms-and-conditions.html' ); ?>">Terms &amp; Conditions</a></nav></div></footer>
<?php wp_footer(); ?>
</body>
</html>
