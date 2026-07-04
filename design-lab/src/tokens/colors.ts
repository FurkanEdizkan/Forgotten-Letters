// Forgotten Letters — grimdark design tokens (canon).
// Exact hex ported from the Claude Design project components/tokens.jsx.
export const FL = {
  bg: "#0C0C0E", // Charcoal Black
  surface: "#1A1A1F", // Ash Gray
  elevated: "#252529", // Smoke
  border: "#2E2E35", // Trench Gray
  borderHi: "#3A3A42", // hover border
  text: "#E8E2D6", // Bone White
  text2: "#9B9484", // Dust
  textMuted: "#5C574E", // Iron
  blood: "#8B1A1A", // Blood Red (primary accent)
  crimson: "#A52222", // Crimson (hover)
  gold: "#B8923F", // Tarnished Gold
  brass: "#8A6D2F", // Aged Brass
  success: "#2D6B4F", // Verdigris
  warn: "#B8860B", // Mustard Gas
  danger: "#C0392B", // Flare Red
  info: "#4A6FA5", // Steel Blue
  display: '"Cinzel", Georgia, serif',
  body: '"Inter", -apple-system, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
} as const;

export type FLColor = keyof typeof FL;
