import * as React from "react";
import { Avatar } from "forgotten-letters";

const stage: React.CSSProperties = {
  background: "var(--color-bg)",
  padding: 28,
  borderRadius: 6,
  display: "flex",
  gap: 14,
  alignItems: "center",
  fontFamily: "var(--font-body)",
};

export function Sizes() {
  return (
    <div style={stage}>
      <Avatar name="Nightjar" size="sm" />
      <Avatar name="Vera Kane" size="md" />
      <Avatar name="Operator Seven" size="lg" />
    </div>
  );
}

export function Roster() {
  return (
    <div style={stage}>
      <Avatar name="Ada Lovelace" />
      <Avatar name="Johannes Kepler" />
      <Avatar name="Marie Curie" />
      <Avatar name="Rosalind Franklin" />
    </div>
  );
}
