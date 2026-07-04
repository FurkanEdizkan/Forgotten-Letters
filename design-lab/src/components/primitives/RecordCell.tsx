import { FL } from "../../tokens/colors";

export function RecordCell({ label, v, c }: { label: string; v: number | string; c: string }) {
  return (
    <div
      style={{
        padding: 8,
        background: FL.bg,
        border: `1px solid ${FL.border}`,
        borderTop: `2px solid ${c}`,
        borderRadius: 3,
        textAlign: "center",
      }}
    >
      <div className="fl-display" style={{ fontSize: 20, color: c, fontWeight: 600 }}>
        {v}
      </div>
      <div className="fl-mono" style={{ fontSize: 9, color: FL.textMuted, letterSpacing: "0.18em", marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}
