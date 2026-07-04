import * as React from "react";
import { Input, Label } from "forgotten-letters";

const stage: React.CSSProperties = {
  background: "var(--color-bg)",
  padding: 28,
  borderRadius: 6,
  display: "flex",
  flexDirection: "column",
  gap: 16,
  maxWidth: 360,
  fontFamily: "var(--font-body)",
};
const field: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };

export function WithLabel() {
  return (
    <div style={stage}>
      <div style={field}>
        <Label htmlFor="callsign">Callsign</Label>
        <Input id="callsign" placeholder="e.g. Nightjar" defaultValue="Nightjar" />
      </div>
      <div style={field}>
        <Label htmlFor="email">Operator email</Label>
        <Input id="email" type="email" placeholder="operator@warroom.io" />
      </div>
    </div>
  );
}

export function States() {
  return (
    <div style={stage}>
      <div style={field}>
        <Label htmlFor="locked">Disabled</Label>
        <Input id="locked" defaultValue="Locked field" disabled />
      </div>
      <div style={field}>
        <Label htmlFor="bad">Invalid</Label>
        <Input id="bad" defaultValue="not-an-email" aria-invalid />
      </div>
    </div>
  );
}

export function Placeholder() {
  return (
    <div style={stage}>
      <Input placeholder="Search scenarios…" />
    </div>
  );
}
