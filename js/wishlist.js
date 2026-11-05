const wishlistGrid = document.querySelector("#wishlist-grid");
wishlistGrid.textContent = "Loading products…";

HarinamShop.catalogReady
  .then(() => {
const wishlistEmpty = document.querySelector("#wishlist-empty");
const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ],
  );

const wishlistCard = (product) => `
  <article class="product-card" data-product-id="${escapeHTML(product.id)}" data-image="${escapeHTML(product.imageKey)}">
    <div class="product-photo" role="button" tabindex="0" aria-label="View ${escapeHTML(product.name)} details">
      <img loading="lazy" decoding="async" src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" />
      <button class="heart-button" type="button" aria-label="Remove ${escapeHTML(product.name)} from wishlist">
        <img src="assets/bestsellers-heart-f007651a.svg?v=2" alt="" />
      </button>
    </div>
    <div class="product-info">
      <div class="product-name-row"><h2 class="product-name" tabindex="0">${escapeHTML(product.name)}</h2><span class="rating"><img src="assets/bestsellers-frame149037-49195c89.svg?v=2" alt="" />${escapeHTML(product.rating)}</span></div>
      <p class="product-price"><strong>₹ ${escapeHTML(product.price)}.</strong><del>${escapeHTML(product.oldPrice)}</del></p>
    </div>
  </article>`;

const renderWishlist = () => {
  const wishlist = HarinamShop.getWishlist();
  const savedProducts = HarinamShop.catalog.filter((product) =>
    wishlist.has(String(product.id)),
  );
  wishlistGrid.innerHTML = savedProducts.map(wishlistCard).join("");
  wishlistEmpty.hidden = savedProducts.length > 0;
};

const openProduct = (id) => {
  location.href = `product-details.html?id=${encodeURIComponent(id)}`;
};

wishlistGrid.addEventListener("click", (event) => {
  const card = event.target.closest(".product-card");
  if (!card) return;
  if (event.target.closest(".heart-button"))
    HarinamShop.toggleWishlist(card.dataset.productId);
  else openProduct(card.dataset.productId);
});

wishlistGrid.addEventListener("keydown", (event) => {
  if (
    (event.key === "Enter" || event.key === " ") &&
    event.target.matches(".product-photo, .product-name")
  ) {
    event.preventDefault();
    openProduct(event.target.closest(".product-card").dataset.productId);
  }
});


window.addEventListener("harinam:wishlist", renderWishlist);
window.addEventListener("storage", renderWishlist);
renderWishlist();
  })
  .catch((error) => {
    wishlistGrid.textContent = error.message;
    wishlistEmpty.hidden = true;
  });
