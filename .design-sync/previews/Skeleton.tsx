import * as React from "react";
import { Skeleton } from "forgotten-letters";

const stage: React.CSSProperties = {
  background: "var(--color-bg)",
  padding: 28,
  borderRadius: 6,
  fontFamily: "var(--font-body)",
};

// Skeleton's appearance (animate-pulse, bg-elevated, radius) comes from its own
// classes; size is caller-supplied. Use inline styles so previews don't depend
// on utility classes that may not be in the app's compiled CSS.
export function Lines() {
  return (
    <div style={{ ...stage, display: "flex", flexDirection: "column", gap: 12, maxWidth: 320 }}>
      <Skeleton style={{ height: 16, width: 220 }} />
      <Skeleton style={{ height: 16, width: 280 }} />
      <Skeleton style={{ height: 16, width: 180 }} />
    </div>
  );
}

export function CardLoading() {
  return (
    <div style={stage}>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <Skeleton style={{ height: 48, width: 48, borderRadius: 9999 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton style={{ height: 16, width: 160 }} />
          <Skeleton style={{ height: 12, width: 110 }} />
        </div>
      </div>
    </div>
  );
}
