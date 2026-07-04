import * as React from "react";
import { Textarea, Label } from "forgotten-letters";

const stage: React.CSSProperties = {
  background: "var(--color-bg)",
  padding: 28,
  borderRadius: 6,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  maxWidth: 420,
  fontFamily: "var(--font-body)",
};

export function WithLabel() {
  return (
    <div style={stage}>
      <Label htmlFor="brief">Mission briefing</Label>
      <Textarea
        id="brief"
        rows={4}
        defaultValue={"Intercept the courier at the north bridge before 02:00.\nAvoid the checkpoint on Vörä street — it is watched after midnight."}
      />
    </div>
  );
}

export function Placeholder() {
  return (
    <div style={stage}>
      <Textarea placeholder="Describe the scenario objective…" rows={4} />
    </div>
  );
}

export function Disabled() {
  return (
    <div style={stage}>
      <Textarea defaultValue="Locked after the scenario is published." disabled rows={3} />
    </div>
  );
}
