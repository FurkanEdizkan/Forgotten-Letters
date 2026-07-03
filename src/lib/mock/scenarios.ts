import type { ScenarioSummary } from "@/components/social/ScenarioCard";

/**
 * Placeholder scenario data for building/previewing browse UI.
 * Delete once Supabase queries (Phase 2/6) are wired.
 */
export const MOCK_SCENARIOS: ScenarioSummary[] = [
  {
    slug: "the-mud-and-the-hymn",
    title: "The Mud and the Hymn",
    excerpt:
      "Two warbands clash over a flooded chapel as artillery reshapes the field turn by turn. Objective control shifts with the rising water.",
    author: "trench_rat",
    gameSystem: "Trench Crusade",
    playerMin: 2,
    playerMax: 2,
    tags: ["Objective", "Attrition", "Terrain"],
    votes: 142,
    favorites: 38,
    comments: 12,
  },
  {
    slug: "no-mans-vigil",
    title: "No Man's Vigil",
    excerpt:
      "A night raid across a cratered no man's land. Visibility is limited; every flare roll can expose your advance to the enemy guns.",
    author: "sister_agnes",
    gameSystem: "Trench Crusade",
    playerMin: 2,
    playerMax: 4,
    tags: ["Night", "Raid", "Event Table"],
    votes: 98,
    favorites: 27,
    comments: 8,
  },
  {
    slug: "the-iron-confessional",
    title: "The Iron Confessional",
    excerpt:
      "Hold the ruined confessional for six turns while waves of the faithful and the damned test your line. A brutal defensive scenario.",
    author: "gunnery_sgt",
    gameSystem: "Trench Crusade",
    playerMin: 2,
    playerMax: 3,
    tags: ["Defense", "Waves", "Campaign"],
    votes: 210,
    favorites: 64,
    comments: 21,
  },
  {
    slug: "ash-wednesday-offensive",
    title: "Ash Wednesday Offensive",
    excerpt:
      "A large multi-front push with staggered reinforcements. Coordinate three deployment zones or watch your assault stall in the wire.",
    author: "trench_rat",
    gameSystem: "Trench Crusade",
    playerMin: 3,
    playerMax: 4,
    tags: ["Multiplayer", "Reinforcements", "Objective"],
    votes: 76,
    favorites: 19,
    comments: 5,
  },
  {
    slug: "the-relic-run",
    title: "The Relic Run",
    excerpt:
      "Extract a cursed relic from the center of the board before your opponent. A fast, mobile scenario rewarding aggressive positioning.",
    author: "vox_caster",
    gameSystem: "Trench Crusade",
    playerMin: 2,
    playerMax: 2,
    tags: ["Extraction", "Mobile", "Fast"],
    votes: 133,
    favorites: 41,
    comments: 14,
  },
  {
    slug: "verdun-in-miniature",
    title: "Verdun in Miniature",
    excerpt:
      "A grinding meat-grinder of a scenario across a dense trench network. Casualties feed an escalating event table that punishes both sides.",
    author: "sister_agnes",
    gameSystem: "Trench Crusade",
    playerMin: 2,
    playerMax: 2,
    tags: ["Attrition", "Event Table", "Terrain"],
    votes: 187,
    favorites: 55,
    comments: 18,
  },
];

export const GAME_SYSTEMS = ["Trench Crusade"] as const;

export const ALL_TAGS = [
  "Objective",
  "Attrition",
  "Terrain",
  "Night",
  "Raid",
  "Event Table",
  "Defense",
  "Waves",
  "Campaign",
  "Multiplayer",
  "Reinforcements",
  "Extraction",
  "Mobile",
  "Fast",
] as const;
