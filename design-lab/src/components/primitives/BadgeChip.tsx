import { FL } from "../../tokens/colors";

export function BadgeChip({
  icon,
  label,
  sub,
  tone,
}: {
  icon: string;
  label: string;
  sub?: string;
  tone?: "gold";
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        background: FL.surface,
        border: `1px solid ${tone === "gold" ? FL.brass : FL.border}`,
        borderRadius: 4,
      }}
    >
      <span style={{ fontSize: 14, color: tone === "gold" ? FL.gold : FL.text2 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 11, color: tone === "gold" ? FL.gold : FL.text, fontFamily: FL.display, fontWeight: 600 }}>
          {label}
        </div>
        {sub && (
          <div className="fl-mono" style={{ fontSize: 9, color: FL.textMuted, letterSpacing: "0.1em", marginTop: 1 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}
