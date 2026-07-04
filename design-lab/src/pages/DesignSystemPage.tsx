import { FL } from "../tokens/colors";
import { Section } from "../components/primitives/Section";
import { Button } from "../components/primitives/Button";
import { Pill, type PillTone } from "../components/primitives/Pill";
import { BadgeChip } from "../components/primitives/BadgeChip";
import { StatBar } from "../components/primitives/StatBar";
import { RecordCell } from "../components/primitives/RecordCell";
import { MetricCell } from "../components/primitives/MetricCell";
import { FighterMini, type Archetype } from "../components/art/FighterMini";
import { SigilNA, DucatIcon, GloryIcon, HeartIcon } from "../components/art/Sigils";
import { Icons, type IconName } from "../components/art/icons";

const colorGroups: { title: string; keys: (keyof typeof FL)[] }[] = [
  { title: "Surface", keys: ["bg", "surface", "elevated", "border", "borderHi"] },
  { title: "Ink", keys: ["text", "text2", "textMuted"] },
  { title: "Accent", keys: ["blood", "crimson", "gold", "brass"] },
  { title: "Status", keys: ["success", "warn", "danger", "info"] },
];

const pillTones: PillTone[] = ["default", "gold", "blood", "success", "warn", "info"];
const archetypes: Archetype[] = ["captain", "assassin", "sin-eater", "witch", "janissary", "penitent"];

function Swatch({ name, value }: { name: string; value: string }) {
  return (
    <div style={{ border: `1px solid ${FL.border}`, borderRadius: 6, overflow: "hidden", background: FL.surface }}>
      <div style={{ height: 56, background: value }} />
      <div style={{ padding: "8px 10px" }}>
        <div style={{ fontSize: 12, color: FL.text }}>{name}</div>
        <div className="fl-mono" style={{ fontSize: 10, color: FL.textMuted, letterSpacing: "0.05em", marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}

export function DesignSystemPage() {
  return (
    <div className="fl" style={{ background: FL.bg, padding: "40px 32px", maxWidth: 1200, margin: "0 auto" }}>
      <div className="fl-mono" style={{ fontSize: 10, color: FL.gold, letterSpacing: "0.3em", marginBottom: 6 }}>THE WAR ROOM · GRIMDARK SYSTEM</div>
      <h1 className="fl-display" style={{ fontSize: 34, color: FL.text, margin: "0 0 32px", letterSpacing: "0.03em", fontWeight: 700 }}>
        Forgotten Letters — Design System
      </h1>

      <Section title="Color" kicker="OKLCH-DERIVED PALETTE">
        {colorGroups.map((g) => (
          <div key={g.title} style={{ marginBottom: 18 }}>
            <div className="fl-mono" style={{ fontSize: 10, color: FL.text2, letterSpacing: "0.18em", marginBottom: 8 }}>{g.title.toUpperCase()}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
              {g.keys.map((k) => (
                <Swatch key={k} name={k} value={FL[k]} />
              ))}
            </div>
          </div>
        ))}
      </Section>

      <Section title="Typography" kicker="CINZEL · INTER · JETBRAINS MONO">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="fl-display" style={{ fontSize: 40, color: FL.text, fontWeight: 700 }}>Vespers at Argonne</div>
          <div className="fl-display" style={{ fontSize: 24, color: FL.text, fontWeight: 600 }}>Cinzel — display / headings</div>
          <div style={{ fontSize: 15, color: FL.text2, lineHeight: 1.6, maxWidth: 640 }}>
            Inter — body copy. Painter of small men. Forty years of slow campaigns. Scenarios lean toward sieges and bad weather.
          </div>
          <div className="fl-mono" style={{ fontSize: 12, color: FL.gold, letterSpacing: "0.15em" }}>JETBRAINS MONO · LABELS · 03 — 01 · CATHEDRAL OF SALT</div>
        </div>
      </Section>

      <Section title="Buttons">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button variant="primary">Deploy</Button>
          <Button variant="secondary">Message</Button>
          <Button variant="gold">Open →</Button>
          <Button variant="ghost">Cancel</Button>
        </div>
      </Section>

      <Section title="Pills & badges">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {pillTones.map((t) => (
            <Pill key={t} tone={t}>{t}</Pill>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <BadgeChip icon="✦" label="Featured author" sub="3 scenarios" tone="gold" />
          <BadgeChip icon="⛨" label="Campaign winner" sub="Salt Road" />
        </div>
      </Section>

      <Section title="Stat cells & bars">
        <div style={{ maxWidth: 360, marginBottom: 14 }}>
          <StatBar segments={[{ pct: 63.2, color: FL.success }, { pct: 13.2, color: FL.warn }, { pct: 23.6, color: FL.danger }]} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 120px)", gap: 8, marginBottom: 14 }}>
          <RecordCell label="WINS" v={24} c={FL.success} />
          <RecordCell label="DRAWS" v={5} c={FL.warn} />
          <RecordCell label="LOSSES" v={9} c={FL.danger} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 160px)", gap: 8 }}>
          <MetricCell icon={<DucatIcon size={14} />} v="42,180" l="Ducats" />
          <MetricCell icon={<GloryIcon size={14} />} v="124" l="Glory" tone={FL.crimson} />
          <MetricCell v="38" l="Matches" />
          <MetricCell v="7" l="Campaigns" tone={FL.gold} />
        </div>
      </Section>

      <Section title="SVG art">
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
          {archetypes.map((a) => (
            <div key={a} style={{ textAlign: "center" }}>
              <FighterMini arch={a} size={56} />
              <div className="fl-mono" style={{ fontSize: 9, color: FL.textMuted, marginTop: 6, letterSpacing: "0.1em" }}>{a.toUpperCase()}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <SigilNA size={48} />
          <DucatIcon size={20} />
          <GloryIcon size={20} />
          <HeartIcon size={20} filled />
        </div>
      </Section>

      <Section title="Icons">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 10 }}>
          {(Object.keys(Icons) as IconName[]).map((name) => (
            <div key={name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: 10, border: `1px solid ${FL.border}`, borderRadius: 6, color: FL.text2 }}>
              {Icons[name]({ size: 18, color: FL.text })}
              <span className="fl-mono" style={{ fontSize: 8, color: FL.textMuted }}>{name}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
