import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "forgotten-letters";

const stage: React.CSSProperties = {
  background: "var(--color-bg)",
  padding: 28,
  borderRadius: 6,
  maxWidth: 460,
  fontFamily: "var(--font-body)",
};
const body: React.CSSProperties = { fontSize: 14, color: "var(--color-muted)", margin: 0, lineHeight: 1.5 };

export function Default() {
  return (
    <div style={stage}>
      <Tabs defaultValue="briefing">
        <TabsList>
          <TabsTrigger value="briefing">Briefing</TabsTrigger>
          <TabsTrigger value="factions">Factions</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
        </TabsList>
        <TabsContent value="briefing">
          <p style={body}>
            Three factions converge on a single forged letter. Recover it before dawn without tripping the
            north-bridge checkpoint.
          </p>
        </TabsContent>
        <TabsContent value="factions">
          <p style={body}>The Cartographers, the Night Post, and the Vörä Signatory each want the letter for their own ends.</p>
        </TabsContent>
        <TabsContent value="rules">
          <p style={body}>Standard tactical ruleset. One action per operator per turn; stealth checks at every lit intersection.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
