import { Link, useLocation } from "react-router-dom";
import { FL } from "../../tokens/colors";
import { Icons } from "../art/icons";
import { FLMark, Avatar, chromeBtn } from "./bits";

// Ported from the design project Chrome.jsx (logged-in variant). Two entries route
// to the lab's real pages; the rest stay as faithful visual placeholders.
const links: { id: string; label: string; to?: string }[] = [
  { id: "profile", label: "Profile", to: "/profile" },
  { id: "design-system", label: "Design System", to: "/design-system" },
  { id: "scenarios", label: "Scenarios" },
  { id: "campaigns", label: "Campaigns" },
  { id: "warbands", label: "Warbands" },
  { id: "rules", label: "Rules" },
];

export function Navbar() {
  const { pathname } = useLocation();
  const linkStyle = (activeId: boolean): React.CSSProperties => ({
    position: "relative",
    padding: "20px 14px",
    fontSize: 13,
    fontWeight: 500,
    letterSpacing: "0.04em",
    color: activeId ? FL.text : FL.text2,
    textDecoration: "none",
    textTransform: "uppercase",
  });
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: FL.surface,
        borderBottom: `1px solid ${FL.border}`,
        height: 64,
        display: "flex",
        alignItems: "center",
        padding: "0 32px",
        gap: 32,
      }}
    >
      <Link to="/profile" style={{ textDecoration: "none" }}>
        <FLMark size={28} />
      </Link>
      <nav style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 16 }}>
        {links.map((l) => {
          const active = l.to ? pathname === l.to : false;
          const underline = active && (
            <span style={{ position: "absolute", left: 14, right: 14, bottom: 0, height: 2, background: FL.blood }} />
          );
          return l.to ? (
            <Link key={l.id} to={l.to} className="fl-focus" style={linkStyle(active)}>
              {l.label}
              {underline}
            </Link>
          ) : (
            <a key={l.id} href="#" className="fl-focus" style={linkStyle(false)}>
              {l.label}
            </a>
          );
        })}
      </nav>
      <div style={{ flex: 1 }} />
      <div style={{ position: "relative", width: 280 }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: FL.textMuted }}>
          {Icons.search({ size: 14 })}
        </span>
        <input
          className="fl-focus"
          placeholder="Search the field…"
          style={{
            width: "100%",
            height: 36,
            background: FL.bg,
            border: `1px solid ${FL.border}`,
            borderRadius: 6,
            padding: "0 12px 0 34px",
            color: FL.text,
            fontSize: 13,
          }}
        />
        <span
          className="fl-mono"
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            color: FL.textMuted,
            fontSize: 11,
            padding: "2px 6px",
            border: `1px solid ${FL.border}`,
            borderRadius: 3,
          }}
        >
          ⌘K
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="fl-focus" style={chromeBtn.icon}>
          {Icons.bell({ size: 18, color: FL.text2 })}
          <span
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              minWidth: 14,
              height: 14,
              padding: "0 4px",
              borderRadius: 7,
              background: FL.blood,
              color: FL.text,
              fontSize: 9,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            3
          </span>
        </button>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 10px 4px 4px",
            borderRadius: 20,
            border: `1px solid ${FL.border}`,
          }}
        >
          <Avatar size={28} initials="VC" />
          <span style={{ fontSize: 12, color: FL.text2 }}>v.castellan</span>
          {Icons.chevD({ size: 12, color: FL.textMuted })}
        </div>
      </div>
    </header>
  );
}
