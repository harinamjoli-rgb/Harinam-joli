const guestPanel = document.querySelector("#auth-guest");
const accountCard = document.querySelector("#account-card");
const returnTo = new URLSearchParams(location.search).get("return");
const safeReturn =
  returnTo && /^[a-z0-9_-]+\.html(?:\?.*)?$/i.test(returnTo) ? returnTo : "";

const renderOrders = async () => {
  const container = document.querySelector("#account-orders");
  const orders = await HarinamCheckout.getOrders();
  document.querySelector("#account-order-count").textContent = orders.length
    ? `${orders.length} total`
    : "";
  if (!orders.length) {
    const empty = document.createElement("p");
    empty.className = "account-orders-empty";
    empty.textContent = "Your orders will appear here.";
    container.replaceChildren(empty);
    return;
  }
  container.replaceChildren(
    ...orders.map((order) => {
      const link = document.createElement("a");
      link.className = "account-order-row";
      link.href = `checkout.html?order=${encodeURIComponent(order.id)}`;
      const copy = document.createElement("span");
      const number = document.createElement("b");
      number.textContent = order.number;
      const details = document.createElement("small");
      const itemCount = order.items.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );
      details.textContent = `${new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · ${itemCount} item${itemCount === 1 ? "" : "s"}`;
      copy.append(number, details);
      const total = document.createElement("strong");
      total.textContent = `${order.totals.currency} ${Number(order.totals.total).toLocaleString("en-IN")}`;
      link.append(copy, total);
      return link;
    }),
  );
};

const renderAccount = async () => {
  const user = HarinamShop.currentUser();
  guestPanel.hidden = Boolean(user) || guestPanel.parentElement.tagName !== "DIALOG";
  document.querySelector("#account-signin-prompt").hidden = Boolean(user);
  accountCard.hidden = !user;
  if (!user) return;
  document.querySelector("#account-avatar").textContent = user.name
    .charAt(0)
    .toUpperCase();
  document.querySelector("#account-name").textContent = user.name;
  document.querySelector("#account-email").textContent = user.email;
  try {
    await renderOrders();
  } catch (error) {
    document.querySelector("#account-orders").textContent = error.message;
  }
};

HarinamAuth.init(guestPanel, async () => {
  if (safeReturn) location.href = safeReturn;
  else await renderAccount();
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  await HarinamShop.signOut();
  HarinamAuth.show(guestPanel, "login");
  await renderAccount();
  await HarinamAuth.open();
});


HarinamShop.sessionReady
  .then(async () => {
    await renderAccount();
    if (!HarinamShop.currentUser()) await HarinamAuth.open();
  })
  .catch((error) => {
    document.querySelector("#login-message").textContent = error.message;
    document.querySelector("#account-signin-prompt").hidden = false;
  });
window.addEventListener("harinam:order", renderAccount);
