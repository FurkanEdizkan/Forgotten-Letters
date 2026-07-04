import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Badge,
} from "forgotten-letters";

const stage: React.CSSProperties = {
  background: "var(--color-bg)",
  padding: 28,
  borderRadius: 6,
  fontFamily: "var(--font-body)",
};
const muted: React.CSSProperties = { fontSize: 14, color: "var(--color-muted)", margin: 0 };

export function ScenarioCard() {
  return (
    <div style={stage}>
      <Card style={{ maxWidth: 380 }}>
        <CardHeader>
          <div style={{ display: "flex", gap: 8 }}>
            <Badge variant="accent">Official</Badge>
            <Badge variant="neutral">4–6 Players</Badge>
          </div>
          <CardTitle>The Vörä Correspondence</CardTitle>
          <CardDescription>
            A night infiltration built around intercepted letters. Three factions, one forged signature.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p style={muted}>Estimated 90 minutes · Difficulty: Veteran · 12 briefing documents.</p>
        </CardContent>
        <CardFooter>
          <Button variant="primary" size="sm">
            Open briefing
          </Button>
          <Button variant="ghost" size="sm">
            Save
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export function Interactive() {
  return (
    <div style={stage}>
      <Card interactive style={{ maxWidth: 380 }}>
        <CardHeader>
          <CardTitle>Campaign: Ashfall</CardTitle>
          <CardDescription>7 linked scenarios · updated 2 days ago</CardDescription>
        </CardHeader>
        <CardContent>
          <p style={muted}>Interactive cards lift on hover — the whole card is a link target.</p>
        </CardContent>
      </Card>
    </div>
  );
}

export function Basic() {
  return (
    <div style={stage}>
      <Card style={{ maxWidth: 380 }}>
        <CardHeader>
          <CardTitle>Objective</CardTitle>
          <CardDescription>Recover the field cipher before dawn.</CardDescription>
        </CardHeader>
        <CardContent>
          <p style={{ fontSize: 14, color: "var(--color-ink)", margin: 0 }}>
            Flat-field surface: distinguished by tonal step and border, never a drop shadow.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
