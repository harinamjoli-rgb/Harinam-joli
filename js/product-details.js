const productMain = document.querySelector("#product-main");
productMain.setAttribute("aria-busy", "true");

HarinamShop.catalogReady
  .then(() => {
const catalog = HarinamShop.catalog;
const mainImage = document.querySelector("#detail-main-image");
const thumbnails = document.querySelector("#detail-thumbnails");
const heartButton = document.querySelector("#detail-heart");
const wishlistCount = document.querySelector("#wishlist-count");
const recommendationGrid = document.querySelector("#recommendation-grid");
const zoomDialog = document.querySelector("#product-zoom");
const reviewDialog = document.querySelector("#review-dialog");
const toast = document.querySelector("#detail-toast");

let currentProduct;
let selectedVariation = null;
let quantity = 1;
let toastTimer;

const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ],
  );
const money = (value) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
    Number(value) || 0,
  );
const productUrl = (id) => `product-details.html?id=${encodeURIComponent(id)}`;

const readWishlist = () => HarinamShop.getWishlist();

const updateWishlistUI = () => {
  const wishlist = readWishlist();
  const active = currentProduct && wishlist.has(String(currentProduct.id));
  heartButton.classList.toggle("active", Boolean(active));
  heartButton.setAttribute("aria-pressed", String(Boolean(active)));
  heartButton.setAttribute(
    "aria-label",
    active ? "Remove from wishlist" : "Add to wishlist",
  );
  wishlistCount.textContent = wishlist.size;
  wishlistCount.setAttribute(
    "aria-label",
    `${wishlist.size} wishlist ${wishlist.size === 1 ? "item" : "items"}`,
  );
};

const toggleWishlist = (id) => {
  const adding = HarinamShop.toggleWishlist(id);
  updateWishlistUI();
  renderRecommendations();
  showToast(adding ? "Added to wishlist" : "Removed from wishlist");
};

const showToast = (message) => {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
};

const currentReviews = () => currentProduct.reviews || [];
const reviewTotal = () => Number(currentProduct.reviewCount || 0);

const renderReviews = () => {
  const reviews = currentReviews();
  const list = document.querySelector("#detail-review-list");
  const rating = Math.min(5, Math.max(0, Number(currentProduct.rating) || 0));
  const roundedRating = Math.round(rating);
  document.querySelector("#reviews-panel").classList.toggle("is-empty", !reviews.length);
  list.innerHTML = reviews.length
    ? reviews
        .slice(0, 2)
        .map(
          (review, index) => `
    <article class="review-entry">
      <div class="review-entry-head"><img src="assets/${index % 2 ? "testimonialrow1-ellipse14-7b326d7b.png" : "testimonialrow1-ellipse13-7e8afbcc.png"}" alt="" /><div><b>${escapeHTML(review.name)}</b><time>${escapeHTML(review.date)}</time></div><span aria-label="${Number(review.rating) || 5} out of 5 stars">${"★".repeat(Number(review.rating) || 5)}${"☆".repeat(5 - (Number(review.rating) || 5))}</span></div>
      <p>${escapeHTML(review.text)}</p>
    </article>`,
        )
        .join("")
    : '<p class="review-empty">Be the first to review this product.</p>';
  document.querySelector("#summary-review-count").textContent =
    money(reviewTotal());
  document.querySelector("#summary-rating").textContent = rating.toFixed(1);
  const summaryStars = document.querySelector(".review-stars");
  summaryStars.textContent = `${"★".repeat(roundedRating)}${"☆".repeat(5 - roundedRating)}`;
  summaryStars.setAttribute("aria-label", `${rating} out of 5 stars`);
  document.querySelector("#product-review-count").innerHTML =
    `${currentProduct.rating} out of 5 ratings <b>${reviewTotal()} reviews</b>`;
};

const renderRecommendations = () => {
  if (!currentProduct) return;
  const wishlist = readWishlist();
  const related = catalog
    .filter(
      (product) =>
        product.listed !== false &&
        product.available &&
        String(product.id) !== String(currentProduct.id),
    )
    .sort((a, b) => Number(b.category === currentProduct.category) - Number(a.category === currentProduct.category))
    .slice(0, 5);
  recommendationGrid.innerHTML = related
    .map(
      (product) => `
    <article class="recommendation-card" data-product-id="${escapeHTML(product.id)}">
      <div class="recommendation-photo"><a class="related-card-link" href="${productUrl(product.id)}" aria-label="View ${escapeHTML(product.name)} details"><img loading="lazy" decoding="async" src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" /></a><button class="recommendation-heart${wishlist.has(String(product.id)) ? " active" : ""}" type="button" aria-pressed="${wishlist.has(String(product.id))}" aria-label="${wishlist.has(String(product.id)) ? "Remove from" : "Add to"} wishlist"><img src="assets/detail-heart.svg?v=2" alt="" /></button></div>
      <div class="recommendation-copy"><div><h3><a class="related-card-link" href="${productUrl(product.id)}">${escapeHTML(product.name)}</a></h3><span class="rating"><img src="assets/detail-star.svg?v=2" alt="" />${escapeHTML(product.rating)}</span></div><p><strong>₹ ${money(product.price)}.</strong> <del>${money(product.oldPrice)}</del></p></div>
    </article>`,
    )
    .join("");
};

const selectImage = (src) => {
  mainImage.src = src;
  document.querySelector("#zoom-image").src = src;
  thumbnails
    .querySelectorAll("button")
    .forEach((button) =>
      button.classList.toggle("active", button.dataset.image === src),
    );
};

const renderProduct = (id) => {
  const product = catalog.find((item) => String(item.id) === String(id));
  if (!product) {
    productMain.innerHTML =
      '<section class="product-not-found"><h1>Product not found</h1><p>This product may have been removed or its link is incorrect.</p><a href="products.html">View All Products</a></section>';
    document.title = "Product Not Found | Harinam Joli";
    return;
  }

  currentProduct = product;
  selectedVariation = null;
  quantity = 1;
  document.querySelector("#detail-quantity").textContent = "1";
  document.title = `${product.name} | Harinam Joli`;
  document.querySelector('meta[name="description"]').content =
    product.shortDescription || product.description;
  document.querySelector("#detail-breadcrumb").textContent =
    `Home / ${product.category} / ${product.style} / ${product.name}`;
  document.querySelector("#product-name").textContent = product.name;
  document.querySelector("#product-description").textContent =
    product.shortDescription || product.description;
  document.querySelector("#product-category").textContent = product.category;
  document.querySelector("#product-rating").textContent = product.rating;
  document.querySelector("#product-price").textContent = `${product.currency} ${product.price}`;
  document.querySelector("#product-old-price").textContent = product.oldPrice;
  document.querySelector("#product-sku").textContent = product.sku;
  document.querySelector("#details-title").textContent = product.name;
  document.querySelector("#details-description").textContent =
    product.fullDescription || product.description;
  document.querySelector("#details-category").textContent = product.category;
  document.querySelector("#details-style").textContent = product.style;
  document.querySelector("#details-stock").textContent = product.available
    ? "In Stock"
    : "Out Of Stock";
  document.querySelector("#detail-buy span").textContent =
    `Buy Now : ${product.currency} ${product.price}`;
  document.querySelector("#detail-add").textContent = product.available
    ? "Add To Bag"
    : "Out Of Stock";
  document.querySelector("#detail-add").disabled = !product.available;
  document.querySelector("#detail-buy").disabled = !product.available;

  document.querySelector("#detail-variation")?.remove();
  document.querySelector(".detail-purchase").classList.remove("has-variation");
  if (product.type === "variable") {
    const label = document.createElement("label");
    label.id = "detail-variation";
    label.className = "detail-variation";
    label.textContent = "Select option ";
    const select = document.createElement("select");
    select.innerHTML = `<option value="">Choose an option</option>${product.variations
      .filter((variation) => variation.available)
      .map(
        (variation) =>
          `<option value="${escapeHTML(variation.id)}">${escapeHTML(variation.attributes.map((item) => `${item.name}: ${item.value}`).join(" · "))}</option>`,
      )
      .join("")}`;
    label.append(select);
    document.querySelector(".detail-purchase-row").before(label);
    document.querySelector(".detail-purchase").classList.add("has-variation");
    document.querySelector("#detail-add").disabled = true;
    document.querySelector("#detail-buy").disabled = true;
    select.addEventListener("change", () => {
      selectedVariation = product.variations.find(
        (variation) => String(variation.id) === select.value,
      );
      const selected = selectedVariation || product;
      document.querySelector("#product-price").textContent =
        `${product.currency} ${selected.price}`;
      document.querySelector("#product-old-price").textContent = selected.oldPrice;
      document.querySelector("#detail-buy span").textContent =
        `Buy Now : ${product.currency} ${selected.price}`;
      document.querySelector("#detail-add").disabled = !selectedVariation;
      document.querySelector("#detail-buy").disabled = !selectedVariation;
      if (selectedVariation?.image) selectImage(selectedVariation.image);
    });
  }

  const images =
    Array.isArray(product.images) && product.images.length
      ? product.images
      : [product.image];
  thumbnails.innerHTML = images
    .map(
      (image, index) =>
        `<button class="detail-thumbnail${index ? "" : " active"}" type="button" data-image="${escapeHTML(image)}" aria-label="View image ${index + 1}"><img loading="lazy" src="${escapeHTML(image)}" alt="" /></button>`,
    )
    .join("");
  mainImage.alt = product.name;
  document.querySelector("#zoom-image").alt = product.name;
  selectImage(images[0]);
  updateWishlistUI();
  renderReviews();
  renderRecommendations();
};

const navigateProduct = (id, push = true) => {
  if (push) history.pushState({}, "", productUrl(id));
  renderProduct(id);
  scrollTo({ top: 0, behavior: "instant" });
};

thumbnails.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-image]");
  if (button) selectImage(button.dataset.image);
});

heartButton.addEventListener("click", () => toggleWishlist(currentProduct.id));
document.querySelector("#quantity-plus").addEventListener("click", () => {
  quantity = Math.min(10, quantity + 1);
  document.querySelector("#detail-quantity").textContent = quantity;
});
document.querySelector("#quantity-minus").addEventListener("click", () => {
  quantity = Math.max(1, quantity - 1);
  document.querySelector("#detail-quantity").textContent = quantity;
});
document.querySelector("#detail-add").addEventListener("click", () => {
  if (HarinamShop.addToCart(currentProduct, quantity, selectedVariation))
    showToast(`${quantity} item${quantity === 1 ? "" : "s"} added to bag`);
  else showToast("Select an available option");
});
document.querySelector("#detail-buy").addEventListener("click", () => {
  if (HarinamShop.addToCart(currentProduct, quantity, selectedVariation))
    location.href = "cart.html?v=2";
  else showToast("Select an available option");
});

document
  .querySelector("#detail-zoom-button")
  .addEventListener("click", () => zoomDialog.showModal());
document
  .querySelector(".zoom-close")
  .addEventListener("click", () => zoomDialog.close());
zoomDialog.addEventListener("click", (event) => {
  if (event.target === zoomDialog) zoomDialog.close();
});

document.querySelector("#detail-share").addEventListener("click", async () => {
  try {
    if (navigator.share)
      await navigator.share({
        title: currentProduct.name,
        text: currentProduct.shortDescription || currentProduct.description,
        url: location.href,
      });
    else {
      await navigator.clipboard.writeText(location.href);
      showToast("Product link copied");
    }
  } catch (error) {
    if (error.name !== "AbortError") showToast("Unable to share this product");
  }
});

document.querySelectorAll("[data-detail-tab]").forEach((button) =>
  button.addEventListener("click", () => {
    const selected = button.dataset.detailTab;
    document
      .querySelectorAll("[data-detail-tab]")
      .forEach((tab) => tab.classList.toggle("active", tab === button));
    document.querySelector("#details-panel").hidden = selected !== "details";
    document.querySelector("#reviews-panel").hidden = selected !== "reviews";
  }),
);

document.querySelector("#copy-sku").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(currentProduct.sku);
    showToast("Style number copied");
  } catch {
    showToast(currentProduct.sku);
  }
});

document
  .querySelector("#write-review-button")
  .addEventListener("click", () => reviewDialog.showModal());
document
  .querySelector(".review-close")
  .addEventListener("click", () => reviewDialog.close());
reviewDialog.addEventListener("click", (event) => {
  if (event.target === reviewDialog) reviewDialog.close();
});
document.querySelector("#review-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!HarinamShop.currentUser()) {
    location.href = `account.html?return=${encodeURIComponent(location.pathname.split("/").pop() + location.search)}`;
    return;
  }
  const form = new FormData(event.currentTarget);
  const button = event.currentTarget.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    const response = await HarinamShop.request(`/products/${currentProduct.id}`, {
      method: "POST",
      body: { rating: Number(form.get("rating")), text: String(form.get("text")).trim() },
    });
    event.currentTarget.reset();
    reviewDialog.close();
    showToast(response.message);
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
  }
});

recommendationGrid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-product-id]");
  if (!card) return;
  if (event.target.closest(".recommendation-heart"))
    toggleWishlist(card.dataset.productId);
  else if (event.target.closest(".related-card-link")) {
    event.preventDefault();
    navigateProduct(card.dataset.productId);
  }
});


window.addEventListener("popstate", () =>
  renderProduct(new URLSearchParams(location.search).get("id")),
);
window.addEventListener("storage", updateWishlistUI);
renderProduct(new URLSearchParams(location.search).get("id"));
productMain.setAttribute("aria-busy", "false");
  })
  .catch((error) => {
    productMain.setAttribute("aria-busy", "false");
    const section = document.createElement("section");
    section.className = "product-not-found";
    const title = document.createElement("h1");
    title.textContent = "Products unavailable";
    const message = document.createElement("p");
    message.textContent = error.message || "The store API could not be reached.";
    const link = document.createElement("a");
    link.href = "products.html";
    link.textContent = "Try again";
    section.append(title, message, link);
    productMain.replaceChildren(section);
  });
