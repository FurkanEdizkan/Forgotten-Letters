import { FL } from "../../tokens/colors";

export type Archetype =
  | "captain"
  | "assassin"
  | "sin-eater"
  | "witch"
  | "janissary"
  | "penitent"
  | "default";

// Ported from the design project Profile.jsx — stylized fighter bust portraits.
export function FighterMini({
  arch = "captain",
  size = 48,
  frame = "gold",
}: {
  arch?: Archetype;
  size?: number;
  frame?: "gold" | "border";
}) {
  const fc = frame === "gold" ? FL.brass : FL.border;
  const body = (() => {
    switch (arch) {
      case "captain":
        return (
          <>
            <path d="M30 22 Q40 10 50 22 L52 38 L28 38 Z" fill={FL.elevated} stroke={FL.borderHi} />
            <path d="M40 6 L40 14 M37 10 L43 10" stroke={FL.gold} />
          </>
        );
      case "assassin":
        return (
          <>
            <path d="M28 22 Q40 10 52 22 L52 38 L28 38 Z" fill="#0e0e10" stroke={FL.borderHi} />
            <rect x="32" y="30" width="16" height="2" fill="#000" />
          </>
        );
      case "sin-eater":
        return (
          <>
            <ellipse cx="40" cy="38" rx="18" ry="14" fill="#1a0a0a" stroke={FL.blood} />
            <circle cx="34" cy="34" r="1" fill={FL.blood} />
            <circle cx="40" cy="32" r="1.2" fill={FL.blood} />
            <circle cx="46" cy="34" r="1" fill={FL.blood} />
          </>
        );
      case "witch":
        return (
          <>
            <path d="M22 18 Q40 4 58 18 L54 50 Q40 54 26 50 Z" fill="#0e0e10" stroke={FL.borderHi} />
            <ellipse cx="40" cy="34" rx="6" ry="7" fill="#000" />
          </>
        );
      case "janissary":
        return (
          <>
            <path d="M40 8 L48 28 L32 28 Z" fill={FL.elevated} stroke={FL.gold} strokeWidth="0.6" />
            <path d="M28 28 L52 28 L54 42 L26 42 Z" fill="#1c1c20" stroke={FL.borderHi} />
          </>
        );
      case "penitent":
        return (
          <>
            <path d="M26 18 Q40 8 54 18 L52 42 Q40 46 28 42 Z" fill="#2a2620" stroke={FL.borderHi} />
            <ellipse cx="40" cy="36" rx="6" ry="7" fill="#1a1812" />
          </>
        );
      default:
        return <path d="M30 26 Q40 18 50 26 L50 40 L30 40 Z" fill={FL.elevated} stroke={FL.borderHi} />;
    }
  })();
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" style={{ display: "block" }}>
      <rect x="2" y="2" width="76" height="76" fill="#0a0a0c" stroke={fc} strokeWidth="1" />
      <path d="M10 80 Q12 56 28 50 L52 50 Q68 56 70 80" fill={FL.surface} stroke={FL.borderHi} strokeWidth="0.6" />
      {body}
    </svg>
  );
}
