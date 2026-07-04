import { FL } from "../../tokens/colors";
import { FighterMini } from "../art/FighterMini";
import type { Match } from "../../data/profile";

export function MatchRow({ m }: { m: Match }) {
  const c = m.r === "W" ? FL.success : m.r === "L" ? FL.danger : FL.warn;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "60px 1fr 1fr 90px 120px 110px",
        padding: "12px 14px",
        borderBottom: `1px solid ${FL.border}`,
        alignItems: "center",
        gap: 8,
      }}
    >
      <span
        className="fl-display"
        style={{
          width: 32,
          height: 32,
          borderRadius: 3,
          background: c,
          color: FL.bg,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        {m.r}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <FighterMini arch={m.myArch} size={28} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: FL.text, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {m.my}
          </div>
          <div className="fl-mono" style={{ fontSize: 9, color: FL.text2, letterSpacing: "0.05em" }}>
            YOU
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <FighterMini arch={m.opArch} size={28} frame="border" />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: FL.text, lineHeight: 1.2 }}>{m.op}</div>
          <div className="fl-mono" style={{ fontSize: 9, color: FL.text2 }}>@{m.opU}</div>
        </div>
      </div>
      <span className="fl-mono" style={{ fontSize: 13, color: c, fontWeight: 600 }}>
        {m.sc}
      </span>
      <span style={{ fontSize: 11, color: FL.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {m.scenario}
      </span>
      <span style={{ fontSize: 11, color: FL.text2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="fl-mono" style={{ fontSize: 10, color: FL.textMuted, letterSpacing: "0.1em" }}>
          {m.date.toUpperCase()}
        </span>
        <a href="#" style={{ color: FL.gold, fontSize: 10, textDecoration: "none" }}>↗</a>
      </span>
    </div>
  );
}
