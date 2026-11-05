const cartItems = document.querySelector("#cart-items");
const cartEmpty = document.querySelector("#cart-empty");
const cartSummary = document.querySelector("#cart-summary");
const cartLayout = document.querySelector(".cart-layout");
const flowToast = document.querySelector("#flow-toast");
let flowToastTimer;

const money = (value, currency = "INR") =>
  `${currency} ${Number(value).toLocaleString("en-IN")}`;
const showCartToast = (message) => {
  flowToast.textContent = message;
  flowToast.classList.add("show");
  clearTimeout(flowToastTimer);
  flowToastTimer = setTimeout(() => flowToast.classList.remove("show"), 1800);
};

const cartItemElement = (item) => {
  const article = document.createElement("article");
  article.className = "cart-item";
  article.dataset.cartId = item.id;
  const image = document.createElement("img");
  image.src = item.image;
  image.alt = item.name;
  const copy = document.createElement("div");
  const name = document.createElement("h2");
  name.textContent = item.name;
  const price = document.createElement("p");
  price.className = "cart-item-price";
  price.textContent = money(item.price, item.currency);
  const oldPrice = document.createElement("del");
  oldPrice.textContent = money(item.oldPrice, item.currency);
  price.append(" ", oldPrice);
  const quantity = document.createElement("div");
  quantity.className = "cart-quantity";
  quantity.innerHTML = `<button type="button" data-cart-step="-1" aria-label="Decrease quantity">−</button><span>${item.quantity}</span><button type="button" data-cart-step="1" aria-label="Increase quantity">+</button>`;
  copy.append(name, price, quantity);
  const side = document.createElement("div");
  side.className = "cart-item-side";
  const total = document.createElement("strong");
  total.className = "cart-line-total";
  total.textContent = money(item.price * item.quantity, item.currency);
  const remove = document.createElement("button");
  remove.className = "cart-remove";
  remove.type = "button";
  remove.textContent = "Remove";
  side.append(total, remove);
  article.append(image, copy, side);
  return article;
};

const renderCart = () => {
  const cart = HarinamShop.getCart();
  cartItems.replaceChildren(...cart.map(cartItemElement));
  cartEmpty.hidden = cart.length > 0;
  cartSummary.hidden = cart.length === 0;
  cartLayout.classList.toggle("is-empty", cart.length === 0);
  const subtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const currency = cart[0]?.currency || "INR";
  document.querySelector("#cart-subtotal").textContent = money(subtotal, currency);
  document.querySelector("#cart-shipping").textContent = "Calculated at checkout";
  document.querySelector("#cart-total").textContent = money(subtotal, currency);
  document.querySelector("#shipping-note").textContent =
    "Shipping and taxes are calculated securely by WooCommerce.";
};

cartItems.addEventListener("click", (event) => {
  const item = event.target.closest(".cart-item");
  if (!item) return;
  if (event.target.closest(".cart-remove")) {
    HarinamShop.removeCartItem(item.dataset.cartId);
    showCartToast("Item removed from cart");
    return;
  }
  const stepButton = event.target.closest("[data-cart-step]");
  if (!stepButton) return;
  const entry = HarinamShop.getCart().find(
    (product) => product.id === item.dataset.cartId,
  );
  if (!entry) return;
  const next = entry.quantity + Number(stepButton.dataset.cartStep);
  if (next < 1) HarinamShop.removeCartItem(entry.id);
  else HarinamShop.updateCartItem(entry.id, next);
});

document.querySelector("#checkout-button").addEventListener("click", async () => {
  await HarinamShop.sessionReady.catch(() => {});
  if (!HarinamShop.currentUser()) {
    location.href = "account.html?return=checkout.html";
    return;
  }
  location.href = "checkout.html";
});


window.addEventListener("harinam:cart", renderCart);
renderCart();
Promise.all([HarinamShop.sessionReady, HarinamShop.catalogReady])
  .then(() => HarinamCheckout.validateCart())
  .then((result) => HarinamShop.syncCart(result.items))
  .catch((error) => {
    if (HarinamShop.getCart().length) {
      showCartToast(error.message);
      document.querySelector("#checkout-button").disabled = true;
    }
  });
