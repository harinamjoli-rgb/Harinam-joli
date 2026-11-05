(function () {
  const CART_KEY = "harinam-joli-cart";
  const WISHLIST_KEY = "harinam-joli-wishlist";
  const apiBase = window.HarinamConfig?.apiBase;
  const catalog = [];
  let currentUser = null;
  let nonce = "";
  let csrf = "";
  let countries = { IN: "India" };

  [
    "harinam-joli-users",
    "harinam-joli-session",
    "harinam-joli-password-reset",
    "harinam-joli-orders",
    "harinam-joli-product-reviews",
  ].forEach((key) => localStorage.removeItem(key));

  const read = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
    } catch {
      return fallback;
    }
  };

  const request = async (path, options = {}, retry = true) => {
    if (!apiBase) throw new Error("Store API is not configured.");
    const method = options.method || "GET";
    const headers = { Accept: "application/json", ...options.headers };
    const body =
      options.body && typeof options.body !== "string"
        ? JSON.stringify(options.body)
        : options.body;
    if (options.body && typeof options.body !== "string") {
      headers["Content-Type"] = "application/json";
    }
    if (options.auth !== false && nonce) headers["X-WP-Nonce"] = nonce;
    if (options.csrf) headers["X-Harinam-CSRF"] = csrf;
    let response;
    try {
      response = await fetch(`${apiBase}${path}`, {
        ...options,
        body,
        method,
        headers,
        credentials: "include",
      });
    } catch {
      throw new Error("Store service is unavailable. Please try again.");
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (
        retry &&
        options.auth !== false &&
        ["rest_cookie_invalid_nonce", "harinam_auth_required"].includes(
          data.code,
        )
      ) {
        await refreshSession();
        if (currentUser) return request(path, options, false);
      }
      const error = new Error(
        data.message || "The store could not complete this request.",
      );
      error.code = data.code;
      error.status = response.status;
      throw error;
    }
    return data;
  };

  const setSession = (data) => {
    currentUser = data.authenticated ? data.user : null;
    nonce = data.nonce || "";
    csrf = data.csrf || csrf;
    countries = data.countries || countries;
    window.dispatchEvent(new CustomEvent("harinam:account"));
    renderNavState();
    return currentUser;
  };

  const refreshSession = async () =>
    setSession(await request("/session", { auth: false }, false));

  const beginSocialLogin = async (provider) => {
    await refreshSession();
    const token = csrf;
    const flow = await request("/auth/social/start", {
      method: "POST", auth: false, csrf: true,
      body: { provider, returnOrigin: location.origin },
    });
    return {
      state: flow.state, url: flow.url,
      async finish(grant) {
        await request("/auth/social/finish", {
          method: "POST", auth: false,
          headers: { "X-Harinam-CSRF": token },
          body: { state: flow.state, grant },
        });
        const user = await refreshSession();
        if (!user) throw new Error("Sign-in could not be confirmed. Please try again.");
        return user;
      },
    };
  };

  const syncCategoryNavigation = () => {
    document
      .querySelectorAll('.nav-menu a[href*="products.html?category="]')
      .forEach((link) => (link.hidden = false));
    document.documentElement.classList.add("catalog-ready");
  };

  const loadCatalog = async () => {
    const products = [];
    let page = 1;
    let totalPages = 1;
    do {
      const data = await request(
        `/products?page=${page}&per_page=100`,
        { auth: false },
        false,
      );
      products.push(...(Array.isArray(data.products) ? data.products : []));
      totalPages = Math.max(1, Number(data.total_pages) || 1);
      page += 1;
    } while (page <= totalPages);
    catalog.splice(0, catalog.length, ...products);
    syncCategoryNavigation();
    saveCart(
      getCart().flatMap((item) => {
        const product = catalog.find(
          (entry) => String(entry.id) === String(item.productId),
        );
        const variation = item.variationId
          ? product?.variations?.find(
              (entry) => String(entry.id) === String(item.variationId),
            )
          : null;
        if (!product || (item.variationId && !variation)) return [];
        const selected = variation || product;
        return [{
          ...item,
          name: variation
            ? `${product.name} — ${variation.attributes.map((entry) => entry.value).join(", ")}`
            : product.name,
          image: selected.image || product.image,
          price: Number(selected.price),
          priceToken: selected.priceToken,
          oldPrice: Number(selected.oldPrice || selected.price),
          currency: product.currency,
        }];
      }),
      false,
    );
    window.dispatchEvent(new CustomEvent("harinam:catalog"));
    renderNavState();
    return catalog;
  };

  const sessionReady = refreshSession();
  const catalogReady = loadCatalog();
  const ready = Promise.allSettled([sessionReady, catalogReady]);

  const getCart = () => {
    const cart = read(CART_KEY, []);
    return Array.isArray(cart)
      ? cart.filter(
          (item) =>
            item &&
            Number(item.productId) > 0 &&
            Number.isInteger(Number(item.quantity)) &&
            Number(item.quantity) > 0,
        )
      : [];
  };

  function saveCart(cart, dispatch = true) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    if (dispatch) window.dispatchEvent(new CustomEvent("harinam:cart"));
  }

  const cartCount = () =>
    getCart().reduce((total, item) => total + Number(item.quantity), 0);

  const addToCart = (product, quantity = 1, variation = null) => {
    if (!product?.id || (product.type === "variable" && !variation))
      return false;
    const selected = variation || product;
    if (!selected.available) return false;
    const productId = Number(product.id);
    const variationId = variation ? Number(variation.id) : 0;
    const id = `${productId}:${variationId}`;
    const amount = Math.max(1, Math.min(99, Number(quantity) || 1));
    const cart = getCart();
    const existing = cart.find((item) => item.id === id);
    if (existing)
      existing.quantity = Math.min(99, Number(existing.quantity) + amount);
    else
      cart.push({
        id,
        productId,
        variationId,
        name: variation
          ? `${product.name} — ${variation.attributes.map((item) => item.value).join(", ")}`
          : product.name,
        image: selected.image || product.image,
        price: Number(selected.price),
        priceToken: selected.priceToken,
        oldPrice: Number(selected.oldPrice || selected.price),
        currency: product.currency,
        quantity: amount,
      });
    saveCart(cart);
    return true;
  };

  const updateCartItem = (id, quantity) => {
    const cart = getCart();
    const item = cart.find((entry) => entry.id === id);
    if (!item) return;
    item.quantity = Math.max(1, Math.min(99, Number(quantity) || 1));
    saveCart(cart);
  };
  const removeCartItem = (id) =>
    saveCart(getCart().filter((item) => item.id !== id));
  const clearCart = () => saveCart([]);

  const checkoutItems = () =>
    getCart().map((item) => ({
      product_id: Number(item.productId),
      variation_id: Number(item.variationId) || 0,
      quantity: Number(item.quantity),
      expected_price_token: item.priceToken,
    }));

  const syncCart = (items) => {
    const old = getCart();
    saveCart(
      items.map((item) => {
        const id = `${item.productId}:${item.variationId || 0}`;
        const existing = old.find((entry) => entry.id === id);
        return {
          id,
          productId: Number(item.productId),
          variationId: Number(item.variationId) || 0,
          name: item.name,
          image: item.image,
          price: Number(item.price),
          priceToken: item.priceToken,
          oldPrice: Number(existing?.oldPrice || item.price),
          currency: item.currency || existing?.currency || "INR",
          quantity: Number(item.quantity),
        };
      }),
    );
  };

  const getWishlist = () => {
    const saved = read(WISHLIST_KEY, []);
    const valid = new Set(catalog.map((product) => String(product.id)));
    return new Set(
      Array.isArray(saved)
        ? saved.map(String).filter((id) => valid.has(id))
        : [],
    );
  };
  const saveWishlist = (wishlist) => {
    localStorage.setItem(WISHLIST_KEY, JSON.stringify([...wishlist]));
    window.dispatchEvent(new CustomEvent("harinam:wishlist"));
  };
  const toggleWishlist = (id) => {
    id = String(id);
    if (!catalog.some((product) => String(product.id) === id)) return false;
    const wishlist = getWishlist();
    const adding = !wishlist.has(id);
    adding ? wishlist.add(id) : wishlist.delete(id);
    saveWishlist(wishlist);
    return adding;
  };

  const applyAuth = (data) => {
    currentUser = data.user;
    nonce = data.nonce || "";
    window.dispatchEvent(new CustomEvent("harinam:account"));
    renderNavState();
    return currentUser;
  };
  const createUser = async (values) => {
    await sessionReady.catch(() => {});
    return applyAuth(
      await request("/register", {
        method: "POST",
        auth: false,
        csrf: true,
        body: values,
      }),
    );
  };
  const signIn = async (values) => {
    await sessionReady.catch(() => {});
    return applyAuth(
      await request("/login", {
        method: "POST",
        auth: false,
        csrf: true,
        body: values,
      }),
    );
  };
  const signOut = async () => {
    const data = await request("/logout", { method: "POST" });
    currentUser = null;
    nonce = "";
    csrf = data.csrf || "";
    window.dispatchEvent(new CustomEvent("harinam:account"));
    renderNavState();
  };
  const updateProfile = async (values) => {
    const data = await request("/profile", { method: "PATCH", body: values });
    currentUser = data.user;
    nonce = data.nonce || nonce;
    window.dispatchEvent(new CustomEvent("harinam:account"));
    renderNavState();
    return currentUser;
  };
  const requestPasswordReset = async (email) => {
    await sessionReady.catch(() => {});
    return request("/password-reset", {
      method: "POST",
      auth: false,
      csrf: true,
      body: { email },
    });
  };

  function renderNavState() {
    const count = cartCount();
    document.querySelectorAll("[data-cart-count]").forEach((badge) => {
      badge.textContent = count;
      badge.setAttribute(
        "aria-label",
        `${count} cart ${count === 1 ? "item" : "items"}`,
      );
    });
    const savedCount = getWishlist().size;
    document.querySelectorAll("[data-wishlist-count]").forEach((badge) => {
      badge.textContent = savedCount;
      badge.setAttribute(
        "aria-label",
        `${savedCount} wishlist ${savedCount === 1 ? "item" : "items"}`,
      );
    });
    document.querySelectorAll("[data-account-link]").forEach((link) => {
      link.setAttribute(
        "aria-label",
        currentUser
          ? `Account: ${currentUser.name}`
          : "Login or create account",
      );
      link.title = currentUser
        ? `Hi, ${currentUser.name.split(" ")[0]}`
        : "Login / Create account";
    });
    const accountMenuAuth = document.querySelector("[data-account-menu-auth]");
    if (accountMenuAuth)
      accountMenuAuth.textContent = currentUser
        ? `Hi, ${currentUser.name.split(" ")[0]}`
        : "Sign in / Create Account";
  }

  const ensureNavigation = () => {
    const button = document.querySelector("#home-menu-button, #mobile-menu-button");
    if (!button) return;
    const menu = document.getElementById(button.getAttribute("aria-controls"));
    const dropdown = menu.querySelector(".nav-dropdown");
    const category = dropdown.closest(".nav-category");
    const summary = dropdown.querySelector("summary");
    let arrowHovered = false;
    summary.addEventListener("pointerenter", (event) => {
      arrowHovered = event.pointerType === "mouse";
      if (arrowHovered) dropdown.open = true;
    });
    summary.addEventListener("pointerleave", () => { arrowHovered = false; });
    summary.addEventListener("click", (event) => {
      if (arrowHovered && event.detail !== 0) {
        event.preventDefault();
        dropdown.open = true;
      }
    });
    category.querySelector(".nav-category-link").addEventListener("pointerenter", () => {
      dropdown.open = false;
    });
    category.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "mouse") dropdown.open = false;
    });
    const close = () => {
      menu.classList.remove("open");
      button.setAttribute("aria-expanded", "false");
      dropdown.open = false;
    };
    button.addEventListener("click", () => {
      const opening = !menu.classList.contains("open");
      close();
      menu.classList.toggle("open", opening);
      button.setAttribute("aria-expanded", String(opening));
    });
    menu.addEventListener("click", (event) => {
      if (event.target.closest("a")) close();
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".nav-category")) dropdown.open = false;
      if (!event.target.closest(".navbar")) close();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (dropdown.open) {
        dropdown.open = false;
        summary.focus();
      } else if (menu.classList.contains("open")) {
        close();
        button.focus();
      }
    });
  };

  const ensureAccountMenu = () => {
    const triggers = [...document.querySelectorAll("[data-account-link]")];
    if (!triggers.length || document.querySelector("#account-menu")) return;
    const menu = document.createElement("div");
    menu.className = "account-menu";
    menu.id = "account-menu";
    menu.hidden = true;
    menu.innerHTML = `
      <a class="account-menu-auth" href="account.html" data-account-menu-auth>Sign in / Create Account</a>
      <div class="account-menu-divider"></div>
      <div class="account-menu-group">
        <a class="account-menu-row" href="account.html"><img src="assets/account-order-history.svg?v=2" alt=""><span>Order History</span><img src="assets/account-chevron.svg?v=2" alt=""></a>
        <a class="account-menu-row" href="tracking.html"><img src="assets/account-track-order.svg?v=2" alt=""><span>Track Order</span><img src="assets/account-chevron.svg?v=2" alt=""></a>
      </div>
      <div class="account-menu-divider"></div>
      <div class="account-menu-group">
        <a class="account-menu-row" href="wishlist.html"><img src="assets/account-wishlist.svg?v=2" alt=""><span>My Wishlist</span><img src="assets/account-chevron.svg?v=2" alt=""></a>
        <a class="account-menu-row" href="profile.html"><img src="assets/account-profile.svg?v=2" alt=""><span>My Profile</span><img src="assets/account-chevron.svg?v=2" alt=""></a>
      </div>`;
    triggers[0].closest(".nav-actions").append(menu);
    const close = () => {
      menu.hidden = true;
      triggers.forEach((trigger) =>
        trigger.setAttribute("aria-expanded", "false"),
      );
    };
    triggers.forEach((trigger) => {
      trigger.setAttribute("role", "button");
      trigger.setAttribute("aria-controls", menu.id);
      trigger.setAttribute("aria-expanded", "false");
      trigger.addEventListener("click", (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return;
        event.preventDefault();
        const opening = menu.hidden;
        close();
        menu.hidden = !opening;
        trigger.setAttribute("aria-expanded", String(opening));
      });
      trigger.addEventListener("keydown", (event) => {
        if (event.key === " ") {
          event.preventDefault();
          trigger.click();
        }
      });
    });
    document.addEventListener("click", (event) => {
      if (
        !menu.hidden &&
        !event.target.closest("#account-menu, [data-account-link]")
      )
        close();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
  };

  const ensureSearch = () => {
    if (document.querySelector("#shop-search-dialog")) return;
    const dialog = document.createElement("dialog");
    dialog.className = "shop-search-dialog";
    dialog.id = "shop-search-dialog";
    dialog.setAttribute("aria-label", "Search products");
    dialog.innerHTML = `
      <form class="shop-search-form" method="dialog">
        <div class="shop-search-top">
          <label class="shop-search-input"><img src="assets/header-vuesax-outline-search-normal-9f2ae478.svg?v=2" alt=""><input type="search" name="q" placeholder="Search japa bags and more" aria-label="Search products" autocomplete="off"></label>
          <button type="button" class="shop-search-clear" hidden>Clear</button>
          <button type="button" class="shop-search-close" aria-label="Close search">×</button>
        </div>
        <div class="shop-search-body"><p class="shop-search-caption">Products</p><div class="shop-search-results" aria-live="polite"></div><a class="shop-search-view-all" href="products.html" hidden>View all</a></div>
      </form>`;
    document.body.append(dialog);
    const input = dialog.querySelector("input");
    const results = dialog.querySelector(".shop-search-results");
    const clear = dialog.querySelector(".shop-search-clear");
    const viewAll = dialog.querySelector(".shop-search-view-all");
    const caption = dialog.querySelector(".shop-search-caption");
    const positionSearch = () => dialog.style.setProperty("--search-top", `${Math.max(0, document.querySelector(".navbar").getBoundingClientRect().bottom)}px`);
    window.addEventListener("resize", () => { if (dialog.open) positionSearch(); });
    let catalogFailed = false;
    const renderResults = () => {
      const term = input.value.trim().toLowerCase();
      caption.textContent = term ? "Search results" : "Most looked at";
      const matches = catalog
        .filter((product) => !term || product.name.toLowerCase().includes(term))
        .slice(0, term ? 8 : 4);
      clear.hidden = !input.value;
      viewAll.hidden = !term || !matches.length;
      viewAll.href = `products.html?search=${encodeURIComponent(input.value.trim())}`;
      results.replaceChildren();
      if (!matches.length) {
        const empty = document.createElement("p");
        empty.className = "shop-search-empty";
        empty.textContent = catalog.length
          ? "No matching products found."
          : catalogFailed ? "Products are temporarily unavailable." : "Products are loading…";
        results.append(empty);
        return;
      }
      matches.forEach((product) => {
        const link = document.createElement("a");
        link.className = "shop-search-result";
        link.href = `product-details.html?id=${encodeURIComponent(product.id)}`;
        const image = document.createElement("img");
        image.src = product.image;
        image.alt = "";
        const photo = document.createElement("span");
        photo.className = "shop-search-photo";
        photo.append(image);
        if (product.images?.[1] && product.images[1] !== product.image) {
          const alternate = document.createElement("img");
          alternate.className = "shop-search-alt";
          alternate.src = product.images[1];
          alternate.alt = "";
          alternate.onerror = () => alternate.remove();
          photo.append(alternate);
        }
        const copy = document.createElement("span");
        copy.className = "shop-search-copy";
        const name = document.createElement("b");
        name.textContent = product.name;
        const money = new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: product.currency || "INR",
          maximumFractionDigits: 0,
        });
        copy.append(name);
        if (Number(product.oldPrice) > Number(product.price)) {
          const oldPrice = document.createElement("del");
          oldPrice.textContent = money.format(Number(product.oldPrice));
          copy.append(oldPrice);
        }
        const price = document.createElement("strong");
        price.textContent = money.format(Number(product.price));
        copy.append(price);
        link.append(photo, copy);
        results.append(link);
      });
    };
    catalogReady.then(renderResults, () => {
      catalogFailed = true;
      renderResults();
    });
    input.addEventListener("input", renderResults);
    clear.addEventListener("click", () => {
      input.value = "";
      renderResults();
      input.focus();
    });
    dialog.querySelector("form").addEventListener("submit", (event) => {
      event.preventDefault();
      const term = input.value.trim();
      if (term) location.href = `products.html?search=${encodeURIComponent(term)}`;
    });
    dialog
      .querySelector(".shop-search-close")
      .addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    document.querySelectorAll("[data-search-trigger]").forEach((button) =>
      button.addEventListener("click", () => {
        const menuButton = document.querySelector('#home-menu-button[aria-expanded="true"], #mobile-menu-button[aria-expanded="true"]');
        if (menuButton) menuButton.click();
        positionSearch();
        renderResults();
        dialog.showModal();
        requestAnimationFrame(() => input.focus());
      }),
    );
  };

  const ensureInstagramLinks = () => {
    document
      .querySelectorAll(".instagram-grid > img, .instagram-grid > video")
      .forEach((media) => {
        const link = document.createElement("a");
        link.className = "instagram-post-link";
        link.href = "https://www.instagram.com/harinamjoli/";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.setAttribute("aria-label", "Open @harinamjoli on Instagram");
        media.before(link);
        link.append(media);
      });
  };

  const ensureWhatsApp = () => {
    if (document.querySelector(".whatsapp-float")) return;
    const link = document.createElement("a");
    link.className = "whatsapp-float";
    link.href = "https://wa.me/919913032130";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", "Chat with Harinam Joli on WhatsApp");
    link.innerHTML = `<img src="assets/whatsapp-logo.png" alt="" />`;
    document.body.append(link);
  };

  const ensureAnnouncementSlider = () => {
    const message = document.querySelector(".announcement p");
    const buttons = [...document.querySelectorAll(".shipping-arrow")];
    if (!message || buttons.length !== 2) return;
    const messages = [
      "Enjoy Free Shipping 599+ in India",
      "Easy Returns & Replacement",
      "Premium Quality Guaranteed",
    ];
    const track = document.createElement("span");
    track.className = "announcement-track";
    track.setAttribute("aria-hidden", "true");
    messages.forEach((text, index) => {
      const item = document.createElement("span");
      item.textContent = text;
      item.hidden = index !== 0;
      track.append(item);
    });
    const accessibleMessage = document.createElement("span");
    accessibleMessage.className = "visually-hidden";
    accessibleMessage.textContent = messages.join(". ");
    message.classList.add("announcement-window");
    message.replaceChildren(accessibleMessage, track);
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    let index = 0;
    let hovered = false;
    let focused = false;
    const show = (next) => {
      index = (next + messages.length) % messages.length;
      [...track.children].forEach((item, i) => { item.hidden = i !== index; });
      if (!reducedMotion.matches) track.animate(
        [{ opacity: 0, transform: "translateY(5px)" }, { opacity: 1, transform: "translateY(0)" }],
        { duration: 350, easing: "ease-out" },
      );
    };
    const region = message.parentElement;
    region.addEventListener("pointerenter", () => { hovered = true; });
    region.addEventListener("pointerleave", () => { hovered = false; });
    region.addEventListener("focusin", () => { focused = true; });
    region.addEventListener("focusout", (event) => { focused = region.contains(event.relatedTarget); });
    setInterval(() => {
      if (!reducedMotion.matches && !hovered && !focused && !document.hidden) show(index + 1);
    }, 5000);
    buttons.forEach((button, buttonIndex) =>
      button.addEventListener("click", () => show(index + (buttonIndex ? 1 : -1))),
    );
  };

  const prefetched = new Set();
  const prefetchAsset = (href, as) => {
    const url = new URL(href, location.href);
    url.hash = "";
    if (url.origin !== location.origin || prefetched.has(url.href)) return;
    prefetched.add(url.href);
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = url.href;
    if (as) link.as = as;
    document.head.append(link);
  };
  const prefetchRoute = (href) => {
    const url = new URL(href, location.href);
    if (!url.pathname.endsWith(".html") || url.pathname === location.pathname)
      return;
    prefetchAsset(url.href, "document");
  };
  document.addEventListener(
    "pointerover",
    (event) => {
      const link = event.target.closest("a[href]");
      if (link) prefetchRoute(link.href);
    },
    { passive: true },
  );

  window.HarinamShop = {
    catalog,
    ready,
    catalogReady,
    refreshCatalog: loadCatalog,
    sessionReady,
    request,
    refreshSession,
    beginSocialLogin,
    countries: () => countries,
    getCart,
    saveCart,
    syncCart,
    checkoutItems,
    cartCount,
    addToCart,
    updateCartItem,
    removeCartItem,
    clearCart,
    getWishlist,
    saveWishlist,
    toggleWishlist,
    currentUser: () => currentUser,
    createUser,
    signIn,
    signOut,
    updateProfile,
    requestPasswordReset,
    renderNavState,
  };
  ensureInstagramLinks();
  ensureWhatsApp();
  ensureAnnouncementSlider();
  ensureSearch();
  ensureNavigation();
  ensureAccountMenu();
  renderNavState();
  window.addEventListener("storage", renderNavState);
  window.addEventListener("harinam:cart", renderNavState);
  window.addEventListener("harinam:wishlist", renderNavState);
  window.addEventListener("harinam:account", renderNavState);
})();
