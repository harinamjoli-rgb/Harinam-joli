(() => {
  const httpsURL = (value, instagram = false) => {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.searchParams.has("access_token")) return "";
      if (instagram && !["instagram.com", "www.instagram.com"].includes(url.hostname)) return "";
      return url.href;
    } catch { return ""; }
  };

  document.querySelectorAll("[data-instagram-feed]").forEach((section) => {
    const grid = section.querySelector(".instagram-grid");
    const previous = section.querySelector("[data-instagram-previous]");
    const next = section.querySelector("[data-instagram-next]");
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let interactionUntil = 0;
    let hovered = false;
    let focused = false;
    let visible = false;
    let position = grid.scrollLeft;
    let direction = 1;
    let lastTime = 0;

    const syncControls = () => {
      const fits = grid.scrollWidth <= grid.clientWidth + 1;
      previous.disabled = fits;
      next.disabled = fits;
    };
    const pause = () => { interactionUntil = performance.now() + 6000; };
    grid.addEventListener("pointerenter", (event) => { hovered = event.pointerType === "mouse"; });
    grid.addEventListener("pointerleave", () => { hovered = false; });
    grid.addEventListener("focusin", () => { focused = true; });
    grid.addEventListener("focusout", (event) => { focused = grid.contains(event.relatedTarget); });
    grid.addEventListener("pointerdown", pause, { passive: true });
    grid.addEventListener("wheel", pause, { passive: true });
    grid.addEventListener("keydown", pause);
    [previous, next].forEach((button, index) => button.addEventListener("click", () => {
      pause();
      const step = grid.firstElementChild.offsetWidth + parseFloat(getComputedStyle(grid).gap);
      grid.scrollBy({ left: (index ? 1 : -1) * step, behavior: motion.matches ? "instant" : "smooth" });
    }));
    new ResizeObserver(syncControls).observe(grid);
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(grid);
    const tick = (time) => {
      const elapsed = lastTime ? Math.min(time - lastTime, 64) : 0;
      lastTime = time;
      const playing = [...grid.querySelectorAll("video")].some((video) => !video.paused && !video.ended);
      const maximum = grid.scrollWidth - grid.clientWidth;
      if (!motion.matches && time >= interactionUntil && !hovered && !focused && visible && !document.hidden && !playing && maximum > 1) {
        position = Math.max(0, Math.min(maximum, position + direction * elapsed * .028));
        grid.scrollLeft = position;
        if (position >= maximum) direction = -1;
        if (position <= 0) direction = 1;
      } else position = grid.scrollLeft;
      requestAnimationFrame(tick);
    };
    syncControls();
    requestAnimationFrame(tick);

    const apiBase = window.HarinamConfig?.apiBase;
    if (!apiBase) return;
    const seen = new Set();
    const cursors = new Set();
    grid.setAttribute("aria-busy", "true");
    const loadPage = (cursor = "") => fetch(`${apiBase}/instagram${cursor ? `?cursor=${cursor}` : ""}`, { credentials: "omit", signal: AbortSignal.timeout(15000) })
      .then((response) => {
        if (!response.ok) throw new Error("Instagram feed unavailable");
        return response.json();
      })
      .then((data) => {
        if (!Array.isArray(data.posts)) throw new Error("Invalid Instagram feed");
        const cards = data.posts.flatMap((post) => {
          const src = httpsURL(post.url);
          const permalink = httpsURL(post.permalink, true);
          const id = `${post.id || permalink}|${src}`;
          if (!src || !permalink || seen.has(id)) return [];
          seen.add(id);
          const video = post.type === "VIDEO";
          const card = document.createElement(video ? "article" : "a");
          card.className = "instagram-post-link";
          const link = video ? document.createElement("a") : card;
          link.href = permalink;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.setAttribute("aria-label", `View ${video ? "reel" : "post"} by @harinamjoli on Instagram`);
          const media = document.createElement(video ? "video" : "img");
          media.src = src;
          const caption = String(post.caption || "Harinam Joli devotional collection").slice(0, 250);
          if (video) {
            media.controls = true;
            media.playsInline = true;
            media.preload = "none";
            media.poster = httpsURL(post.thumbnail);
            media.setAttribute("aria-label", caption);
            link.className = "instagram-video-link";
            link.textContent = "Open reel ↗";
          } else {
            media.loading = "lazy";
            media.decoding = "async";
            media.alt = caption;
          }
          card.append(media);
          if (video) card.append(link);
          return [card];
        });
        if (cards.length) {
          if (section.dataset.instagramSource === "live") grid.append(...cards);
          else {
            grid.replaceChildren(...cards);
            grid.scrollLeft = position = 0;
            direction = 1;
            section.dataset.instagramSource = "live";
          }
          syncControls();
        }
        if (typeof data.next === "string" && /^[a-f0-9]{32}$/.test(data.next) && !cursors.has(data.next)) {
          cursors.add(data.next);
          return loadPage(data.next);
        }
      });
    loadPage()
      .catch(() => {
        // shortcut: Keep saved previews during disconnection; the endpoint supplies automatic updates when connected.
        section.dataset.instagramSource ||= "gallery";
      })
      .finally(() => grid.setAttribute("aria-busy", "false"));
  });
})();
