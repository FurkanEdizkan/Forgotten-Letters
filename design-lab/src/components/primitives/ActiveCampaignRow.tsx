import { FL } from "../../tokens/colors";
import { Button } from "./Button";
import type { ActiveCampaign } from "../../data/profile";

export function ActiveCampaignRow({ c }: { c: ActiveCampaign }) {
  return (
    <div
      style={{
        background: FL.surface,
        border: `1px solid ${FL.border}`,
        borderLeft: `3px solid ${c.tagColor}`,
        borderRadius: 6,
        padding: 14,
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 16,
        alignItems: "center",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span className="fl-display" style={{ fontSize: 14, color: FL.text, fontWeight: 600, letterSpacing: "0.03em" }}>
            {c.title}
          </span>
          <span
            className="fl-mono"
            style={{ fontSize: 9, color: c.tagColor, letterSpacing: "0.18em", padding: "2px 7px", border: `1px solid ${c.tagColor}`, borderRadius: 2 }}
          >
            {c.tag}
          </span>
        </div>
        <div className="fl-mono" style={{ fontSize: 10, color: FL.text2, letterSpacing: "0.1em", marginBottom: 8 }}>
          {c.role.toUpperCase()} · {c.wb.toUpperCase()}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, height: 3, background: FL.bg, border: `1px solid ${FL.border}`, borderRadius: 2, overflow: "hidden" }}>
            <div data-fl-bar style={{ width: `${c.progress * 100}%`, height: "100%", background: c.tagColor }} />
          </div>
          <span className="fl-mono" style={{ fontSize: 10, color: FL.text2 }}>{c.status}</span>
        </div>
      </div>
      <Button variant="gold" style={{ height: 30, fontSize: 11 }}>
        Open →
      </Button>
    </div>
  );
}
