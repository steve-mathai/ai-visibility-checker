"use client";

import { useEffect } from "react";

/**
 * Section entrances. Every [data-section] gets a data-in attribute the first
 * time it nears the viewport; the CSS staggers its [data-reveal] children.
 * The hidden start state exists only when the inline script has set [data-js]
 * and the visitor has not asked for reduced motion. Without observer support
 * everything is revealed straight away.
 */
export function Motion() {
  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>("[data-section]");

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === "undefined") {
      sections.forEach((el) => el.setAttribute("data-in", ""));
    } else {
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.setAttribute("data-in", "");
            io?.unobserve(entry.target);
          }
        },
        { rootMargin: "0px 0px -12% 0px", threshold: 0 },
      );
      sections.forEach((el) => io?.observe(el));
    }

    // Links to the hero field also put the cursor in it.
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest('a[href="#check"]')) return;
      window.setTimeout(() => {
        document.getElementById("url-hero")?.focus({ preventScroll: true });
      }, 500);
    };
    document.addEventListener("click", onClick);

    return () => {
      io?.disconnect();
      document.removeEventListener("click", onClick);
    };
  }, []);

  return null;
}
