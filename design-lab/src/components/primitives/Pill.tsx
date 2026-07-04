import { FL } from "../../tokens/colors";

export type PillTone = "default" | "gold" | "blood" | "success" | "warn" | "info";

const tones: Record<PillTone, { bg: string; fg: string; bd: string }> = {
  default: { bg: FL.elevated, fg: FL.text2, bd: FL.border },
  gold: { bg: "rgba(184,146,63,0.12)", fg: FL.gold, bd: FL.brass },
  blood: { bg: "rgba(139,26,26,0.18)", fg: "#E5887B", bd: FL.blood },
  success: { bg: "rgba(45,107,79,0.18)", fg: "#7CC9A1", bd: FL.success },
  warn: { bg: "rgba(184,134,11,0.18)", fg: "#E2BD5A", bd: FL.warn },
  info: { bg: "rgba(74,111,165,0.18)", fg: "#94B0DE", bd: FL.info },
};

export function Pill({ children, tone = "default" }: { children: React.ReactNode; tone?: PillTone }) {
  const t = tones[tone];
  return (
    <span
      className="fl-mono"
      style={{
        fontSize: 9,
        padding: "3px 7px",
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.bd}`,
        borderRadius: 3,
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
