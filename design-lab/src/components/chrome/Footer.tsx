import { FL } from "../../tokens/colors";
import { Icons } from "../art/icons";
import { FLMark } from "./bits";

const cols = [
  { title: "Field Manual", links: ["Browse Scenarios", "Browse Campaigns", "Browse Warbands", "Official Content", "Rules viewer", "Warband Builder"] },
  { title: "Community", links: ["News", "Featured", "Contributors", "Discord server", "GitHub repository", "Bug tracker", "Roadmap"] },
  { title: "Resources", links: ["FAQ", "Pricing", "Help center", "API docs", "Changelog", "Status"] },
  { title: "Account", links: ["Sign in", "Enlist", "My Warbands", "Favorites", "Settings", "Subscription"] },
  { title: "Legal", links: ["Terms of service", "Privacy policy", "Cookie policy", "DMCA", "Acceptable use", "Contact"] },
];

export function Footer() {
  return (
    <footer style={{ background: FL.surface, borderTop: `1px solid ${FL.border}`, padding: "56px 32px 24px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr 1fr", gap: 32, maxWidth: 1280, margin: "0 auto" }}>
        <div>
          <FLMark size={28} />
          <p style={{ marginTop: 16, fontSize: 13, color: FL.text2, lineHeight: 1.6, maxWidth: 280 }}>
            A community archive for wargame scenarios, campaigns, and warbands. Build, share, march.
          </p>
          <div className="fl-mono" style={{ marginTop: 16, fontSize: 11, color: FL.textMuted, letterSpacing: "0.05em" }}>
            v0.1.0 · BUILD 1140
          </div>
        </div>
        {cols.map((col) => (
          <div key={col.title}>
            <h4
              className="fl-display"
              style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: FL.gold, margin: "0 0 14px", textTransform: "uppercase" }}
            >
              {col.title}
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {col.links.map((l) => (
                <li key={l}>
                  <a href="#" style={{ fontSize: 13, color: FL.text2, textDecoration: "none" }}>
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div
        style={{
          borderTop: `1px solid ${FL.border}`,
          paddingTop: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          maxWidth: 1280,
          margin: "40px auto 0",
        }}
      >
        <div className="fl-mono" style={{ fontSize: 11, color: FL.textMuted }}>
          © 2026 FORGOTTEN LETTERS · A FAN-MADE COMMUNITY ARCHIVE · NOT AFFILIATED WITH ANY GAME PUBLISHER
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <a href="#" title="GitHub repository" className="fl-mono" style={{ color: FL.textMuted, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, letterSpacing: "0.1em", textDecoration: "none" }}>
            {Icons.github({ size: 14 })} GITHUB
          </a>
          <span style={{ color: FL.border }}>·</span>
          <a href="#" title="Email" className="fl-mono" style={{ color: FL.textMuted, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, letterSpacing: "0.1em", textDecoration: "none" }}>
            {Icons.mail({ size: 14 })} CONTACT
          </a>
        </div>
      </div>
    </footer>
  );
}
