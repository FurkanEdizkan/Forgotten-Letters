import { FL } from "../../tokens/colors";

// Brand mark — envelope/wax-seal sigil (Forgotten Letters wordmark).
export function FLMark({ size = 28, glow = false }: { size?: number; glow?: boolean }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        style={{ filter: glow ? `drop-shadow(0 0 8px ${FL.blood}66)` : "none" }}
      >
        <circle cx="20" cy="20" r="18" fill="none" stroke={FL.gold} strokeWidth="0.8" />
        <circle cx="20" cy="20" r="15" fill={FL.elevated} stroke={FL.border} strokeWidth="0.6" />
        <path d="M11 16 L20 22 L29 16 L29 26 L11 26 Z" fill="none" stroke={FL.gold} strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M11 16 L29 16 L20 22 Z" fill={FL.blood} fillOpacity="0.8" />
        <line x1="20" y1="2" x2="20" y2="5" stroke={FL.gold} strokeWidth="0.8" />
        <line x1="20" y1="35" x2="20" y2="38" stroke={FL.gold} strokeWidth="0.8" />
        <line x1="2" y1="20" x2="5" y2="20" stroke={FL.gold} strokeWidth="0.8" />
        <line x1="35" y1="20" x2="38" y2="20" stroke={FL.gold} strokeWidth="0.8" />
      </svg>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <span className="fl-display" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.18em", color: FL.text }}>
          FORGOTTEN
        </span>
        <span className="fl-display" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.18em", color: FL.gold, marginTop: 2 }}>
          LETTERS
        </span>
      </div>
    </div>
  );
}

export function Avatar({ size = 32, initials = "VC", tone = "gold" }: { size?: number; initials?: string; tone?: "gold" | "default" }) {
  const bg = tone === "gold" ? FL.brass : FL.elevated;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        color: FL.text,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.38,
        fontWeight: 600,
        letterSpacing: "0.05em",
        border: `1px solid ${FL.border}`,
        fontFamily: FL.display,
      }}
    >
      {initials}
    </div>
  );
}

export const chromeBtn = {
  primary: {
    height: 36,
    padding: "0 16px",
    borderRadius: 6,
    background: FL.blood,
    color: FL.text,
    border: "none",
    fontSize: 13,
    fontWeight: 500,
    letterSpacing: "0.03em",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  } as React.CSSProperties,
  ghost: {
    height: 36,
    padding: "0 14px",
    borderRadius: 6,
    background: "transparent",
    color: FL.text2,
    border: "none",
    fontSize: 13,
    fontWeight: 500,
    letterSpacing: "0.03em",
  } as React.CSSProperties,
  icon: {
    position: "relative",
    width: 36,
    height: 36,
    borderRadius: 6,
    background: "transparent",
    border: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  } as React.CSSProperties,
};
