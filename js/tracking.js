const form = document.querySelector("#tracking-form");
const message = document.querySelector("#tracking-message");
const result = document.querySelector("#tracking-result");
const money = (value, currency = "INR") =>
  `${currency} ${Number(value).toLocaleString("en-IN")}`;
const date = (value) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const renderTracking = (tracking) => {
  document.querySelector("#tracking-result-title").textContent =
    tracking.order.number;
  document.querySelector("#tracking-current-status").textContent =
    tracking.steps.find((step) => step.state === "current")?.label ||
    "Order confirmed";
  document.querySelector("#tracking-date").textContent = date(
    tracking.order.createdAt,
  );
  document.querySelector("#tracking-total").textContent = money(
    tracking.order.totals.total,
    tracking.order.totals.currency,
  );
  document.querySelector("#tracking-timeline").replaceChildren(
    ...tracking.steps.map((step) => {
      const item = document.createElement("li");
      item.className = `tracking-step ${step.state}`;
      const marker = document.createElement("span");
      marker.setAttribute("aria-hidden", "true");
      const copy = document.createElement("div");
      const label = document.createElement("b");
      label.textContent = step.label;
      const detail = document.createElement("small");
      detail.textContent = step.at
        ? date(step.at)
        : step.state === "upcoming"
          ? "Upcoming"
          : "Completed";
      copy.append(label, detail);
      item.append(marker, copy);
      return item;
    }),
  );
  result.hidden = false;
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  message.textContent = "";
  result.hidden = true;
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    const tracking = await HarinamTracking.getTracking(
      values.orderId,
      values.email,
    );
    renderTracking(tracking);
  } catch (error) {
    message.textContent =
      error.message || "We could not find this order in your account.";
  } finally {
    button.disabled = false;
  }
});


HarinamShop.sessionReady
  .then(() => {
    if (!HarinamShop.currentUser()) {
      location.replace(
        `account.html?return=${encodeURIComponent("tracking.html" + location.search)}`,
      );
      return;
    }
    const params = new URLSearchParams(location.search);
    form.elements.orderId.value = params.get("order") || "";
    form.elements.email.value = HarinamShop.currentUser().email;
    if (form.elements.orderId.value) form.requestSubmit();
  })
  .catch((error) => {
    message.textContent = error.message;
  });
