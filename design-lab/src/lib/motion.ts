import anime from "animejs";
import { prefersReducedMotion } from "./useInView";

// Staggered fade/rise for a group of elements (a block's children).
export function reveal(targets: HTMLElement | HTMLCollection | HTMLElement[]) {
  if (prefersReducedMotion()) return;
  anime({
    targets,
    opacity: [0, 1],
    translateY: [16, 0],
    duration: 600,
    delay: anime.stagger(70),
    easing: "easeOutQuart",
  });
}

// Count a number up to its target. Writes the final value immediately under
// reduced-motion so the figure is never left at 0.
export function countUp(el: HTMLElement, to: number, suffix = "") {
  if (prefersReducedMotion()) {
    el.textContent = `${to}${suffix}`;
    return;
  }
  const obj = { v: 0 };
  anime({
    targets: obj,
    v: to,
    duration: 1200,
    easing: "easeOutExpo",
    round: 1,
    update: () => {
      el.textContent = `${Math.round(obj.v)}${suffix}`;
    },
  });
}

// Animate every [data-fl-bar] inside `container` from 0 to its set width.
export function barFill(container: HTMLElement) {
  if (prefersReducedMotion()) return;
  const bars = container.querySelectorAll<HTMLElement>("[data-fl-bar]");
  bars.forEach((b) => {
    const target = b.style.width || "0%";
    b.style.width = "0%";
    anime({ targets: b, width: target, duration: 900, easing: "easeOutQuart", delay: 150 });
  });
}

// Split an element's text into per-character spans and stagger-reveal them.
export function splitReveal(el: HTMLElement) {
  if (prefersReducedMotion()) return;
  const text = el.textContent ?? "";
  el.textContent = "";
  const frag = document.createDocumentFragment();
  for (const ch of text) {
    const span = document.createElement("span");
    span.textContent = ch;
    span.style.display = "inline-block";
    span.style.whiteSpace = "pre";
    span.style.opacity = "0";
    frag.appendChild(span);
  }
  el.appendChild(frag);
  anime({
    targets: el.children,
    opacity: [0, 1],
    translateY: [22, 0],
    duration: 700,
    delay: anime.stagger(28),
    easing: "easeOutExpo",
  });
}
