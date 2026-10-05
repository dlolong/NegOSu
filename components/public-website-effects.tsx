"use client";

import { useEffect, useRef } from "react";

/** Progressive enhancement: content stays visible without JavaScript or motion. */
export function PublicWebsiteEffects() {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const root = marker.current?.parentElement;
    const header = root?.querySelector<HTMLElement>("#public-shop-header");
    if (!root || !header) return;
    const updateShadow = () => { header.dataset.scrolled = String(window.scrollY > 8); };
    const updateOffset = () => { root.style.setProperty("--public-header-offset", `${header.getBoundingClientRect().height + 16}px`); };
    updateShadow();
    updateOffset();
    window.addEventListener("scroll", updateShadow, { passive: true });
    const resize = new ResizeObserver(updateOffset);
    resize.observe(header);

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sections = root.querySelectorAll<HTMLElement>("[data-public-reveal], [data-public-sections] > section");
    const seen = new Set<Element>();
    const animations = new Set<Animation>();
    let observer: IntersectionObserver | undefined;
    function configureReveals() {
      observer?.disconnect();
      animations.forEach(animation => animation.cancel());
      animations.clear();
      if (motion.matches || !("IntersectionObserver" in window)) return;
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting || seen.has(entry.target)) continue;
          seen.add(entry.target);
          observer?.unobserve(entry.target);
          // Anchor navigation and keyboard focus should land on fully visible content.
          if (entry.target.id === window.location.hash.slice(1) || entry.target.contains(document.activeElement)) continue;
          const animation = entry.target.animate([
            { opacity: 0, transform: "translateY(16px)" },
            { opacity: 1, transform: "translateY(0)" },
          ], { duration: 450, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" });
          animations.add(animation);
          animation.onfinish = () => animations.delete(animation);
        }
      }, { threshold: 0, rootMargin: "0px 0px -24px 0px" });
      sections.forEach(section => { if (!seen.has(section)) observer?.observe(section); });
    }
    configureReveals();
    motion.addEventListener("change", configureReveals);
    return () => {
      window.removeEventListener("scroll", updateShadow);
      resize.disconnect();
      observer?.disconnect();
      animations.forEach(animation => animation.cancel());
      motion.removeEventListener("change", configureReveals);
      root.style.removeProperty("--public-header-offset");
      delete header.dataset.scrolled;
    };
  }, []);
  return <span ref={marker} hidden aria-hidden="true"/>;
}
