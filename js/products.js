document.querySelector("#result-count").textContent = "Loading products…";
const updateCatalogHeading = (category) => {
  const heading = category || "All Products";
  document.querySelector(".page-title h1").textContent = heading;
  document.body.classList.toggle("category-view", Boolean(category));
  document.querySelector(".page-title").setAttribute("aria-label", `${heading} collection`);
  document.title = `${heading} | Harinam Joli`;
};
updateCatalogHeading(new URLSearchParams(location.search).get("category"));

HarinamShop.catalogReady
  .then(() => {
const products = HarinamShop.catalog;

const productGrid = document.querySelector("#product-grid");
const emptyState = document.querySelector("#empty-state");
const pagination = document.querySelector("#pagination");
const searchInput = document.querySelector("#product-search");
const sortSelect = document.querySelector("#sort-products");
const priceRange = document.querySelector("#price-range");
const priceOutput = document.querySelector("#price-output");
const resultCount = document.querySelector("#result-count");
const catalogLayout = document.querySelector("#catalog-layout");
const wishlistDialog = document.querySelector("#wishlist-dialog");
const wishlistItems = document.querySelector("#wishlist-items");
const emptyWishlist = document.querySelector("#empty-wishlist");
const wishlistCount = document.querySelector("#wishlist-count");
const toast = document.querySelector("#toast");

let currentPage = 1;
const perPage = 12;
let toastTimer;

const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ],
  );

const formatPrice = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

const replaceFilterOptions = (name, values) => {
  const details = document.querySelector(`[data-filter-group="${name}"]`);
  if (!details) return;
  details.hidden = values.length === 0;
  details.querySelectorAll("label").forEach((label) => label.remove());
  values.forEach((value) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = name;
    input.value = value;
    label.append(input, ` ${value}`);
    details.append(label);
  });
};

replaceFilterOptions(
  "category",
  [...new Set(products.flatMap((product) => product.categories || []))].sort(),
);
replaceFilterOptions(
  "style",
  [...new Set(products.flatMap((product) => product.styles || []))].sort(),
);
// The wishlist is shared through the browser storage used by the rest of the shop.
const readWishlist = () => {
  return HarinamShop.getWishlist();
};

const wishlist = readWishlist();
const saveWishlist = () => HarinamShop.saveWishlist(wishlist);

const showToast = (message) => {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
};

const selectedValues = (name) =>
  [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(
    (input) => input.value,
  );

const filteredProducts = () => {
  const term = searchInput.value.trim().toLowerCase();
  const availability = selectedValues("availability");
  const categories = selectedValues("category");
  const routeCategory = new URLSearchParams(location.search).get("category");
  const selectedStyles = selectedValues("style");
  const maxPrice = Number(priceRange.value);

  const filtered = products.filter((product) => {
    const stockMatches =
      !availability.length ||
      (availability.includes("in-stock") && product.available) ||
      (availability.includes("out-of-stock") && !product.available);
    const searchable = [
      product.name,
      product.category,
      product.style,
      product.sku,
    ]
      .join(" ")
      .toLowerCase();
    return (
      (!term || searchable.includes(term)) &&
      stockMatches &&
      (!routeCategory || (product.categories || []).includes(routeCategory)) &&
      (!categories.length ||
        (product.categories || []).some((value) => categories.includes(value))) &&
      (!selectedStyles.length ||
        (product.styles || []).some((value) => selectedStyles.includes(value))) &&
      Number(product.price) <= maxPrice
    );
  });

  return filtered.sort((a, b) => {
    if (sortSelect.value === "name") return a.name.localeCompare(b.name);
    if (sortSelect.value === "price-low") return a.price - b.price;
    if (sortSelect.value === "price-high") return b.price - a.price;
    return products.indexOf(a) - products.indexOf(b);
  });
};

const productCard = (product) => `
  <article class="product-card" data-product-id="${escapeHTML(product.id)}" data-image="${escapeHTML(product.imageKey)}">
    <div class="product-photo" role="button" tabindex="0" aria-label="View ${escapeHTML(product.name)} details">
      <img loading="lazy" decoding="async" src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" />
      <button class="heart-button${wishlist.has(String(product.id)) ? " active" : ""}" type="button" aria-label="${wishlist.has(String(product.id)) ? "Remove" : "Add"} ${escapeHTML(product.name)} ${wishlist.has(String(product.id)) ? "from" : "to"} wishlist" aria-pressed="${wishlist.has(String(product.id))}">
        <img src="assets/bestsellers-heart-f007651a.svg?v=2" alt="" />
      </button>
      <button class="product-add" type="button" ${product.available ? "" : "disabled"}>${product.available ? product.type === "variable" ? "Choose Options" : "Add To Cart" : "Out of Stock"}</button>
    </div>
    <div class="product-info">
      <div class="product-name-row">
        <h2 class="product-name" tabindex="0">${escapeHTML(product.name)}</h2>
        ${Number(product.rating) > 0 ? `<span class="rating"><img src="assets/bestsellers-frame149037-49195c89.svg?v=2" alt="" />${escapeHTML(product.rating)}</span>` : ""}
      </div>
      <p class="product-price"><strong>${formatPrice(product.price)}</strong>${Number(product.oldPrice) > Number(product.price) ? `<del>${formatPrice(product.oldPrice)}</del>` : ""}</p>
    </div>
  </article>`;

const renderPagination = (total) => {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  pagination.hidden = totalPages <= 1;
  currentPage = Math.min(currentPage, totalPages);
  pagination.innerHTML = [
    `<button type="button" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""}>Previous</button>`,
    ...Array.from(
      { length: totalPages },
      (_, index) =>
        `<button type="button" data-page="${index + 1}" class="${currentPage === index + 1 ? "active" : ""}" aria-current="${currentPage === index + 1 ? "page" : "false"}">${index + 1}</button>`,
    ),
    `<button type="button" data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""}>Next</button>`,
  ].join("");
};

const renderProducts = () => {
  const filtered = filteredProducts();
  const routeCategory = new URLSearchParams(location.search).get("category");
  const comingSoon =
    routeCategory &&
    !products.some((product) =>
      (product.categories || []).includes(routeCategory),
    );
  const start = (currentPage - 1) * perPage;
  productGrid.innerHTML = filtered
    .slice(start, start + perPage)
    .map(productCard)
    .join("");
  emptyState.hidden = filtered.length > 0;
  emptyState.classList.toggle("coming-soon", Boolean(comingSoon));
  emptyState.replaceChildren();
  if (comingSoon) {
    const title = document.createElement("strong");
    title.textContent = "Coming Soon";
    const copy = document.createElement("span");
    copy.textContent = `${routeCategory} products will be available soon.`;
    emptyState.append(title, copy);
  } else emptyState.textContent = "No products match your filters.";
  resultCount.textContent = `${filtered.length} products`;
  renderPagination(filtered.length);
  updateWishlistCount();
};

const updateWishlistCount = () => {
  wishlistCount.textContent = wishlist.size;
  wishlistCount.setAttribute(
    "aria-label",
    `${wishlist.size} wishlist ${wishlist.size === 1 ? "item" : "items"}`,
  );
};

const toggleWishlist = (productId) => {
  const product = products.find((item) => String(item.id) === String(productId));
  if (!product) return;
  productId = String(productId);
  const adding = !wishlist.has(productId);
  adding ? wishlist.add(productId) : wishlist.delete(productId);
  saveWishlist();
  renderProducts();
  renderWishlist();
  showToast(adding ? "Added to wishlist" : "Removed from wishlist");
};

const renderWishlist = () => {
  const savedProducts = products.filter((product) =>
    wishlist.has(String(product.id)),
  );
  emptyWishlist.hidden = savedProducts.length > 0;
  wishlistItems.innerHTML = savedProducts
    .map(
      (product) => `
    <article class="wishlist-item" data-product-id="${escapeHTML(product.id)}">
      <img loading="lazy" decoding="async" src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" />
      <div><h3>${escapeHTML(product.name)}</h3><p>${formatPrice(product.price)}</p></div>
      <button class="remove-wishlist" type="button">Remove</button>
    </article>`,
    )
    .join("");
  updateWishlistCount();
};

const openProduct = (productId) => {
  location.href = `product-details.html?id=${encodeURIComponent(productId)}`;
};

productGrid.addEventListener("click", (event) => {
  const card = event.target.closest(".product-card");
  if (!card) return;
  if (event.target.closest(".heart-button"))
    toggleWishlist(card.dataset.productId);
  else if (event.target.closest(".product-add")) {
    const product = products.find(
      (item) => String(item.id) === card.dataset.productId,
    );
    if (product.type === "variable") openProduct(product.id);
    else if (HarinamShop.addToCart(product)) showToast("Added to cart");
  } else openProduct(card.dataset.productId);
});

productGrid.addEventListener("keydown", (event) => {
  if (
    (event.key === "Enter" || event.key === " ") &&
    event.target.matches(".product-photo, .product-name")
  ) {
    event.preventDefault();
    openProduct(event.target.closest(".product-card").dataset.productId);
  }
});

pagination.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-page]");
  if (!button || button.disabled) return;
  currentPage = Number(button.dataset.page);
  renderProducts();
  document
    .querySelector(".catalog-toolbar")
    .scrollIntoView({ behavior: "instant" });
});

document.querySelector("#filters").addEventListener("change", () => {
  currentPage = 1;
  renderProducts();
});
searchInput.addEventListener("input", () => {
  currentPage = 1;
  renderProducts();
});
sortSelect.addEventListener("change", () => {
  currentPage = 1;
  renderProducts();
});
priceRange.addEventListener("input", () => {
  priceOutput.textContent = `Up to ${formatPrice(priceRange.value)}`;
  currentPage = 1;
  renderProducts();
});

const filterToggle = document.querySelector("#toggle-filters");
const syncFilterToggle = () => {
  const mobile = matchMedia("(max-width: 760px)").matches;
  if (mobile) catalogLayout.classList.remove("filters-hidden");
  filterToggle.querySelector("span").textContent = mobile
    ? "Filter"
    : catalogLayout.classList.contains("filters-hidden")
      ? "Show Filter"
      : "Hide Filter";
  filterToggle.setAttribute(
    "aria-expanded",
    String(
      mobile
        ? document.body.classList.contains("filters-open")
        : !catalogLayout.classList.contains("filters-hidden"),
    ),
  );
};

filterToggle.addEventListener("click", (event) => {
  if (matchMedia("(max-width: 760px)").matches) {
    document.body.classList.add("filters-open");
    syncFilterToggle();
    return;
  }
  catalogLayout.classList.toggle("filters-hidden");
  syncFilterToggle();
});

document.querySelector("#close-filters").addEventListener("click", () => {
  document.body.classList.remove("filters-open");
  syncFilterToggle();
});
window.addEventListener("resize", () => {
  if (!matchMedia("(max-width: 760px)").matches)
    document.body.classList.remove("filters-open");
  syncFilterToggle();
});

const resetFilters = () => {
  searchInput.value = "";
  sortSelect.value = "position";
  const catalogMaxPrice = Math.max(100, ...products.map((product) => Number(product.price) || 0));
  priceRange.max = String(Math.ceil(catalogMaxPrice / 100) * 100);
  priceRange.value = priceRange.max;
  priceOutput.textContent = `Up to ${formatPrice(priceRange.max)}`;
  document.querySelector(".price-filter > div span:last-child").textContent = formatPrice(priceRange.max);
  document
    .querySelectorAll("#filters input[type=checkbox]")
    .forEach((input) => {
      input.checked = false;
    });
};

document.querySelector("#refresh-products").addEventListener("click", async () => {
  resetFilters();
  const url = new URL(location.href);
  url.searchParams.delete("search");
  history.replaceState({}, "", url);
  currentPage = 1;
  resultCount.textContent = "Refreshing products…";
  try {
    await HarinamShop.refreshCatalog();
    syncCatalogRoute(url.searchParams);
    showToast("Products refreshed");
  } catch (error) {
    resultCount.textContent = error.message;
  }
});

wishlistItems.addEventListener("click", (event) => {
  const item = event.target.closest(".wishlist-item");
  if (!item) return;
  if (event.target.closest(".remove-wishlist"))
    toggleWishlist(item.dataset.productId);
  else {
    wishlistDialog.close();
    openProduct(item.dataset.productId);
  }
});

document
  .querySelectorAll("[data-close-dialog]")
  .forEach((button) =>
    button.addEventListener("click", () =>
      document.querySelector(`#${button.dataset.closeDialog}`).close(),
    ),
  );
document.querySelectorAll("dialog").forEach((dialog) =>
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  }),
);

const featuredProducts = document.querySelector(".featured-products");
featuredProducts.hidden = products.length === 0;
featuredProducts.insertAdjacentHTML("beforeend", products.slice(0, 3).map((product) => `
  <button class="featured-card" type="button" data-product-id="${escapeHTML(product.id)}">
    <img loading="lazy" decoding="async" src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" />
    <span><b>${escapeHTML(product.name)}</b><em>${escapeHTML(product.rating)} / 5</em><small>${formatPrice(product.price)}</small></span>
  </button>`).join(""));
featuredProducts.querySelectorAll(".featured-card").forEach((button, index) =>
  button.addEventListener("click", () => openProduct(products[index].id)),
);


const syncCatalogRoute = (params, push = false) => {
  const category = params.get("category");
  const search = params.get("search") || "";
  resetFilters();
  const categoryInputs = [...document.querySelectorAll('input[name="category"]')];
  updateCatalogHeading(category);
  categoryInputs.forEach((input) => {
    input.checked = input.value === category;
  });
  searchInput.value = search;
  if (push) {
    const url = new URL(location.href);
    url.search = params.toString();
    history.pushState({}, "", url);
  }
  window.dispatchEvent(new CustomEvent("harinam:catalog-route"));
  currentPage = 1;
  renderProducts();
};

document.addEventListener("click", (event) => {
  const link = event.target.closest('a[href^="products.html"]');
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return;
  const url = new URL(link.href, location.href);
  if (url.pathname !== location.pathname) return;
  event.preventDefault();
  syncCatalogRoute(url.searchParams, true);
  document.querySelector("#nav-menu").classList.remove("open");
  document
    .querySelector("#mobile-menu-button")
    .setAttribute("aria-expanded", "false");
});

window.addEventListener("popstate", () =>
  syncCatalogRoute(new URLSearchParams(location.search)),
);
syncCatalogRoute(new URLSearchParams(location.search));

renderWishlist();
syncFilterToggle();
if (location.hash === "#wishlist") wishlistDialog.showModal();
document.querySelector("#filters-status").hidden = true;
document.querySelector("#filter-controls").hidden = false;
  })
  .catch((error) => {
    document.querySelector("#result-count").textContent = "Catalog unavailable";
    document.querySelector("#filters-status").textContent = "Filters unavailable. Please refresh to try again.";
    document
      .querySelectorAll(".featured-card")
      .forEach((button) => (button.hidden = true));
    const empty = document.querySelector("#empty-state");
    empty.textContent = error.message;
    empty.hidden = false;
  });
