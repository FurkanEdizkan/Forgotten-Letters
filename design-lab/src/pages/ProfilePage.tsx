import { FL } from "../tokens/colors";
import { Pill } from "../components/primitives/Pill";
import { BadgeChip } from "../components/primitives/BadgeChip";
import { Section } from "../components/primitives/Section";
import { RecordCell } from "../components/primitives/RecordCell";
import { MetricCell } from "../components/primitives/MetricCell";
import { StatBar } from "../components/primitives/StatBar";
import { WarbandRow } from "../components/primitives/WarbandRow";
import { MatchRow } from "../components/primitives/MatchRow";
import { ActiveCampaignRow } from "../components/primitives/ActiveCampaignRow";
import { Timeline } from "../components/primitives/Timeline";
import { Button } from "../components/primitives/Button";
import { SigilNA, DucatIcon, GloryIcon } from "../components/art/Sigils";
import {
  identity,
  career,
  factionFav,
  fieldRecord,
  connections,
  warbands,
  matches,
  activeCampaigns,
  authoredScenarios,
  activity,
  campaignHistory,
  achievements,
  profileTabs,
} from "../data/profile";

const card: React.CSSProperties = { background: FL.surface, border: `1px solid ${FL.border}`, borderRadius: 6, padding: 18 };
const kicker: React.CSSProperties = { fontSize: 10, color: FL.gold, letterSpacing: "0.25em", marginBottom: 12 };

function AvatarCrest() {
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <rect x="2" y="2" width="136" height="136" fill={FL.bg} stroke={FL.brass} strokeWidth="1.5" />
      <rect x="6" y="6" width="128" height="128" fill="none" stroke={FL.brass} strokeWidth="0.5" opacity="0.5" />
      {([[6, 6], [134, 6], [6, 134], [134, 134]] as const).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill={FL.brass} />
      ))}
      <path d="M24 140 Q24 100 50 90 L90 90 Q116 100 116 140" fill={FL.surface} stroke={FL.borderHi} />
      <ellipse cx="70" cy="68" rx="22" ry="26" fill={FL.elevated} stroke={FL.borderHi} />
      <path d="M48 50 Q70 24 92 50 L92 80 L48 80 Z" fill="#26222a" stroke={FL.borderHi} />
      <rect x="56" y="62" width="28" height="3" fill="#000" />
      <path d="M70 14 L70 30 M66 22 L74 22" stroke={FL.gold} />
      <text x="70" y="100" textAnchor="middle" fill={FL.gold} fontFamily="Cinzel" fontSize="11" fontWeight="600" letterSpacing="2">
        VC
      </text>
    </svg>
  );
}

export function ProfilePage() {
  return (
    <div className="fl" style={{ background: FL.bg }}>
      {/* HERO */}
      <header
        style={{
          position: "relative",
          background: "linear-gradient(180deg, #1a0a08 0%, #0c0c0e 100%)",
          borderBottom: `1px solid ${FL.border}`,
          overflow: "hidden",
        }}
      >
        <div className="fl-grain" />
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.06 }} viewBox="0 0 1440 360" preserveAspectRatio="xMidYMid slice">
          <path
            d="M0 200 L120 200 L160 240 L300 240 L340 200 L500 200 L540 240 L700 240 L740 200 L900 200 L940 240 L1100 240 L1140 200 L1300 200 L1340 240 L1440 240 L1440 360 L0 360 Z"
            fill={FL.gold}
          />
        </svg>

        <div style={{ position: "relative", padding: "36px 32px 28px", display: "grid", gridTemplateColumns: "140px 1fr auto", gap: 28, alignItems: "center", maxWidth: 1440, margin: "0 auto" }}>
          <div style={{ position: "relative", width: 140, height: 140 }}>
            <AvatarCrest />
          </div>

          <div style={{ minWidth: 0 }}>
            <div className="fl-mono" style={{ fontSize: 10, color: FL.gold, letterSpacing: "0.3em", marginBottom: 6 }}>
              {identity.role}
            </div>
            <h1 data-hero-name className="fl-display" style={{ fontSize: 38, color: FL.text, margin: 0, letterSpacing: "0.03em", fontWeight: 600 }}>
              {identity.name}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
              <span className="fl-mono" style={{ fontSize: 12, color: FL.text2, letterSpacing: "0.1em" }}>{identity.handle}</span>
              <span style={{ color: FL.border }}>·</span>
              <span style={{ fontSize: 12, color: FL.text2 }}>{identity.location}</span>
              <span style={{ color: FL.border }}>·</span>
              <span style={{ fontSize: 12, color: FL.text2 }}>Joined <span style={{ color: FL.text }}>{identity.joined}</span></span>
              <Pill tone="gold">★ VETERAN</Pill>
              <Pill tone="success">○ ONLINE</Pill>
            </div>
            <p style={{ marginTop: 12, fontSize: 13, color: FL.text2, lineHeight: 1.6, maxWidth: 720 }}>{identity.tagline}</p>
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              {identity.badges.map((b) => (
                <BadgeChip key={b.label} icon={b.icon} label={b.label} sub={b.sub} tone={b.tone as "gold" | undefined} />
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <Button variant="secondary">Message</Button>
              <Button variant="secondary">Challenge ⚔</Button>
              <Button variant="primary">+ Follow</Button>
            </div>
            <div style={{ display: "flex", gap: 24, padding: "8px 14px", background: "rgba(26,26,31,0.6)", border: `1px solid ${FL.border}`, borderRadius: 4 }}>
              <div style={{ textAlign: "center" }}>
                <div data-count={identity.followers} className="fl-display" style={{ fontSize: 17, color: FL.text, fontWeight: 600 }}>{identity.followers}</div>
                <div className="fl-mono" style={{ fontSize: 9, color: FL.textMuted, letterSpacing: "0.18em" }}>FOLLOWERS</div>
              </div>
              <div style={{ width: 1, background: FL.border }} />
              <div style={{ textAlign: "center" }}>
                <div className="fl-display" style={{ fontSize: 17, color: FL.text, fontWeight: 600 }}>{identity.following}</div>
                <div className="fl-mono" style={{ fontSize: 9, color: FL.textMuted, letterSpacing: "0.18em" }}>FOLLOWING</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ position: "relative", padding: "0 32px", borderTop: `1px solid ${FL.border}`, display: "flex", gap: 0, maxWidth: 1440, margin: "0 auto" }}>
          {profileTabs.map(([t, a, c]) => (
            <button
              key={t}
              className="fl-mono"
              style={{
                padding: "14px 18px",
                background: "transparent",
                border: "none",
                borderBottom: `2px solid ${a ? FL.gold : "transparent"}`,
                color: a ? FL.text : FL.text2,
                fontSize: 12,
                letterSpacing: "0.15em",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {t.toUpperCase()}
              {c !== null && <span className="fl-mono" style={{ fontSize: 10, color: a ? FL.gold : FL.textMuted }}>{c}</span>}
            </button>
          ))}
        </div>
      </header>

      {/* BODY */}
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr 320px", maxWidth: 1440, margin: "0 auto" }}>
        {/* LEFT */}
        <aside style={{ borderRight: `1px solid ${FL.border}`, padding: 24 }}>
          <section style={{ ...card, borderTop: `3px solid ${FL.gold}`, marginBottom: 18 }}>
            <div className="fl-mono" style={kicker}>CAREER · RANKED MATCHES</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
              <span className="fl-display" style={{ fontSize: 44, color: FL.gold, fontWeight: 600, lineHeight: 1 }}>
                <span data-count={career.winRate} data-count-suffix="">{career.winRate}</span>
                <span style={{ fontSize: 22, color: FL.text2 }}>%</span>
              </span>
              <span className="fl-mono" style={{ fontSize: 11, color: FL.success, marginLeft: 6 }}>▲ {career.delta} PTS</span>
            </div>
            <div className="fl-mono" style={{ fontSize: 10, color: FL.textMuted, letterSpacing: "0.18em", marginBottom: 14 }}>
              WIN RATE · {career.played} MATCHES PLAYED
            </div>
            <div style={{ marginBottom: 8 }}>
              <StatBar segments={career.wdl} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 18 }}>
              <RecordCell label="WINS" v={career.wins} c={FL.success} />
              <RecordCell label="DRAWS" v={career.draws} c={FL.warn} />
              <RecordCell label="LOSSES" v={career.losses} c={FL.danger} />
            </div>
            <div className="fl-mono" style={{ fontSize: 10, color: FL.gold, letterSpacing: "0.18em", marginBottom: 6 }}>LAST 10 MATCHES</div>
            <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
              {career.last10.map((r, i) => {
                const c = r === "W" ? FL.success : r === "D" ? FL.warn : FL.danger;
                return (
                  <span key={i} className="fl-mono" style={{ flex: 1, height: 22, background: c, color: FL.bg, fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 2 }}>
                    {r}
                  </span>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: FL.text2 }}>
              <span>Current streak: <span className="fl-display" style={{ color: FL.success, fontWeight: 600 }}>{career.streak}</span></span>
              <span>Best: <span className="fl-display" style={{ color: FL.gold, fontWeight: 600 }}>{career.best}</span></span>
            </div>
          </section>

          <section style={{ ...card, borderTop: `3px solid ${FL.brass}`, marginBottom: 18 }}>
            <div className="fl-mono" style={kicker}>FAVORITE FACTION</div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
              <div style={{ width: 56, height: 56, background: FL.bg, border: `1px solid ${FL.brass}`, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <SigilNA size={42} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="fl-display" style={{ fontSize: 16, color: FL.text, fontWeight: 600, letterSpacing: "0.03em" }}>{factionFav.name}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <Pill tone="gold">FAITHFUL</Pill>
                  <Pill>{factionFav.games} GAMES</Pill>
                </div>
              </div>
            </div>
            <div className="fl-mono" style={{ fontSize: 10, color: FL.gold, letterSpacing: "0.18em", marginBottom: 6 }}>BY FACTION PLAYED</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {factionFav.distribution.map((f) => (
                <div key={f.name} style={{ display: "grid", gridTemplateColumns: "100px 1fr 30px", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: FL.text2 }}>{f.name}</span>
                  <div style={{ height: 5, background: FL.bg, border: `1px solid ${FL.border}`, borderRadius: 1, overflow: "hidden" }}>
                    <div data-fl-bar style={{ width: `${f.pct}%`, height: "100%", background: f.color }} />
                  </div>
                  <span className="fl-mono" style={{ fontSize: 10, color: FL.gold, textAlign: "right" }}>{f.count}</span>
                </div>
              ))}
            </div>
          </section>

          <section style={{ ...card, marginBottom: 18 }}>
            <div className="fl-mono" style={kicker}>FIELD RECORD</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {fieldRecord.map((m) => (
                <MetricCell
                  key={m.l}
                  v={m.v}
                  l={m.l}
                  tone={m.tone}
                  icon={m.kind === "ducat" ? <DucatIcon size={14} /> : m.kind === "glory" ? <GloryIcon size={14} /> : undefined}
                />
              ))}
            </div>
          </section>

          <section style={card}>
            <div className="fl-mono" style={kicker}>CONNECTIONS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {connections.map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${FL.border}`, fontSize: 12 }}>
                  <span style={{ color: FL.text2 }}>{k}</span>
                  <span style={{ color: FL.gold }}>{v}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>

        {/* CENTER */}
        <main style={{ padding: 28, minWidth: 0 }}>
          <Section title="Created warbands" kicker="4 ACTIVE" cta="See all →">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {warbands.map((w) => (
                <WarbandRow key={w.name} w={w} />
              ))}
            </div>
          </Section>

          <Section title="Match history" kicker="38 MATCHES · 24W 5D 9L" cta="Full history →">
            <div style={{ background: FL.surface, border: `1px solid ${FL.border}`, borderRadius: 6, overflow: "hidden" }}>
              <div className="fl-mono" style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr 90px 120px 110px", padding: "10px 14px", background: FL.elevated, borderBottom: `1px solid ${FL.border}`, fontSize: 9, color: FL.gold, letterSpacing: "0.18em", fontWeight: 600 }}>
                <span>RESULT</span><span>YOUR WARBAND</span><span>OPPONENT</span><span>SCORE</span><span>SCENARIO</span><span>DATE</span>
              </div>
              {matches.map((m, i) => (
                <MatchRow key={i} m={m} />
              ))}
            </div>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", fontSize: 11, color: FL.textMuted }}>
              <span className="fl-mono" style={{ letterSpacing: "0.15em" }}>SHOWING 7 OF 38</span>
              <a href="#" className="fl-mono" style={{ color: FL.gold, textDecoration: "none", letterSpacing: "0.1em" }}>EXPAND →</a>
            </div>
          </Section>

          <Section title="Active campaigns" kicker="3 RUNNING · 4 ARCHIVED" cta="Campaign archive →">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {activeCampaigns.map((c) => (
                <ActiveCampaignRow key={c.title} c={c} />
              ))}
            </div>
          </Section>

          <Section title="Authored scenarios" kicker="12 PUBLISHED · 3 FEATURED" cta="See all →">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {authoredScenarios.map((s) => (
                <div
                  key={s.title}
                  style={{
                    background: FL.surface,
                    border: `1px solid ${s.featured ? FL.brass : FL.border}`,
                    borderLeft: s.featured ? `3px solid ${FL.gold}` : `1px solid ${FL.border}`,
                    borderRadius: 6,
                    padding: 14,
                  }}
                >
                  {s.featured && <Pill tone="gold">★ FEATURED</Pill>}
                  <div className="fl-display" style={{ fontSize: 14, color: FL.text, fontWeight: 600, marginTop: s.featured ? 8 : 0, letterSpacing: "0.03em" }}>{s.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, fontSize: 11, color: FL.text2 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ color: FL.gold }}>▲</span> {s.votes}</span>
                    <span>💬 {s.comments}</span>
                    <Pill>{s.tag}</Pill>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </main>

        {/* RIGHT */}
        <aside style={{ borderLeft: `1px solid ${FL.border}`, padding: 24 }}>
          <section style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div className="fl-mono" style={{ fontSize: 10, color: FL.gold, letterSpacing: "0.25em" }}>RECENT ACTIVITY</div>
              <a href="#" style={{ fontSize: 11, color: FL.text2, textDecoration: "none" }}>All →</a>
            </div>
            <Timeline items={activity} />
          </section>

          <section style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div className="fl-mono" style={{ fontSize: 10, color: FL.gold, letterSpacing: "0.25em" }}>CAMPAIGN HISTORY</div>
              <a href="#" style={{ fontSize: 11, color: FL.text2, textDecoration: "none" }}>Archive →</a>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {campaignHistory.map((h) => {
                const bar = h.tone === "gold" ? FL.gold : h.tone === "success" ? FL.success : h.tone === "danger" ? FL.danger : FL.warn;
                const pillTone = h.tone === "gold" ? "gold" : h.tone === "success" ? "success" : h.tone === "danger" ? "blood" : "warn";
                return (
                  <div key={h.name} style={{ padding: 10, background: FL.surface, border: `1px solid ${FL.border}`, borderLeft: `3px solid ${bar}`, borderRadius: 3 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span className="fl-display" style={{ fontSize: 12, color: FL.text, fontWeight: 600 }}>{h.name}</span>
                      <Pill tone={pillTone}>{h.out}</Pill>
                    </div>
                    <div className="fl-mono" style={{ fontSize: 9, color: FL.textMuted, letterSpacing: "0.12em", display: "flex", justifyContent: "space-between" }}>
                      <span>{h.sub.toUpperCase()}</span>
                      <span style={{ color: FL.crimson }}>{h.glory}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div className="fl-mono" style={{ fontSize: 10, color: FL.gold, letterSpacing: "0.25em" }}>ACHIEVEMENTS · 24 / 60</div>
              <a href="#" style={{ fontSize: 11, color: FL.text2, textDecoration: "none" }}>All →</a>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
              {achievements.map(([icon, tone], i) => (
                <div
                  key={i}
                  title={`Achievement ${i + 1}`}
                  style={{
                    aspectRatio: "1",
                    background: FL.surface,
                    border: `1px solid ${tone === "gold" ? FL.brass : FL.border}`,
                    borderRadius: 3,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: tone === "gold" ? FL.gold : tone === "muted" ? FL.textMuted : FL.text2,
                    fontSize: 18,
                    opacity: tone === "muted" ? 0.4 : 1,
                  }}
                >
                  {icon}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
