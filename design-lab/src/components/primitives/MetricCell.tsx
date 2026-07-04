import { FL } from "../../tokens/colors";

export function MetricCell({
  icon,
  v,
  l,
  tone,
}: {
  icon?: React.ReactNode;
  v: string;
  l: string;
  tone?: string;
}) {
  const c = tone || FL.text;
  return (
    <div style={{ padding: 10, background: FL.bg, border: `1px solid ${FL.border}`, borderRadius: 3 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {icon}
        <span className="fl-display" style={{ fontSize: 17, color: c, fontWeight: 600 }}>
          {v}
        </span>
      </div>
      <div className="fl-mono" style={{ fontSize: 9, color: FL.textMuted, letterSpacing: "0.15em", marginTop: 2 }}>
        {l.toUpperCase()}
      </div>
    </div>
  );
}
