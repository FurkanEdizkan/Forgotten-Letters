// Typed mock data for the Profile page, extracted from the design project Profile.jsx.
import { FL } from "../tokens/colors";
import type { Archetype } from "../components/art/FighterMini";
import type { PillTone } from "../components/primitives/Pill";

export const identity = {
  name: "Varius Castellan",
  handle: "@v.castellan",
  role: "FIELD POST · OFFICER",
  location: "Bruges, BE",
  joined: "Jan 2026",
  tagline:
    "Painter of small men. Forty years of slow campaigns. Scenarios lean toward sieges and bad weather. Faithful by habit, Heretic by need.",
  followers: 284,
  following: 62,
  badges: [
    { icon: "✦", label: "Featured author", sub: "3 scenarios", tone: "gold" as const },
    { icon: "⊕", label: "Founding archivist", sub: "Joined Jan 2026" },
    { icon: "⛨", label: "Campaign winner", sub: "Salt Road" },
    { icon: "✚", label: "Beta tester" },
    { icon: "◈", label: "50 publications" },
  ],
};

export const career = {
  winRate: 63,
  delta: "+4",
  played: 38,
  wins: 24,
  draws: 5,
  losses: 9,
  wdl: [
    { pct: 63.2, color: FL.success },
    { pct: 13.2, color: FL.warn },
    { pct: 23.6, color: FL.danger },
  ],
  last10: ["W", "W", "D", "W", "L", "W", "W", "W", "L", "W"] as const,
  streak: "W3",
  best: "W7",
};

export const factionFav = {
  name: "New Antioch",
  games: 26,
  distribution: [
    { name: "New Antioch", count: 26, color: FL.gold, pct: 68 },
    { name: "Iron Sultanate", count: 7, color: FL.gold, pct: 18 },
    { name: "Trench Pilgrims", count: 3, color: FL.brass, pct: 8 },
    { name: "Heretic Legion", count: 2, color: FL.blood, pct: 6 },
  ],
};

export interface Metric {
  v: string;
  l: string;
  tone?: string;
  kind?: "ducat" | "glory";
}
export const fieldRecord: Metric[] = [
  { v: "42,180", l: "Ducats earned", kind: "ducat" },
  { v: "124", l: "Glory earned", tone: FL.crimson, kind: "glory" },
  { v: "38", l: "Matches played" },
  { v: "7", l: "Campaigns", tone: FL.gold },
  { v: "4", l: "Warbands" },
  { v: "12", l: "Scenarios authored" },
  { v: "62", l: "Models painted" },
  { v: "3", l: "Featured", tone: FL.gold },
];

export const connections: [string, string][] = [
  ["GitHub", "@v-castellan"],
  ["Discord", "castellan#1408"],
  ["BoardGameGeek", "v.castellan"],
  ["Website", "castellan.field"],
];

export interface Warband {
  name: string;
  faction: string;
  tone: PillTone;
  arch: Archetype;
  fighters: number;
  ducats: number;
  glory: number;
  rules: string;
  likes: number;
  isPublic: boolean;
}
export const warbands: Warband[] = [
  { name: "The Vigil of St. Ambrose", faction: "New Antioch", tone: "gold", arch: "captain", fighters: 9, ducats: 665, glory: 9, rules: "v1.8.2", likes: 12, isPublic: true },
  { name: "Black Wick Chapter", faction: "New Antioch", tone: "gold", arch: "penitent", fighters: 8, ducats: 700, glory: 14, rules: "v1.7.4", likes: 8, isPublic: true },
  { name: "Janissary 12th", faction: "Iron Sultanate", tone: "gold", arch: "janissary", fighters: 7, ducats: 600, glory: 2, rules: "v1.8.2", likes: 4, isPublic: false },
  { name: "The Carrion Choir", faction: "Black Grail", tone: "blood", arch: "witch", fighters: 10, ducats: 800, glory: 5, rules: "v1.8.2", likes: 14, isPublic: true },
];

export interface Match {
  r: "W" | "D" | "L";
  my: string;
  myArch: Archetype;
  op: string;
  opU: string;
  opArch: Archetype;
  sc: string;
  scenario: string;
  date: string;
  feat: boolean;
}
export const matches: Match[] = [
  { r: "W", my: "The Vigil of St. Ambrose", myArch: "captain", op: "The Drowned Cohort", opU: "quietflood", opArch: "sin-eater", sc: "3 — 1", scenario: "Cathedral of Salt", date: "2 days ago", feat: true },
  { r: "L", my: "The Vigil of St. Ambrose", myArch: "captain", op: "Seventh Maw", opU: "v.brodir", opArch: "assassin", sc: "1 — 3", scenario: "No Bells for the Drowned", date: "4 days ago", feat: false },
  { r: "W", my: "Janissary 12th", myArch: "janissary", op: "Chorus of Beelzebub", opU: "r.devan", opArch: "witch", sc: "4 — 2", scenario: "Vespers at Argonne", date: "1 week ago", feat: false },
  { r: "D", my: "Black Wick Chapter", myArch: "penitent", op: "Iron Widows", opU: "ironwidow", opArch: "sin-eater", sc: "2 — 2", scenario: "Twelve Lanterns", date: "1 week ago", feat: false },
  { r: "W", my: "The Carrion Choir", myArch: "witch", op: "Sons of Anvers", opU: "l.harrow", opArch: "captain", sc: "5 — 3", scenario: "No-Man's Garden", date: "2 weeks ago", feat: true },
  { r: "W", my: "The Vigil of St. Ambrose", myArch: "captain", op: "The Apostate", opU: "g.harrow", opArch: "witch", sc: "4 — 1", scenario: "Last Tram from Calais", date: "2 weeks ago", feat: false },
  { r: "L", my: "Black Wick Chapter", myArch: "penitent", op: "The Long Watch", opU: "m.varga", opArch: "captain", sc: "0 — 5", scenario: "The Foundry Below", date: "3 weeks ago", feat: false },
];

export interface ActiveCampaign {
  title: string;
  role: string;
  wb: string;
  progress: number;
  status: string;
  tag: string;
  tagColor: string;
}
export const activeCampaigns: ActiveCampaign[] = [
  { title: "The Salt Road", role: "Host: m.varga", wb: "New Antioch · The Vigil of St. Ambrose", progress: 0.43, status: "Scenario 3 of 7", tag: "YOUR TURN", tagColor: FL.crimson },
  { title: "Iron Sermon", role: "Joined as Auxiliary", wb: "Iron Sultanate · Janissary 12th", progress: 0.6, status: "Scenario 3 of 5", tag: "AWAITING OPPONENT", tagColor: FL.warn },
  { title: "Vespers Eternal", role: "Host: ironwidow", wb: "New Antioch · Black Wick Chapter", progress: 0.2, status: "Scenario 1 of 5", tag: "SCHEDULED · 3 DAYS", tagColor: FL.info },
];

export interface AuthoredScenario {
  title: string;
  votes: number;
  comments: number;
  featured: boolean;
  tag: string;
}
export const authoredScenarios: AuthoredScenario[] = [
  { title: "The Cathedral of Salt", votes: 284, comments: 32, featured: true, tag: "siege" },
  { title: "Twelve Lanterns", votes: 67, comments: 8, featured: false, tag: "urban" },
  { title: "The Pale Reliquary", votes: 41, comments: 6, featured: false, tag: "ambush" },
];

export interface Activity {
  k: string;
  body: string;
  t: string;
  c: string;
}
export const activity: Activity[] = [
  { k: "WIN", body: "Defeated quietflood in Cathedral of Salt", t: "2 days ago", c: FL.success },
  { k: "POST", body: 'Published scenario "The Cathedral of Salt"', t: "4 days ago", c: FL.gold },
  { k: "JOIN", body: 'Joined campaign "Iron Sermon"', t: "1 week ago", c: FL.info },
  { k: "FEAT", body: '"Twelve Lanterns" was featured by editors', t: "1 week ago", c: FL.gold },
  { k: "LOSS", body: "Lost to v.brodir in No Bells for the Drowned", t: "1 week ago", c: FL.danger },
  { k: "POST", body: 'Created warband "The Carrion Choir"', t: "2 weeks ago", c: FL.text2 },
  { k: "GLOR", body: "Earned 8 Glory across The Salt Road", t: "2 weeks ago", c: FL.crimson },
  { k: "CAMP", body: "Won The Marsh Road campaign", t: "1 month ago", c: FL.gold },
];

export interface CampaignHistory {
  name: string;
  out: string;
  tone: "gold" | "success" | "danger" | "warn";
  sub: string;
  glory: string;
}
export const campaignHistory: CampaignHistory[] = [
  { name: "The Marsh Road", out: "Won", tone: "gold", sub: "7 scen · 12 weeks", glory: "+18 Glory" },
  { name: "Dust & Vespers", out: "Won", tone: "gold", sub: "5 scen · 6 weeks", glory: "+12 Glory" },
  { name: "Black Wick", out: "Top 3", tone: "success", sub: "6 scen · 8 weeks", glory: "+9 Glory" },
  { name: "Sortie Eternal", out: "Defeated", tone: "danger", sub: "4 scen · 5 weeks", glory: "+3 Glory" },
  { name: "First Light", out: "Abandoned", tone: "warn", sub: "2 of 7 scen", glory: "—" },
];

export const achievements: [string, "gold" | "default" | "muted"][] = [
  ["✦", "gold"], ["⛨", "gold"], ["◈", "gold"], ["✚", "gold"],
  ["⚔", "default"], ["☥", "default"], ["☠", "default"], ["◌", "default"],
  ["—", "muted"], ["—", "muted"], ["—", "muted"], ["—", "muted"],
];

export const profileTabs: [string, boolean, number | null][] = [
  ["Overview", true, null],
  ["Warbands", false, 4],
  ["Scenarios", false, 12],
  ["Campaigns", false, 7],
  ["Match history", false, 38],
  ["Likes", false, 184],
  ["Activity", false, null],
];
