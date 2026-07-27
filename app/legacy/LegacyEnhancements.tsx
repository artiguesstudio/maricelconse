"use client";

import { useEffect } from "react";

export function LegacyEnhancements({ pageKey }: { pageKey: string }) {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(`.legacy-page--${pageKey}`);
    if (!root) return;

    const cleanups: Array<() => void> = [];
    const reveals = Array.from(root.querySelectorAll<HTMLElement>(".reveal"));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12 },
    );
    reveals.forEach((element) => observer.observe(element));
    cleanups.push(() => observer.disconnect());

    root.querySelectorAll<HTMLElement>(".carousel").forEach((carousel) => {
      const track = carousel.querySelector<HTMLElement>(".carousel-track");
      if (!track) return;
      const dots = carousel.querySelector<HTMLElement>(".carousel-dots");
      const originals = Array.from(track.children) as HTMLElement[];
      const total = originals.length;
      if (!total) return;

      const gap = 24;
      const preferred = Number.parseInt(carousel.dataset.perView || "3", 10);
      let head: HTMLElement[] = [];
      let tail: HTMLElement[] = [];
      let position = 0;
      let visible = 3;
      let animating = false;
      let resizeTimer: number | undefined;

      const perView = () => (window.matchMedia("(max-width:840px)").matches ? 1 : preferred);
      const step = () => {
        const first = track.children[0] as HTMLElement | undefined;
        return first ? first.getBoundingClientRect().width + gap : 0;
      };
      const setDots = () => {
        if (!dots) return;
        const active = (((position - visible) % total) + total) % total;
        Array.from(dots.children).forEach((dot, index) => dot.classList.toggle("active", index === active));
      };
      const render = (animate: boolean) => {
        track.style.transition = animate ? "transform .55s cubic-bezier(.5,.1,.2,1)" : "none";
        track.style.transform = `translateX(${-position * step()}px)`;
        setDots();
      };
      const build = () => {
        head.forEach((clone) => clone.remove());
        tail.forEach((clone) => clone.remove());
        head = [];
        tail = [];
        visible = perView();
        for (let index = 0; index < visible; index += 1) {
          const clone = originals[index % total].cloneNode(true) as HTMLElement;
          clone.setAttribute("aria-hidden", "true");
          track.appendChild(clone);
          tail.push(clone);
        }
        for (let index = 0; index < visible; index += 1) {
          const clone = originals[(total - 1 - index + total) % total].cloneNode(true) as HTMLElement;
          clone.setAttribute("aria-hidden", "true");
          track.insertBefore(clone, track.firstChild);
          head.push(clone);
        }
        position = visible;
        render(false);
      };
      const go = (direction: number) => {
        if (animating) return;
        animating = true;
        position += direction;
        render(true);
        window.setTimeout(() => {
          if (position >= total + visible) {
            position = visible;
            render(false);
          } else if (position < visible) {
            position += total;
            render(false);
          }
          animating = false;
        }, 570);
      };

      dots?.replaceChildren();
      if (dots) {
        originals.forEach((_, index) => {
          const button = document.createElement("button");
          button.type = "button";
          button.setAttribute("aria-label", `Ir al elemento ${index + 1}`);
          button.addEventListener("click", () => {
            if (animating) return;
            position = visible + index;
            render(true);
          });
          dots.appendChild(button);
        });
      }

      const arrowListeners: Array<[Element, EventListener]> = [];
      carousel.querySelectorAll<HTMLElement>(".carousel-arrow").forEach((arrow) => {
        const listener = () => go(Number.parseInt(arrow.dataset.dir || "1", 10));
        arrow.addEventListener("click", listener);
        arrowListeners.push([arrow, listener]);
      });

      let touchStart: number | null = null;
      const onTouchStart = (event: TouchEvent) => {
        touchStart = event.touches[0]?.clientX ?? null;
      };
      const onTouchEnd = (event: TouchEvent) => {
        if (touchStart === null) return;
        const distance = (event.changedTouches[0]?.clientX ?? touchStart) - touchStart;
        touchStart = null;
        if (Math.abs(distance) > 45) go(distance < 0 ? 1 : -1);
      };
      const onResize = () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(build, 200);
      };
      track.addEventListener("touchstart", onTouchStart, { passive: true });
      track.addEventListener("touchend", onTouchEnd, { passive: true });
      window.addEventListener("resize", onResize);
      build();

      cleanups.push(() => {
        window.clearTimeout(resizeTimer);
        window.removeEventListener("resize", onResize);
        track.removeEventListener("touchstart", onTouchStart);
        track.removeEventListener("touchend", onTouchEnd);
        arrowListeners.forEach(([arrow, listener]) => arrow.removeEventListener("click", listener));
        head.forEach((clone) => clone.remove());
        tail.forEach((clone) => clone.remove());
        dots?.replaceChildren();
        track.style.removeProperty("transition");
        track.style.removeProperty("transform");
      });
    });

    const folders = Array.from(root.querySelectorAll<HTMLDetailsElement>("details.carpeta"));
    folders.forEach((folder) => {
      const onToggle = () => {
        if (!folder.open) return;
        folders.forEach((other) => {
          if (other !== folder) other.open = false;
        });
        window.setTimeout(() => {
          const top = folder.getBoundingClientRect().top + window.scrollY - 120;
          window.scrollTo({ top, behavior: "smooth" });
        }, 130);
      };
      folder.addEventListener("toggle", onToggle);
      cleanups.push(() => folder.removeEventListener("toggle", onToggle));
    });

    root.querySelectorAll<HTMLElement>("[data-fqc]").forEach((button) => {
      const onClick = () => {
        const carousel = root.querySelector<HTMLElement>("#fqc");
        const card = carousel?.querySelector<HTMLElement>(".fq");
        if (!carousel || !card) return;
        carousel.scrollBy({
          left: (card.getBoundingClientRect().width + 12) * Number.parseInt(button.dataset.fqc || "1", 10),
          behavior: "smooth",
        });
      };
      button.addEventListener("click", onClick);
      cleanups.push(() => button.removeEventListener("click", onClick));
    });

    return () => cleanups.reverse().forEach((cleanup) => cleanup());
  }, [pageKey]);

  return null;
}
