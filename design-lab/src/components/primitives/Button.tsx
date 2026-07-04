import { FL } from "../../tokens/colors";

export type ButtonVariant = "primary" | "secondary" | "gold" | "ghost";

const styles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    padding: "0 14px",
    height: 34,
    background: FL.blood,
    border: `1px solid ${FL.blood}`,
    borderRadius: 4,
    color: FL.text,
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: "0.04em",
  },
  secondary: {
    padding: "0 14px",
    height: 34,
    background: "transparent",
    border: `1px solid ${FL.borderHi}`,
    borderRadius: 4,
    color: FL.text,
    fontSize: 12,
    fontWeight: 500,
  },
  gold: {
    padding: "0 14px",
    height: 34,
    background: "transparent",
    border: `1px solid ${FL.brass}`,
    borderRadius: 4,
    color: FL.gold,
    fontSize: 12,
    fontWeight: 500,
  },
  ghost: {
    padding: "0 10px",
    height: 30,
    background: "transparent",
    border: "none",
    color: FL.text2,
    fontSize: 12,
  },
};

export function Button({
  variant = "primary",
  children,
  onClick,
  style,
}: {
  variant?: ButtonVariant;
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <button className="fl-focus" style={{ ...styles[variant], ...style }} onClick={onClick}>
      {children}
    </button>
  );
}
