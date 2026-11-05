(function () {
  const ATTEMPT_KEY = "harinam-checkout-attempt";

  const calculateTotals = (cart) => ({
    subtotal: cart.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity),
      0,
    ),
    shipping: 0,
    tax: 0,
    total: cart.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity),
      0,
    ),
    currency: cart[0]?.currency || "INR",
  });

  const validateShipping = (values) => {
    const shipping = Object.fromEntries(
      Object.entries(values || {}).map(([key, value]) => [
        key,
        String(value || "").trim(),
      ]),
    );
    shipping.country = shipping.country.toUpperCase();
    shipping.phone = shipping.phone.replace(/[^\d+]/g, "");
    if (shipping.fullName.length < 2)
      throw new Error("Please enter the recipient's full name.");
    if (shipping.country === "IN" && !/^(?:\+?91)?[6-9]\d{9}$/.test(shipping.phone))
      throw new Error("Please enter a valid Indian mobile number.");
    if (shipping.country !== "IN" && !/^\+?[0-9]{7,15}$/.test(shipping.phone))
      throw new Error("Please enter a valid mobile number with country code.");
    if (shipping.address.length < 5)
      throw new Error("Please enter the complete delivery address.");
    if (shipping.city.length < 2 || shipping.state.length < 1)
      throw new Error("Please enter the city and state or region.");
    if (
      (shipping.country === "IN" && !/^\d{6}$/.test(shipping.postalCode)) ||
      (shipping.country !== "IN" && shipping.postalCode.length < 3)
    )
      throw new Error("Please enter a valid postal code.");
    return shipping;
  };

  const validateCart = () =>
    HarinamShop.request("/cart/validate", {
      method: "POST",
      auth: false,
      csrf: true,
      body: { items: HarinamShop.checkoutItems() },
    });

  const quote = ({ shipping, shippingMethods = {} }) =>
    HarinamShop.request("/checkout/quote", {
      method: "POST",
      body: {
        items: HarinamShop.checkoutItems(),
        shipping,
        shippingMethods,
      },
    });

  const placeOrder = ({ shipping, shippingMethods = {}, gateway }) => {
    const body = {
      items: HarinamShop.checkoutItems(),
      shipping,
      shippingMethods,
      gateway: gateway?.id || gateway,
    };
    const fingerprint = JSON.stringify(body);
    let attempt;
    try {
      attempt = JSON.parse(sessionStorage.getItem(ATTEMPT_KEY) || "null");
    } catch {
      attempt = null;
    }
    if (!attempt || attempt.fingerprint !== fingerprint) {
      attempt = {
        key: crypto.randomUUID().replaceAll("-", ""),
        fingerprint,
      };
      sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify(attempt));
    }
    return HarinamShop.request("/checkout", {
      method: "POST",
      headers: { "Idempotency-Key": attempt.key },
      body,
    });
  };

  const clearAttempt = () => sessionStorage.removeItem(ATTEMPT_KEY);

  const getOrders = async () =>
    (await HarinamShop.request("/orders")).orders || [];
  const getOrder = (id) =>
    HarinamShop.request(`/orders/${encodeURIComponent(id)}`);

  window.HarinamCheckout = {
    calculateTotals,
    validateShipping,
    validateCart,
    quote,
    placeOrder,
    clearAttempt,
    getOrders,
    getOrder,
  };
})();
