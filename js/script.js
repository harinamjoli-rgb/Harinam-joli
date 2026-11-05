const heroSlides = [...document.querySelectorAll(".hero-slide")];
let heroIndex = 0;
const advanceHero = () => {
  const current = heroSlides[heroIndex];
  heroIndex = (heroIndex + 1) % heroSlides.length;
  current.classList.remove("is-active");
  current.classList.add("is-before");
  heroSlides[heroIndex].classList.add("is-active");
  setTimeout(() => current.classList.remove("is-before"), 700);
};
if (heroSlides.length > 1) setInterval(advanceHero, 5000);

const whySlides = [...document.querySelectorAll(".why-slide")];
let whyIndex = 0;
setInterval(() => {
  whySlides[whyIndex].classList.remove("is-active");
  whyIndex = (whyIndex + 1) % whySlides.length;
  whySlides[whyIndex].classList.add("is-active");
}, 4000);

const reviewRow = document.querySelector(".review-row");
const demoReviews = [...reviewRow.querySelectorAll(".review-card")].map((card) => {
  const demo = card.cloneNode(true);
  demo.dataset.reviewSource = "demo";
  demo.querySelector(".review-user small").textContent = "Demo review";
  demo.querySelector("footer span").textContent = "Preview";
  return demo;
});
let reviewPosition = 0;
let reviewDirection = 1;
const renderReviews = () => {
  const unique = new Map();
  HarinamShop.catalog.flatMap((product) => product.reviews || []).forEach((review) => {
    if (!review || !Number.isInteger(Number(review.id)) || Number(review.id) <= 0 ||
        !Number.isInteger(Number(review.rating)) || Number(review.rating) < 1 || Number(review.rating) > 5 ||
        typeof review.text !== "string" || !review.text.trim()) return;
    unique.set(String(Number(review.id)), review);
  });
  const cards = [...unique.values()].map((review) => {
    const card = demoReviews[0].cloneNode(true);
    const name = String(review.name || "Customer").trim() || "Customer";
    card.dataset.reviewSource = "real";
    card.dataset.reviewId = String(review.id);
    const avatar = document.createElement("span");
    avatar.className = "review-avatar";
    avatar.textContent = name.split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0]).join("").toUpperCase();
    avatar.setAttribute("aria-hidden", "true");
    card.querySelector(".review-user > img").replaceWith(avatar);
    card.querySelector("h3").textContent = name;
    const stars = document.createElement("span");
    stars.className = "review-stars";
    stars.textContent = "★".repeat(Number(review.rating)) + "☆".repeat(5 - Number(review.rating));
    stars.setAttribute("aria-hidden", "true");
    const score = document.createElement("span");
    score.textContent = `${review.rating}/5`;
    score.setAttribute("aria-label", `${review.rating} out of 5 stars`);
    card.querySelector(".review-user p").replaceChildren(stars, score);
    card.querySelector(".review-user small").textContent = "Customer review";
    card.querySelector("blockquote").textContent = review.text;
    card.querySelector("blockquote").title = review.text;
    card.querySelector("time").textContent = String(review.date || "");
    card.querySelector("footer span").textContent = "Website";
    return card;
  });
  reviewRow.replaceChildren(...cards, ...demoReviews.slice(0, Math.max(0, 10 - cards.length)).map((card) => card.cloneNode(true)));
  reviewRow.dataset.realReviewCount = String(cards.length);
  reviewRow.scrollLeft = reviewPosition = 0;
  reviewDirection = 1;
};
renderReviews();
HarinamShop.catalogReady.then(renderReviews).catch(() => {});
window.addEventListener("harinam:catalog", renderReviews);

const reviewMotion = matchMedia("(prefers-reduced-motion: reduce)");
let reviewHovered = false;
let reviewFocused = false;
let reviewVisible = false;
let reviewInteractionUntil = 0;
let reviewLastTime = 0;
reviewRow.addEventListener("pointerenter", (event) => { reviewHovered = event.pointerType === "mouse"; });
reviewRow.addEventListener("pointerleave", () => { reviewHovered = false; });
reviewRow.addEventListener("focusin", () => { reviewFocused = true; });
reviewRow.addEventListener("focusout", (event) => { reviewFocused = reviewRow.contains(event.relatedTarget); });
["pointerdown", "wheel", "keydown"].forEach((type) => reviewRow.addEventListener(type, () => {
  reviewInteractionUntil = performance.now() + 6000;
}, { passive: true }));
new IntersectionObserver(([entry]) => { reviewVisible = entry.isIntersecting; }).observe(reviewRow);
const scrollReviews = (time) => {
  const elapsed = reviewLastTime ? Math.min(time - reviewLastTime, 64) : 0;
  reviewLastTime = time;
  const maximum = reviewRow.scrollWidth - reviewRow.clientWidth;
  if (!reviewMotion.matches && !document.hidden && reviewVisible && !reviewHovered && !reviewFocused && time >= reviewInteractionUntil && maximum > 1) {
    reviewPosition = Math.max(0, Math.min(maximum, reviewPosition + reviewDirection * elapsed * .028));
    reviewRow.scrollLeft = reviewPosition;
    if (reviewPosition >= maximum) reviewDirection = -1;
    if (reviewPosition <= 0) reviewDirection = 1;
  } else reviewPosition = reviewRow.scrollLeft;
  requestAnimationFrame(scrollReviews);
};
requestAnimationFrame(scrollReviews);
const prepareCategoryHover = (image) => {
  const photo = image.closest(".category-photo");
  const ready = () => { if (image.naturalWidth > 0) photo.dataset.hoverReady = "true"; };
  image.addEventListener("load", ready);
  image.addEventListener("error", () => {
    delete photo.dataset.hoverReady;
    image.remove();
  });
  if (image.complete) ready();
};
const categoryHoverImages = document.querySelectorAll(".category-hover-image");
categoryHoverImages.forEach(prepareCategoryHover);
const categoryGrid = document.querySelector(".category-grid");
const categoryArrows = [...document.querySelectorAll(".category-arrow")];
const syncCategoryArrows = () => {
  categoryArrows[0].disabled = categoryGrid.scrollLeft <= 0;
  categoryArrows[1].disabled =
    categoryGrid.scrollLeft >= categoryGrid.scrollWidth - categoryGrid.clientWidth - 1;
};
categoryArrows.forEach((button, index) =>
  button.addEventListener("click", () => {
    const step = categoryGrid.children[1].offsetLeft - categoryGrid.children[0].offsetLeft;
    categoryGrid.scrollBy({ left: index ? step : -step });
  }),
);
categoryGrid.addEventListener("scroll", syncCategoryArrows, { passive: true });
window.addEventListener("resize", syncCategoryArrows);
syncCategoryArrows();

const toast = document.querySelector(".toast");
let toastTimer;
const showToast = (message) => {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
};

const videoDialog = document.querySelector(".video-dialog");
const devotionalVideo = videoDialog.querySelector("video");
document.querySelector(".video-button").addEventListener("click", () => {
  videoDialog.showModal();
  devotionalVideo.play().catch(() => {});
});
videoDialog.querySelector(".video-close").addEventListener("click", () =>
  videoDialog.close(),
);
videoDialog.addEventListener("click", (event) => {
  if (event.target === videoDialog) videoDialog.close();
});
videoDialog.addEventListener("close", () => devotionalVideo.pause());

const galleryVideo = document.querySelector(".figma-empty-gallery video");
const galleryVideoButton = document.querySelector(".gallery-video-button");
const syncGalleryButton = () => galleryVideoButton.setAttribute("aria-label", galleryVideo.paused ? "Play Japa Bags video" : "Pause Japa Bags video");
galleryVideo.addEventListener("play", syncGalleryButton);
galleryVideo.addEventListener("pause", syncGalleryButton);
galleryVideoButton.addEventListener("click", () => {
  if (galleryVideo.paused) galleryVideo.play().catch(syncGalleryButton);
  else galleryVideo.pause();
});
syncGalleryButton();
const galleryMotion = matchMedia("(prefers-reduced-motion: reduce)");
const syncGalleryMotion = () => {
  galleryVideo.autoplay = !galleryMotion.matches;
  if (galleryMotion.matches) galleryVideo.pause();
};
syncGalleryMotion();
galleryMotion.addEventListener("change", syncGalleryMotion);

const promotionTrack = document.querySelector(".promotion-track");
const promotionCopy = promotionTrack.firstElementChild.cloneNode(true);
promotionCopy.setAttribute("aria-hidden", "true");
promotionTrack.append(promotionCopy, promotionCopy.cloneNode(true));
const promotionToggle = document.querySelector(".promotion-toggle");
promotionToggle.addEventListener("click", () => {
  const paused = promotionTrack.classList.toggle("is-paused");
  promotionToggle.setAttribute("aria-pressed", String(paused));
  promotionToggle.setAttribute("aria-label", paused ? "Resume scrolling offer" : "Pause scrolling offer");
  promotionToggle.textContent = paused ? "▶" : "Ⅱ";
});

const syncCollectionImages = () => {
  document.querySelectorAll(".best-sellers .product-card").forEach((card) => {
    const product = HarinamShop.catalog.find((item) => String(item.id) === card.dataset.productId);
    const photo = card.querySelector(".product-photo");
    const primary = photo.querySelector(".product-primary-image");
    const main = product?.image || primary.getAttribute("src");
    const alternate = card.dataset.hoverSrc || (Array.isArray(product?.images) ? product.images : []).find((src) => src && src !== main);
    const existing = photo.querySelector(".product-hover-image");
    if (!alternate) {
      existing?.remove();
      delete photo.dataset.hoverReady;
      return;
    }
    if (existing?.getAttribute("src") === alternate && primary.getAttribute("src") === main) return;
    existing?.remove();
    delete photo.dataset.hoverReady;
    const fallback = primary.getAttribute("src");
    const secondary = document.createElement("img");
    secondary.className = "product-hover-image";
    secondary.loading = "lazy";
    secondary.decoding = "async";
    secondary.alt = `${product?.name || primary.alt} — another view`;
    const ready = () => {
      if (secondary.parentElement === photo && primary.complete && primary.naturalWidth > 0 && secondary.complete && secondary.naturalWidth > 0) photo.dataset.hoverReady = "true";
    };
    secondary.addEventListener("load", ready);
    secondary.addEventListener("error", () => {
      if (secondary.parentElement === photo) delete photo.dataset.hoverReady;
      secondary.remove();
    });
    primary.addEventListener("load", ready, { once: true });
    if (main !== fallback) {
      primary.addEventListener("error", () => {
        if (primary.getAttribute("src") !== main) return;
        delete photo.dataset.hoverReady;
        secondary.remove();
        primary.src = fallback;
      }, { once: true });
      primary.src = main;
    }
    secondary.src = alternate;
    primary.after(secondary);
    ready();
  });
};
syncCollectionImages();
HarinamShop.catalogReady.then(syncCollectionImages).catch(() => {});
window.addEventListener("harinam:catalog", syncCollectionImages);

const offerSection = document.querySelector(".best-offer");
const offerGrid = document.querySelector("#best-offer-products");
const collectionGrid = document.querySelector(".best-sellers .product-grid");
const extraOfferGrids = [...document.querySelectorAll(".figma-offer .offer-grid")];
const escapeOfferHTML = (value) => String(value ?? "").replace(
  /[&<>"']/g,
  (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
);
const syncHomeCategories = () => {
  document.querySelectorAll(".category-card[data-category]").forEach((card) => {
    const category = card.dataset.category;
    const title = card.querySelector("h3").textContent;
    const product = HarinamShop.catalog.find((item) => item.listed !== false && (item.categories || []).includes(category));
    const replacement = document.createElement(product ? "a" : "article");
    replacement.className = "category-card";
    replacement.dataset.category = category;
    if (product) {
      replacement.href = `products.html?category=${encodeURIComponent(category)}`;
      replacement.setAttribute("aria-label", `Shop ${title}`);
      const alternate = (product.images || []).find((image) => image && image !== product.image);
      replacement.innerHTML = `<div class="category-photo"><img loading="lazy" decoding="async" src="${escapeOfferHTML(product.image)}" width="240" height="240" alt="" />${alternate ? `<img class="category-hover-image" loading="lazy" decoding="async" src="${escapeOfferHTML(alternate)}" width="240" height="240" alt="" />` : ""}</div><h3>${escapeOfferHTML(title)}</h3>`;
      const hover = replacement.querySelector(".category-hover-image");
      if (hover) prepareCategoryHover(hover);
    } else {
      replacement.setAttribute("aria-disabled", "true");
      replacement.title = "Coming soon";
      replacement.innerHTML = `<div class="category-photo category-coming-soon"><span class="coming-soon-logo"><img loading="lazy" decoding="async" src="assets/header-logo1-65a5c2b0.png" alt="" /></span></div><h3>${escapeOfferHTML(title)}</h3><span class="visually-hidden">Coming soon</span>`;
    }
    card.replaceWith(replacement);
  });
};
HarinamShop.catalogReady.then(syncHomeCategories).catch(() => {});
window.addEventListener("harinam:catalog", syncHomeCategories);
const offerPrice = (value) => {
  const amount = Number(value);
  return `${amount.toLocaleString("en-IN")}${Number.isInteger(amount) ? "." : ""}`;
};
const offerCard = (product, wishlist) => {
  const id = escapeOfferHTML(product.id);
  const name = escapeOfferHTML(product.name);
  const url = `product-details.html?id=${encodeURIComponent(product.id)}`;
  const saved = wishlist.has(String(product.id));
  const rating = Number(product.rating);
  const hasRating = Number.isFinite(rating) && rating > 0;
  const oldPrice = Number(product.oldPrice);
  const price = Number(product.price);
  const currency = product.currency === "INR"
    ? '<img src="assets/collections-rupee.png" width="10" height="16" alt="₹" />'
    : `${escapeOfferHTML(product.currency || "")}&nbsp;`;
  return `<article class="offer-card" data-product-id="${id}">
    <div class="offer-card-photo">
      <a href="${url}" aria-label="View ${name}"><img loading="lazy" decoding="async" src="${escapeOfferHTML(product.image)}" alt="${name}" /></a>
      <button class="heart-button${saved ? " active" : ""}" type="button" aria-pressed="${saved}" aria-label="${saved ? "Remove" : "Add"} ${name} ${saved ? "from" : "to"} wishlist"><img src="assets/offer-today-heart${saved ? "-filled" : ""}.svg" alt="" /></button>
    </div>
    <div class="offer-card-info">
      <div class="offer-card-name-row"><a href="${url}">${name}</a>${hasRating ? `<span class="rating"><img src="assets/offer-today-star.svg" alt="" /><img src="assets/offer-today-star.svg" alt="" /><span class="rating-score">${escapeOfferHTML(rating)}</span></span>` : ""}</div>
      <p class="offer-card-price"><strong>${currency}<span>${offerPrice(price)}</span></strong>${oldPrice > price ? `<del>${offerPrice(oldPrice).replace(/\.$/, "")}</del>` : ""}</p>
    </div>
  </article>`;
};

const collectionCard = (product, wishlist) => {
  const name = escapeOfferHTML(product.name);
  const url = `product-details.html?id=${encodeURIComponent(product.id)}`;
  const saved = wishlist.has(String(product.id));
  const currency = product.currency === "INR"
    ? '<img src="assets/collections-rupee.png" width="10" height="16" alt="₹" />'
    : `${escapeOfferHTML(product.currency || "")}&nbsp;`;
  return `<article class="product-card" data-product-id="${escapeOfferHTML(product.id)}">
    <div class="product-photo">
      <img class="product-primary-image" loading="lazy" decoding="async" src="${escapeOfferHTML(product.image)}" alt="${name}" />
      <a class="product-image-link" href="${url}" aria-label="View ${name} details"></a>
      <button class="heart-button${saved ? " active" : ""}" type="button" aria-pressed="${saved}" aria-label="${saved ? "Remove" : "Add"} ${name} ${saved ? "from" : "to"} wishlist"><img src="assets/bestsellers-heart-f007651a.svg?v=2" alt="" /></button>
      <button class="product-quick-add" type="button" ${product.available ? "" : "disabled"}>${!product.available ? "Out of Stock" : product.type === "variable" ? "Choose Options" : "Quick Add"}</button>
    </div>
    <div class="product-name-row"><h3><a href="${url}">${name}</a></h3>${Number(product.rating) > 0 ? `<span class="rating"><img src="assets/bestsellers-frame149037-49195c89.svg?v=2" alt="" /><span class="rating-score">${escapeOfferHTML(product.rating)}</span></span>` : ""}</div>
    <p class="price"><strong>${currency}<span>${offerPrice(product.price)}</span></strong>${Number(product.oldPrice) > Number(product.price) ? `<del>${offerPrice(product.oldPrice).replace(/\.$/, "")}</del>` : ""}</p>
  </article>`;
};

const renderHomeProducts = () => {
  const products = HarinamShop.catalog.filter((product) => product.listed !== false);
  const wishlist = HarinamShop.getWishlist();
  const soldProducts = products
    .filter((product) => Number(product.totalSales) > 0)
    .sort((a, b) => Number(b.totalSales) - Number(a.totalSales) || Number(a.id) - Number(b.id))
    .slice(0, 5);
  const rankedProducts = products
    .filter((product) => Number(product.topSellerRank) > 0)
    .sort((a, b) => Number(a.topSellerRank) - Number(b.topSellerRank))
    .slice(0, 5);
  const topSellers = soldProducts.length ? soldProducts : rankedProducts.length ? rankedProducts : products
    .filter((product) => product.available)
    .slice(0, 5);
  const offers = topSellers.map((product) => offerCard(product, wishlist)).join("");
  offerGrid.innerHTML = offers;
  offerSection.hidden = topSellers.length === 0;
  extraOfferGrids.forEach((grid) => {
    grid.innerHTML = offers;
    grid.closest(".figma-offer").hidden = topSellers.length === 0;
  });
  collectionGrid.innerHTML = products.slice(0, 10).map((product) => collectionCard(product, wishlist)).join("") || '<p class="home-catalog-status" role="status">No products available right now.</p>';
  syncCollectionImages();
};
HarinamShop.catalogReady.then(renderHomeProducts).catch(() => {
  offerSection.hidden = true;
  extraOfferGrids.forEach((grid) => { grid.closest(".figma-offer").hidden = true; });
  collectionGrid.innerHTML = '<p class="home-catalog-status" role="status">Products unavailable. Please refresh to try again.</p>';
});
window.addEventListener("harinam:catalog", renderHomeProducts);

const syncHomeWishlist = () => {
  const wishlist = HarinamShop.getWishlist();
  [collectionGrid, offerGrid, ...extraOfferGrids].forEach((grid) => grid.querySelectorAll("[data-product-id]").forEach((card) => {
    const product = HarinamShop.catalog.find((item) => String(item.id) === card.dataset.productId);
    if (!product) return;
    const saved = wishlist.has(String(product.id));
    const heart = card.querySelector(".heart-button");
    heart.classList.toggle("active", saved);
    if (card.classList.contains("offer-card")) heart.querySelector("img").src = `assets/offer-today-heart${saved ? "-filled" : ""}.svg`;
    heart.setAttribute("aria-pressed", String(saved));
    heart.setAttribute("aria-label", `${saved ? "Remove" : "Add"} ${product.name} ${saved ? "from" : "to"} wishlist`);
  }));
};
window.addEventListener("harinam:wishlist", syncHomeWishlist);
window.addEventListener("storage", syncHomeWishlist);

[collectionGrid, offerGrid, ...extraOfferGrids].forEach((grid) => grid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-product-id]");
  if (!card) return;
  const product = HarinamShop.catalog.find((item) => String(item.id) === card.dataset.productId);
  if (!product) return;
  if (event.target.closest(".heart-button")) HarinamShop.toggleWishlist(product.id);
  else if (event.target.closest(".product-quick-add")) {
    if (product.type === "variable") location.href = `product-details.html?id=${encodeURIComponent(product.id)}`;
    else if (HarinamShop.addToCart(product)) showToast("Added to bag");
  }
}));
