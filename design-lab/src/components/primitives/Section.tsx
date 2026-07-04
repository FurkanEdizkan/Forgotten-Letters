import { FL } from "../../tokens/colors";

export function Section({
  title,
  kicker,
  cta,
  children,
}: {
  title: string;
  kicker?: string;
  cta?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 32 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          borderBottom: `1px solid ${FL.border}`,
          paddingBottom: 10,
          marginBottom: 16,
        }}
      >
        <div>
          {kicker && (
            <div
              className="fl-mono"
              style={{ fontSize: 10, color: FL.gold, letterSpacing: "0.3em", marginBottom: 5 }}
            >
              {kicker}
            </div>
          )}
          <h2
            className="fl-display"
            style={{ fontSize: 22, color: FL.text, margin: 0, letterSpacing: "0.04em", fontWeight: 600 }}
          >
            {title}
          </h2>
        </div>
        {cta && (
          <a
            href="#"
            style={{
              fontSize: 12,
              color: FL.gold,
              textDecoration: "none",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            {cta}
          </a>
        )}
      </div>
      {children}
    </section>
  );
}
