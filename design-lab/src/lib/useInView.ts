import { useEffect, useRef } from "react";

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Fires `onEnter(el)` once when the element scrolls into view. Under
// reduced-motion it fires immediately (callers no-op their animation).
export function useInView<T extends HTMLElement>(
  onEnter: (el: T) => void,
  opts?: IntersectionObserverInit,
) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      onEnter(el);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            onEnter(el);
            io.unobserve(el);
          }
        }
      },
      opts ?? { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}
