import { FL } from "../../tokens/colors";
import { FighterMini } from "../art/FighterMini";
import { DucatIcon, GloryIcon, HeartIcon } from "../art/Sigils";
import { Pill } from "./Pill";
import { Button } from "./Button";
import type { Warband } from "../../data/profile";

export function WarbandRow({ w }: { w: Warband }) {
  return (
    <div
      style={{
        background: FL.surface,
        border: `1px solid ${FL.border}`,
        borderRadius: 6,
        padding: 12,
        display: "grid",
        gridTemplateColumns: "52px 1fr auto",
        gap: 12,
        alignItems: "center",
      }}
    >
      <FighterMini arch={w.arch} size={52} />
      <div style={{ minWidth: 0 }}>
        <div className="fl-display" style={{ fontSize: 14, color: FL.text, fontWeight: 600, letterSpacing: "0.03em" }}>
          {w.name}
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
          <Pill tone={w.tone}>{w.faction}</Pill>
          <Pill>{w.rules}</Pill>
          {!w.isPublic && <Pill tone="warn">PRIVATE</Pill>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, fontSize: 11, color: FL.text2 }}>
          <span className="fl-mono">{w.fighters}F</span>
          <span style={{ color: FL.border }}>·</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <DucatIcon size={10} /> <span className="fl-mono" style={{ color: FL.gold }}>{w.ducats}</span>
          </span>
          <span style={{ color: FL.border }}>·</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <GloryIcon size={10} /> <span className="fl-mono" style={{ color: FL.crimson }}>{w.glory}</span>
          </span>
          <span style={{ color: FL.border }}>·</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <HeartIcon filled size={10} /> <span className="fl-mono" style={{ color: FL.crimson }}>{w.likes}</span>
          </span>
        </div>
      </div>
      <Button variant="ghost">Open →</Button>
    </div>
  );
}
