export type BotDifficulty = "very_easy" | "easy" | "medium" | "hard" | "very_hard" | "impossible";

export interface BotDifficultyConfig {
  weaponNames: string[];
  reactionDelay: number;    // ms between decisions
  dodgeChance: number;      // 0-1
  shieldChance: number;     // 0-1 react to missiles
  aimAccuracy: number;      // px offset added to tracking (higher = worse)
  heatThreshold: number;    // fire below this fraction of maxHeat
  fuelManagement: number;   // minimum fuel to attempt dodge
  aggressiveness: number;   // firing probability multiplier (1 = normal)
  statMultipliers: { dmg: number; hp: number }; // applied to boss / bot stats
}

// Offensive weapons the bot can use for "impossible" random picks
const OFFENSIVE_WEAPONS = ["Machine Gun", "Cannon", "Missile", "Blaster", "Phaser", "Trident", "Mine", "RadixR4"];
const DEFENSIVE_WEAPONS = ["Shield", "Ricochet", "IsoSphere", "RegenX"];

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function getImpossibleWeapons(): string[] {
  const offensive = pickRandom(OFFENSIVE_WEAPONS, 3);
  const defensive = pickRandom(DEFENSIVE_WEAPONS, 1);
  return [...offensive, ...defensive];
}

export const BOT_DIFFICULTY_PRESETS: Record<BotDifficulty, BotDifficultyConfig> = {
  very_easy: {
    weaponNames: ["Machine Gun", "Cannon", "Shield"],
    reactionDelay: 800,
    dodgeChance: 0.05,
    shieldChance: 0.15,
    aimAccuracy: 100,
    heatThreshold: 0.6,
    fuelManagement: 15,
    aggressiveness: 0.3,
    statMultipliers: { dmg: 1, hp: 1 },
  },
  easy: {
    weaponNames: ["Machine Gun", "Missile", "Cannon", "Shield"],
    reactionDelay: 500,
    dodgeChance: 0.15,
    shieldChance: 0.3,
    aimAccuracy: 60,
    heatThreshold: 0.7,
    fuelManagement: 10,
    aggressiveness: 0.5,
    statMultipliers: { dmg: 1, hp: 1.25 },
  },
  medium: {
    weaponNames: ["Machine Gun", "Mine", "Blaster", "Shield"],
    reactionDelay: 300,
    dodgeChance: 0.35,
    shieldChance: 0.5,
    aimAccuracy: 30,
    heatThreshold: 0.8,
    fuelManagement: 5,
    aggressiveness: 0.75,
    statMultipliers: { dmg: 1.5, hp: 1.5 },
  },
  hard: {
    weaponNames: ["Machine Gun", "Blaster", "Phaser", "Ricochet"],
    reactionDelay: 200,
    dodgeChance: 0.5,
    shieldChance: 0.6,
    aimAccuracy: 15,
    heatThreshold: 0.85,
    fuelManagement: 5,
    aggressiveness: 0.9,
    statMultipliers: { dmg: 2, hp: 2 },
  },
  very_hard: {
    weaponNames: ["Machine Gun", "Blaster", "RadixR4", "IsoSphere"],
    reactionDelay: 150,
    dodgeChance: 0.6,
    shieldChance: 0.7,
    aimAccuracy: 8,
    heatThreshold: 0.9,
    fuelManagement: 5,
    aggressiveness: 1.0,
    statMultipliers: { dmg: 2, hp: 2 },
  },
  impossible: {
    // weaponNames will be overridden by getImpossibleWeapons()
    weaponNames: [],
    reactionDelay: 100,
    dodgeChance: 0.8,
    shieldChance: 0.85,
    aimAccuracy: 3,
    heatThreshold: 0.95,
    fuelManagement: 5,
    aggressiveness: 1.0,
    statMultipliers: { dmg: 4, hp: 4 },
  },
};

export const DIFFICULTY_META: Record<BotDifficulty, { label: string; desc: string; color: string; border: string; bg: string }> = {
  very_easy: { label: "VERY EASY", desc: "Almost no challenge",                  color: "text-sky-400",     border: "border-sky-500/40 hover:border-sky-500/70",         bg: "bg-sky-500/10" },
  easy:      { label: "EASY",      desc: "Poor aim, slow reactions",             color: "text-emerald-400", border: "border-emerald-500/40 hover:border-emerald-500/70", bg: "bg-emerald-500/10" },
  medium:    { label: "MEDIUM",    desc: "Decent aim, balanced play",            color: "text-yellow-400",  border: "border-yellow-500/40 hover:border-yellow-500/70",   bg: "bg-yellow-500/10" },
  hard:      { label: "HARD",      desc: "Aggressive, uses Phaser",              color: "text-orange-400",  border: "border-orange-500/40 hover:border-orange-500/70",   bg: "bg-orange-500/10" },
  very_hard: { label: "VERY HARD", desc: "Near-perfect, RadixR4 shockwaves",     color: "text-red-400",     border: "border-red-500/40 hover:border-red-500/70",         bg: "bg-red-500/10" },
  impossible:{ label: "IMPOSSIBLE", desc: "Random weapons, inhuman reflexes",    color: "text-purple-400",  border: "border-purple-500/40 hover:border-purple-500/70",   bg: "bg-purple-500/10" },
};
