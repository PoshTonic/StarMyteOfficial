export const ARENA_WIDTH = 430;
export const ARENA_HEIGHT = 750;
export const CANVAS_BLEED = 40; // horizontal padding so ship wings aren't clipped at edges

export const SHIP_WIDTH = 40;
export const SHIP_HEIGHT = 50;
// Canvas split: top 10% enemy zone, middle 80% battle space, bottom 10% player zone
// Ships centered in their respective zones
export const SHIP_Y_OPPONENT = Math.round(ARENA_HEIGHT * 0.05) + 5; // center of top 10% + 5px padding from top
export const SHIP_Y_PLAYER = Math.round(ARENA_HEIGHT * 0.95) - 5; // center of bottom 10% - 5px padding from heat bar

export const SHIELD_RADIUS = 35;

export const FUEL_DRAIN_MOVE = 2; // per second (general movement)
export const FUEL_DRAIN_Z = 4; // per second for movement while in dive/soar
export const FUEL_TRIGGER_Z = 2; // one-time cost when entering dive/soar

export const HEAT_RECOVERY_RATE = 8; // per second (natural cooldown)
export const HEAT_PURGE_DURATION = 5; // seconds

export const PERK_SPAWN_MIN = 15; // seconds
export const PERK_SPAWN_MAX = 25;
export const PERK_LIFETIME = 8; // seconds

// Perk rarity system
export type PerkRarity = "blue" | "orange" | "red" | "purple";

export const PERK_RARITY_VALUES: Record<PerkRarity, number> = {
  blue: 10, orange: 25, red: 35, purple: 50,
};

export const PERK_RARITY_WEIGHTS: Record<PerkRarity, number> = {
  blue: 0.50, orange: 0.30, red: 0.15, purple: 0.05,
};

export const PERK_RARITY_COLORS: Record<PerkRarity, { fill: string; stroke: string; glow: string }> = {
  blue:   { fill: "hsla(210, 100%, 60%, 0.3)", stroke: "hsl(210, 100%, 60%)", glow: "hsl(210, 100%, 70%)" },
  orange: { fill: "hsla(30, 100%, 50%, 0.3)",  stroke: "hsl(30, 100%, 50%)",  glow: "hsl(30, 100%, 65%)" },
  red:    { fill: "hsla(0, 80%, 55%, 0.3)",    stroke: "hsl(0, 80%, 55%)",    glow: "hsl(0, 80%, 70%)" },
  purple: { fill: "hsla(270, 80%, 60%, 0.3)",  stroke: "hsl(270, 80%, 60%)",  glow: "hsl(270, 80%, 75%)" },
};

export function rollPerkRarity(): PerkRarity {
  const entries: { rarity: PerkRarity; weight: number }[] = [
    { rarity: "blue", weight: PERK_RARITY_WEIGHTS.blue },
    { rarity: "orange", weight: PERK_RARITY_WEIGHTS.orange },
    { rarity: "red", weight: PERK_RARITY_WEIGHTS.red },
    { rarity: "purple", weight: PERK_RARITY_WEIGHTS.purple },
  ];
  const total = entries.reduce((s, e) => s + e.weight, 0);
  let roll = Math.random() * total;
  for (const e of entries) {
    roll -= e.weight;
    if (roll <= 0) return e.rarity;
  }
  return "blue";
}

export const PERK_SIZE = 40;

export const PERK_HP: Record<PerkRarity, number> = {
  blue: 10, orange: 20, red: 30, purple: 50,
};

export const FLYING_PERK_DURATION = 1.5; // seconds

export const PROJECTILE_CONFIGS = {
  Cannon: { width: 10, height: 20, color: "hsl(30, 90%, 55%)", glowColor: "hsl(30, 90%, 65%)" },
  "Machine Gun": { width: 6, height: 14, color: "hsl(199, 89%, 55%)", glowColor: "hsl(199, 89%, 70%)" },
  Missile: { width: 14, height: 22, color: "hsl(0, 72%, 55%)", glowColor: "hsl(0, 72%, 65%)" },
  Shield: { width: 0, height: 0, color: "hsl(199, 89%, 48%)", glowColor: "hsl(199, 89%, 60%)" },
  Blaster: { width: 4, height: 24, color: "hsl(0, 90%, 55%)", glowColor: "hsl(0, 90%, 70%)" },
  Phaser: { width: 0, height: 0, color: "hsl(270, 80%, 60%)", glowColor: "hsl(270, 80%, 75%)" },
  Ricochet: { width: 0, height: 0, color: "hsl(270, 80%, 60%)", glowColor: "hsl(270, 80%, 75%)" },
  Trident: { width: 3, height: 22, color: "hsl(270, 80%, 60%)", glowColor: "hsl(270, 80%, 80%)" },
  Mine: { width: 0, height: 0, color: "hsl(0, 0%, 50%)", glowColor: "hsl(0, 70%, 50%)" },
  RadixR4: { width: 0, height: 0, color: "hsl(200, 90%, 55%)", glowColor: "hsl(200, 90%, 70%)" },
  "Dual-BB": { width: 4, height: 12, color: "hsl(120, 80%, 55%)", glowColor: "hsl(120, 80%, 70%)" },
};

// RadixR4 Shockwave constants
export const RADIX_SHOCKWAVE_SPEED = 600; // px/s expansion speed
export const RADIX_SHOCKWAVE_MAX_RADIUS = ARENA_HEIGHT * 0.95;
export const RADIX_SHOCKWAVE_FADE_DURATION = 0.5; // seconds

// Mine constants
export const MINE_FUSE_DURATION = 5; // seconds before auto-explode
export const MINE_EXPLOSION_RADIUS_RATIO = 0.15; // fraction of ARENA_WIDTH (legacy)
export const MINE_EXPLOSION_RADIUS = ARENA_HEIGHT * 0.2; // 20vh blast radius (150px)
export const MINE_EXPLOSION_DURATION = 0.35; // seconds for visual explosion

// SPD 100 = 1 second to cross the distance between ships
// Distance between ships ≈ ARENA_HEIGHT - 180 (SHIP_Y_PLAYER - SHIP_Y_OPPONENT)
export const SHIP_DISTANCE = SHIP_Y_PLAYER - SHIP_Y_OPPONENT; // ~570px

export const BOT_REACTION_DELAY = 300; // ms
export const BOT_DODGE_CHANCE = 0.4;
export const BOT_SHIELD_MISSILE_CHANCE = 0.5;

export const MISSILE_HP = 30;

export const COUNTDOWN_DURATION = 3; // seconds

// Phaser beam constants
export const PHASER_CHARGE_TIME = 0.5; // seconds
export const PHASER_BEAM_DURATION = 5; // seconds
export const PHASER_BASE_DMG = 2; // unused — baseDmg comes from weapon's dmg stat (= flat DPS)
export const PHASER_BEAM_WIDTH = 24; // pixels

// Ricochet
export const RICOCHET_DAMAGE_MULTIPLIER = 0.5;

// Shield resource conversion constants
export const SHIELD_HEAT_FACTOR = 0.20;      // Standard shield: 20% DMG → heat
export const RICOCHET_HEAT_FACTOR = 0.25;    // Ricochet: 25% DMG → heat
export const ISOSPHERE_HEAT_FACTOR = 0.35;   // IsoSphere: 35% DMG → heat
export const ISOSPHERE_HEAL_FACTOR = 0.20;   // IsoSphere: 20% DMG → HP recovery
export const REGENX_COOL_FACTOR = 0.25;      // RegenX: 25% DMG → heat recovery (coolant)
export const REGENX_DMG_FACTOR = 0.25;       // RegenX: 25% DMG sustained

// Star Attribute System
export type StarRarity = "yellow" | "blue" | "orange" | "red" | "purple";

export const STAR_RARITIES: StarRarity[] = ["yellow", "blue", "orange", "red", "purple"];

export const STAR_CONFIG: Record<StarRarity, {
  label: string;
  color: string;
  glowColor: string;
  multiplier: number;
}> = {
  yellow:  { label: "Common",    color: "hsl(50, 100%, 50%)",  glowColor: "hsl(50, 100%, 70%)",  multiplier: 1.025 },
  blue:    { label: "Uncommon",  color: "hsl(210, 100%, 60%)", glowColor: "hsl(210, 100%, 80%)", multiplier: 1.035 },
  orange:  { label: "Rare",      color: "hsl(30, 100%, 50%)",  glowColor: "hsl(30, 100%, 70%)",  multiplier: 1.05 },
  red:     { label: "Epic",      color: "hsl(0, 80%, 55%)",    glowColor: "hsl(0, 80%, 75%)",    multiplier: 1.07 },
  purple:  { label: "Legendary", color: "hsl(270, 80%, 60%)",  glowColor: "hsl(270, 80%, 80%)",  multiplier: 1.1 },
};

export const STAR_ATTRIBUTES = ["hp", "dmg", "fuel", "heat"] as const;
export type StarAttribute = typeof STAR_ATTRIBUTES[number];

export const STAR_SLOTS_PER_ATTRIBUTE = 5;
export const STAR_REMOVAL_COST = 500;

// Campaign reward tables
export const CAMPAIGN_REWARDS: Record<number, { xp: number; credits: number }> = {
  1: { xp: 5, credits: 10 },
  2: { xp: 10, credits: 20 },
  3: { xp: 20, credits: 40 },
  4: { xp: 30, credits: 60 },
  5: { xp: 50, credits: 100 },
};

// Star drop rates (base for 4-star, boosted for 5-star)
export const STAR_DROP_RATES_BASE: Record<StarRarity, number> = {
  yellow: 0.60, blue: 0.25, orange: 0.10, red: 0.04, purple: 0.01,
};
export const STAR_DROP_RATES_5STAR: Record<StarRarity, number> = {
  yellow: 0.60, blue: 0.25, orange: 0.50, red: 0.20, purple: 0.05,
};

export function rollStarDrop(stars: number): StarRarity | null {
  if (stars < 4) return null;
  const rates = stars === 5 ? STAR_DROP_RATES_5STAR : STAR_DROP_RATES_BASE;
  // Normalize weights
  const entries = STAR_RARITIES.map(r => ({ rarity: r, weight: rates[r] }));
  const total = entries.reduce((s, e) => s + e.weight, 0);
  let roll = Math.random() * total;
  for (const e of entries) {
    roll -= e.weight;
    if (roll <= 0) return e.rarity;
  }
  return "yellow";
}

export function rollLevelUpStar(): StarRarity {
  return rollStarDrop(4) || "yellow";
}
