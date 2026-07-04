import * as React from "react";
import { Button } from "forgotten-letters";

// The DS is designed for the app's dark "War Room" field; each story paints it.
const stage: React.CSSProperties = {
  background: "var(--color-bg)",
  padding: 28,
  borderRadius: 6,
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
  alignItems: "center",
  fontFamily: "var(--font-body)",
};

// Inline icon — the DS styles descendant <svg> to size-4.
const Crosshair = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <circle cx="12" cy="12" r="7" />
    <line x1="12" y1="1.5" x2="12" y2="5" />
    <line x1="12" y1="19" x2="12" y2="22.5" />
    <line x1="1.5" y1="12" x2="5" y2="12" />
    <line x1="19" y1="12" x2="22.5" y2="12" />
  </svg>
);

export function Variants() {
  return (
    <div style={stage}>
      <Button variant="primary">Deploy</Button>
      <Button variant="secondary">Save draft</Button>
      <Button variant="outline">Preview</Button>
      <Button variant="ghost">Cancel</Button>
      <Button variant="danger">Delete scenario</Button>
      <Button variant="link">View rules</Button>
    </div>
  );
}

export function Sizes() {
  return (
    <div style={stage}>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
      <Button size="icon" aria-label="Set target">
        <Crosshair />
      </Button>
    </div>
  );
}

export function WithIcon() {
  return (
    <div style={stage}>
      <Button variant="primary">
        <Crosshair />
        Deploy scenario
      </Button>
      <Button variant="outline">
        <Crosshair />
        Set objective
      </Button>
    </div>
  );
}

export function Disabled() {
  return (
    <div style={stage}>
      <Button disabled>Deploy</Button>
      <Button variant="secondary" disabled>
        Save draft
      </Button>
    </div>
  );
}
