import { FL } from "../../tokens/colors";

export interface BarSegment {
  pct: number;
  color: string;
}

// Stacked horizontal bar (W/D/L, faction distribution).
// Each segment carries `data-fl-bar` so the motion layer (C7) can animate its width.
export function StatBar({ segments, height = 10 }: { segments: BarSegment[]; height?: number }) {
  return (
    <div
      style={{
        display: "flex",
        height,
        borderRadius: 2,
        overflow: "hidden",
        border: `1px solid ${FL.border}`,
      }}
    >
      {segments.map((s, i) => (
        <div key={i} data-fl-bar style={{ width: `${s.pct}%`, background: s.color }} />
      ))}
    </div>
  );
}
