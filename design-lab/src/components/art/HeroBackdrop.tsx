import anime from "animejs";
import { FL } from "../../tokens/colors";
import { useInView, prefersReducedMotion } from "../../lib/useInView";

// ReactBits-inspired animated hero backdrop: a faint gold trench pattern that
// drifts slowly over the blood gradient. No-ops under reduced-motion.
export function HeroBackdrop() {
  const ref = useInView<HTMLDivElement>((el) => {
    if (prefersReducedMotion()) return;
    const pattern = el.querySelector("svg");
    if (pattern) {
      anime({
        targets: pattern,
        translateX: [-40, 40],
        duration: 24000,
        direction: "alternate",
        loop: true,
        easing: "easeInOutSine",
      });
    }
  });

  return (
    <div ref={ref} className="fl-grain" style={{ opacity: 0.05, overflow: "hidden" }}>
      <svg
        style={{ position: "absolute", inset: 0, width: "120%", height: "100%", opacity: 0.5 }}
        viewBox="0 0 1440 360"
        preserveAspectRatio="xMidYMid slice"
      >
        <path
          d="M0 200 L120 200 L160 240 L300 240 L340 200 L500 200 L540 240 L700 240 L740 200 L900 200 L940 240 L1100 240 L1140 200 L1300 200 L1340 240 L1440 240 L1440 360 L0 360 Z"
          fill={FL.gold}
        />
      </svg>
    </div>
  );
}
