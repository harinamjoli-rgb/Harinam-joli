const checkoutProgress = document.querySelector("#checkout-progress");
const checkoutLayout = document.querySelector("#checkout-layout");
const checkoutSummary = document.querySelector("#checkout-summary");
const checkoutEmpty = document.querySelector("#checkout-empty");
const draft = {
  shipping: null,
  shippingMethods: {},
  gateway: null,
  quote: null,
};

const money = (value, currency = "INR") =>
  `${currency} ${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const setMessage = (id, message = "") => {
  document.querySelector(id).textContent = message;
};

const showStep = (name) => {
  const order = ["shipping", "payment", "review"];
  const activeIndex = order.indexOf(name);
  document.querySelectorAll("[data-checkout-step]").forEach((section) => {
    section.hidden = section.dataset.checkoutStep !== name;
  });
  document.querySelectorAll("[data-progress-step]").forEach((item, index) => {
    item.classList.toggle("active", index === activeIndex);
    item.classList.toggle("done", index < activeIndex);
  });
  scrollTo({ top: 0, behavior: "smooth" });
};

const summaryItem = (item) => {
  const row = document.createElement("div");
  row.className = "checkout-summary-item";
  const image = document.createElement("img");
  image.src = item.image;
  image.alt = "";
  const copy = document.createElement("span");
  const name = document.createElement("b");
  name.textContent = item.name;
  const quantity = document.createElement("small");
  quantity.textContent = `Qty ${item.quantity}`;
  copy.append(name, quantity);
  const price = document.createElement("strong");
  price.textContent = money(
    Number(item.total ?? item.price * item.quantity),
    draft.quote?.totals.currency || item.currency,
  );
  row.append(image, copy, price);
  return row;
};

const renderSummary = (
  items,
  totals = HarinamCheckout.calculateTotals(items),
) => {
  document
    .querySelector("#checkout-summary-items")
    .replaceChildren(...items.map(summaryItem));
  document.querySelector("#checkout-subtotal").textContent = money(
    totals.subtotal,
    totals.currency,
  );
  document.querySelector("#checkout-shipping").textContent = money(
    totals.shipping,
    totals.currency,
  );
  document.querySelector("#checkout-tax").textContent = money(
    totals.tax || 0,
    totals.currency,
  );
  document.querySelector("#checkout-total").textContent = money(
    totals.total,
    totals.currency,
  );
  document.querySelector("#checkout-shipping-note").textContent =
    draft.quote
      ? "Shipping, taxes and total verified by WooCommerce."
      : "Final shipping and taxes are calculated after your address.";
};

const renderReview = () => {
  const { fullName, address, landmark, city, state, postalCode, phone, country } =
    draft.shipping;
  document.querySelector("#review-name").textContent = fullName;
  document.querySelector("#review-address").textContent = [
    address,
    landmark,
    city,
    state,
    postalCode,
    country,
  ]
    .filter(Boolean)
    .join(", ");
  document.querySelector("#review-phone").textContent = `Mobile: ${phone}`;
  document.querySelector("#review-payment").textContent = draft.gateway.title;
  document.querySelector("#review-payment-note").textContent =
    "You will continue to the payment provider's secure page.";
};

const renderPayment = (quote) => {
  draft.quote = quote;
  draft.gateway = quote.gateway;
  HarinamShop.syncCart(quote.items);
  document.querySelector("#payment-name").textContent = quote.gateway.title;
  document.querySelector("#payment-description").textContent =
    quote.gateway.id === "paytm"
      ? "Pay securely with Paytm, UPI, PhonePe, BHIM or another supported UPI app."
      : "Pay securely with PayPal on the official PayPal payment page.";
  const methods = document.querySelector("#shipping-methods");
  methods.replaceChildren();
  quote.shippingMethods.forEach((group) => {
    group.choices.forEach((method) => {
      const label = document.createElement("label");
      label.className = "payment-option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `shippingMethod-${group.package}`;
      input.value = method.id;
      input.checked = method.id === group.selected;
      const span = document.createElement("span");
      const name = document.createElement("b");
      name.textContent = method.label;
      const cost = document.createElement("small");
      cost.textContent = money(method.cost, quote.totals.currency);
      span.append(name, cost);
      label.append(input, span);
      methods.append(label);
    });
  });
  renderSummary(quote.items, quote.totals);
};

const confirmationCopy = {
  paid: ["✓", "Payment verified", "Thank you for your order"],
  pending: ["…", "Payment pending", "Payment verification in progress"],
  failed: ["!", "Payment failed", "Your payment was not completed"],
  cancelled: ["×", "Payment cancelled", "Your payment was cancelled"],
};

const renderConfirmation = (order) => {
  const state = confirmationCopy[order.paymentState] || confirmationCopy.pending;
  checkoutProgress.hidden = true;
  checkoutSummary.hidden = true;
  document.querySelectorAll("[data-checkout-step]").forEach((section) => {
    section.hidden = true;
  });
  const confirmation = document.querySelector("#checkout-confirmation");
  confirmation.hidden = false;
  confirmation.querySelector(".confirmation-mark").textContent = state[0];
  confirmation.querySelector(".flow-eyebrow").textContent = state[1];
  confirmation.querySelector("h2").textContent = state[2];
  document.querySelector("#confirmation-message").textContent = order.paid
    ? `Order ${order.number} is paid and verified by WooCommerce.`
    : `Order ${order.number} is ${order.paymentState}. No payment success is assumed from this page URL.`;
  document.querySelector("#confirmation-number").textContent = order.number;
  document.querySelector("#confirmation-address").textContent = [
    order.shipping.fullName,
    order.shipping.address,
    order.shipping.landmark,
    order.shipping.city,
    order.shipping.state,
    order.shipping.postalCode,
    order.shipping.country,
  ]
    .filter(Boolean)
    .join(", ");
  document.querySelector("#confirmation-payment").textContent =
    order.payment.label;
  document.querySelector("#confirmation-total").textContent = money(
    order.totals.total,
    order.totals.currency,
  );
  const action = document.querySelector("#confirmation-tracking-link");
  if (order.paymentUrl && !order.paid) {
    action.href = order.paymentUrl;
    action.textContent = "Proceed to Secure Payment";
  } else {
    action.href = `tracking.html?order=${encodeURIComponent(order.id)}`;
    action.textContent = "Track order";
  }
  checkoutLayout.classList.add("confirmation-layout");
  if (order.paid) {
    HarinamShop.clearCart();
    HarinamCheckout.clearAttempt();
  }
  confirmation.focus({ preventScroll: true });
};

const loadOrder = async (id, poll = true) => {
  try {
    const order = await HarinamCheckout.getOrder(id);
    renderConfirmation(order);
    if (poll && order.paymentState === "pending") {
      let attempts = 0;
      const check = async () => {
        attempts += 1;
        const current = await HarinamCheckout.getOrder(id).catch(() => null);
        if (current) renderConfirmation(current);
        if (current?.paymentState === "pending" && attempts < 12)
          setTimeout(check, 5000);
      };
      setTimeout(check, 5000);
    }
  } catch (error) {
    checkoutProgress.hidden = true;
    checkoutLayout.hidden = true;
    checkoutEmpty.hidden = false;
    checkoutEmpty.querySelector("h2").textContent = "Order unavailable";
    checkoutEmpty.querySelector("p").textContent = error.message;
  }
};

const setCountryValidation = () => {
  const form = document.querySelector("#shipping-form");
  const india = form.elements.country.value === "IN";
  form.elements.phone.pattern = india ? "(?:\\+?91[ -]?)?[6-9][0-9]{9}" : "\\+?[0-9]{7,15}";
  form.elements.phone.placeholder = india
    ? "10-digit mobile number"
    : "Include country code";
  form.elements.postalCode.pattern = india ? "[0-9]{6}" : ".{3,12}";
  form.elements.postalCode.maxLength = india ? 6 : 12;
};

document.querySelector("#shipping-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type=submit]");
  setMessage("#shipping-message");
  button.disabled = true;
  try {
    draft.shipping = HarinamCheckout.validateShipping(
      Object.fromEntries(new FormData(form)),
    );
    renderPayment(await HarinamCheckout.quote(draft));
    showStep("payment");
  } catch (error) {
    setMessage("#shipping-message", error.message);
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#payment-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  setMessage("#payment-message");
  form.querySelectorAll('input[name^="shippingMethod-"]:checked').forEach((input) => {
    draft.shippingMethods[input.name.split("-")[1]] = input.value;
  });
  try {
    renderPayment(await HarinamCheckout.quote(draft));
    renderReview();
    showStep("review");
  } catch (error) {
    setMessage("#payment-message", error.message);
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#payment-back").addEventListener("click", () => showStep("shipping"));
document.querySelector("#review-back").addEventListener("click", () => showStep("payment"));
document.querySelector("#edit-shipping").addEventListener("click", () => showStep("shipping"));
document.querySelector("#edit-payment").addEventListener("click", () => showStep("payment"));

document.querySelector("#place-order").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  setMessage("#order-message");
  try {
    const response = await HarinamCheckout.placeOrder(draft);
    const order = response.order;
    history.replaceState(null, "", `checkout.html?order=${encodeURIComponent(order.id)}`);
    if (!order.paymentUrl) renderConfirmation(order);
    else location.assign(order.paymentUrl);
  } catch (error) {
    setMessage("#order-message", error.message);
    button.disabled = false;
  }
});


Promise.all([HarinamShop.sessionReady, HarinamShop.catalogReady])
  .then(() => {
    const user = HarinamShop.currentUser();
    if (!user) {
      location.replace("account.html?return=checkout.html");
      return;
    }
    const country = document.querySelector('#shipping-form [name="country"]');
    country.replaceChildren(
      ...Object.entries(HarinamShop.countries()).map(([code, label]) => {
        const option = document.createElement("option");
        option.value = code;
        option.textContent = label;
        return option;
      }),
    );
    Object.entries(user.address || {}).forEach(([name, value]) => {
      if (document.querySelector(`#shipping-form [name="${name}"]`))
        document.querySelector(`#shipping-form [name="${name}"]`).value = value;
    });
    country.value = user.address?.country || "IN";
    country.addEventListener("change", setCountryValidation);
    setCountryValidation();

    const requestedOrder = new URLSearchParams(location.search).get("order");
    if (requestedOrder) loadOrder(requestedOrder);
    else {
      const cart = HarinamShop.getCart();
      if (cart.length) renderSummary(cart);
      else {
        checkoutProgress.hidden = true;
        checkoutLayout.hidden = true;
        checkoutEmpty.hidden = false;
      }
    }
  })
  .catch((error) => {
    checkoutProgress.hidden = true;
    checkoutLayout.hidden = true;
    checkoutEmpty.hidden = false;
    checkoutEmpty.querySelector("h2").textContent = "Checkout unavailable";
    checkoutEmpty.querySelector("p").textContent = error.message;
  });
