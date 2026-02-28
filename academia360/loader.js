(() => {
  const LOADER_DELAY_MS = 1000;
  const el = document.getElementById("globalLoader");
  if (!el) return;

  let t = null;
  let isShown = false;

  const show = () => {
    if (isShown) return;
    isShown = true;
    el.classList.add("is-on");
    el.setAttribute("aria-hidden", "false");
  };

  const hide = () => {
    if (t) { clearTimeout(t); t = null; }
    isShown = false;
    el.classList.remove("is-on");
    el.setAttribute("aria-hidden", "true");
  };

 // Mejora percepción touch
  const header = document.getElementById("siteHeader");
  const onScroll = () => {
    if (!header) return;
    if (window.scrollY > 16) header.classList.add("is-scrolled");
    else header.classList.remove("is-scrolled");
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Exponemos helpers por si querés usarlo en fetch/login/etc.
  window.GlobalLoader = {
    show,
    hide,
    startDelayed() {
      if (t) clearTimeout(t);
      t = setTimeout(show, LOADER_DELAY_MS);
    }
  };

  // Ocultar cuando la página terminó de cargar (incluye bfcache "atrás")
  window.addEventListener("load", hide);
  window.addEventListener("pageshow", hide);

  // Mostrar SOLO si la navegación tarda > 1s
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a) return;

    const href = a.getAttribute("href") || "";
    const target = (a.getAttribute("target") || "").toLowerCase();

    // Ignorar anclas, downloads, nuevos tabs, mail/tel
    if (!href || href.startsWith("#")) return;
    if (a.hasAttribute("download")) return;
    if (target === "_blank") return;
    if (href.startsWith("mailto:") || href.startsWith("tel:")) return;

    // Ignorar externos
    try {
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
    } catch {
      // si no parsea, lo dejamos pasar como relativo
    }

    // Iniciar loader con delay
    window.GlobalLoader.startDelayed();
  });

  // Si la página está saliendo (navegación real), cancelamos timers
  window.addEventListener("beforeunload", () => {
    if (t) clearTimeout(t);
  });
})();
