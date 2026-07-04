import * as React from "react";
import { Label, Input } from "forgotten-letters";

const stage: React.CSSProperties = {
  background: "var(--color-bg)",
  padding: 28,
  borderRadius: 6,
  display: "flex",
  flexDirection: "column",
  gap: 6,
  maxWidth: 360,
  fontFamily: "var(--font-body)",
};

// Label is a leaf that reads best in its real context — attached to a field.
export function FieldLabel() {
  return (
    <div style={stage}>
      <Label htmlFor="scenario-name">Scenario name</Label>
      <Input id="scenario-name" defaultValue="The Vörä Correspondence" />
    </div>
  );
}

export function Standalone() {
  return (
    <div style={{ ...stage, gap: 12 }}>
      <Label>Objective</Label>
      <Label>Faction alignment</Label>
      <Label>Estimated duration</Label>
    </div>
  );
}
