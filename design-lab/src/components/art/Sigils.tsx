import { FL } from "../../tokens/colors";

// New Antioch faction sigil.
export function SigilNA({ size = 36, c = FL.gold }: { size?: number; c?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={c} strokeWidth="1.4">
      <path d="M32 6 L52 12 L50 36 Q42 52 32 58 Q22 52 14 36 L12 12 Z" />
      <line x1="20" y1="20" x2="44" y2="44" />
      <line x1="44" y1="20" x2="20" y2="44" />
      <circle cx="32" cy="32" r="4" fill={c} fillOpacity="0.3" />
    </svg>
  );
}

export function DucatIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={FL.gold} strokeWidth="1.2">
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="3.5" />
    </svg>
  );
}

export function GloryIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={FL.crimson} strokeWidth="1.2">
      <path
        d="M8 1 L9.5 6 L15 6 L10.5 9 L12 14 L8 11 L4 14 L5.5 9 L1 6 L6.5 6 Z"
        fill={FL.crimson}
        fillOpacity="0.3"
      />
    </svg>
  );
}

export function HeartIcon({ size = 12, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={filled ? FL.crimson : "none"} stroke={FL.crimson} strokeWidth="1.4">
      <path d="M8 14 C 4 11 1 8.5 1 5.5 C 1 3 3 1.5 5 1.5 C 6.5 1.5 7.5 2.5 8 3.5 C 8.5 2.5 9.5 1.5 11 1.5 C 13 1.5 15 3 15 5.5 C 15 8.5 12 11 8 14 Z" />
    </svg>
  );
}
