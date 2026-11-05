(() => {
  const syncNavigationState = () => {
    const route = new URL(location.href);
    const page = route.pathname.replace(/\/$/, "").replace(/\.html$/, "") || "/";
    const category = route.searchParams.get("category");
    document.querySelectorAll(".nav-menu a[href]").forEach((link) => {
      const target = new URL(link.href, location.href);
      const targetPage = target.pathname.replace(/\/$/, "").replace(/\.html$/, "") || "/";
      const targetCategory = target.searchParams.get("category");
      const parentCategory = category === "Digital Print" && targetCategory === "Japa Bag" && link.classList.contains("nav-category-link");
      const active = (page === targetPage || page === "/store" && targetPage === "/") && (targetPage !== "/products" || category === targetCategory || parentCategory);
      link.classList.toggle("active", active);
      if (active && !parentCategory) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  };
  syncNavigationState();
  window.addEventListener("popstate", syncNavigationState);
  window.addEventListener("harinam:catalog-route", syncNavigationState);

  const smoothScroll = window.Lenis ? new Lenis({
    autoRaf: true,
    autoToggle: true,
    lerp: 0.075,
    anchors: true,
    allowNestedScroll: true,
    stopInertiaOnNavigate: true,
  }) : null;

  if (window.performance?.getEntriesByType("navigation")[0]?.type === "reload") {
    window.history.scrollRestoration = "manual";
    const resetScroll = () => {
      smoothScroll?.scrollTo(0, { immediate: true, force: true });
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    };
    resetScroll();
    window.addEventListener("pageshow", () => requestAnimationFrame(() => {
      resetScroll();
      window.history.scrollRestoration = "auto";
    }), { once: true });
  }
})();
