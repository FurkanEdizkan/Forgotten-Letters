import { FL } from "../../tokens/colors";
import type { Activity } from "../../data/profile";

export function Timeline({ items }: { items: Activity[] }) {
  return (
    <div style={{ position: "relative", paddingLeft: 18 }}>
      <div style={{ position: "absolute", left: 5, top: 8, bottom: 8, width: 1, background: FL.border }} />
      {items.map((a, i) => (
        <div key={i} style={{ position: "relative", paddingBottom: 14 }}>
          <span
            style={{
              position: "absolute",
              left: -18,
              top: 2,
              width: 11,
              height: 11,
              borderRadius: 6,
              background: a.c,
              border: `2px solid ${FL.bg}`,
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span className="fl-mono" style={{ fontSize: 9, color: a.c, letterSpacing: "0.2em", fontWeight: 700 }}>
              {a.k}
            </span>
            <span className="fl-mono" style={{ fontSize: 9, color: FL.textMuted, letterSpacing: "0.1em" }}>
              · {a.t.toUpperCase()}
            </span>
          </div>
          <div style={{ fontSize: 12, color: FL.text2, lineHeight: 1.4 }}>{a.body}</div>
        </div>
      ))}
    </div>
  );
}
