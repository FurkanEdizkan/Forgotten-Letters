import * as React from "react";
import { Badge } from "forgotten-letters";

const stage: React.CSSProperties = {
  background: "var(--color-bg)",
  padding: 28,
  borderRadius: 6,
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  alignItems: "center",
  fontFamily: "var(--font-body)",
};

export function Variants() {
  return (
    <div style={stage}>
      <Badge variant="default">Active</Badge>
      <Badge variant="neutral">Draft</Badge>
      <Badge variant="accent">Official</Badge>
      <Badge variant="success">Verified</Badge>
      <Badge variant="warning">In review</Badge>
    </div>
  );
}

export function AsTags() {
  return (
    <div style={stage}>
      <Badge variant="accent">Official</Badge>
      <Badge variant="neutral">4–6 Players</Badge>
      <Badge variant="default">90 min</Badge>
      <Badge variant="warning">Veteran</Badge>
    </div>
  );
}
