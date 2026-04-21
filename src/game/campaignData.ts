import type { AsteroidType } from "./types";

// Re-export AsteroidType so existing call sites keep working.
export type { AsteroidType };

export interface AsteroidConfig {
  type: AsteroidType;
  maxHp: number;
  baseSpeed: number; // base vy pixels/sec
  color: string;
  glowColor: string;
}

export const ASTEROID_CONFIGS: Record<AsteroidType, AsteroidConfig> = {
  blue: {
    type: "blue",
    maxHp: 20,
    baseSpeed: 40,
    color: "hsl(210, 80%, 55%)",
    glowColor: "hsl(210, 80%, 70%)",
  },
  orange: {
    type: "orange",
    maxHp: 35,
    baseSpeed: 80,
    color: "hsl(30, 90%, 55%)",
    glowColor: "hsl(30, 90%, 70%)",
  },
  purple: {
    type: "purple",
    maxHp: 40,
    baseSpeed: 130,
    color: "hsl(270, 70%, 55%)",
    glowColor: "hsl(270, 70%, 70%)",
  },
  red: {
    type: "red",
    maxHp: 50,
    baseSpeed: 100, // varies 60-150 per spawn
    color: "hsl(0, 80%, 50%)",
    glowColor: "hsl(0, 80%, 65%)",
  },
  // Stage 2+: homing harder than red, splits into 5 blues on death.
  green: {
    type: "green",
    maxHp: 40, // = purple
    baseSpeed: 100,
    color: "hsl(140, 70%, 45%)",
    glowColor: "hsl(140, 70%, 65%)",
  },
  // Stage 3+: small, fast, ×2 impact damage.
  pink: {
    type: "pink",
    maxHp: 50, // = red
    baseSpeed: 200, // 2× others
    color: "hsl(330, 85%, 65%)",
    glowColor: "hsl(330, 85%, 80%)",
  },
  // Stage 4+: huge, slow, ×5 HP & ×5 impact damage.
  yellow: {
    type: "yellow",
    maxHp: 250, // 5× red
    baseSpeed: 30,
    color: "hsl(50, 95%, 55%)",
    glowColor: "hsl(50, 95%, 70%)",
  },
  // Stage 5+: medium red-cratered shells, splits into 5 small reds on death.
  white: {
    type: "white",
    maxHp: 50, // = red
    baseSpeed: 100,
    color: "hsl(0, 0%, 92%)",
    glowColor: "hsl(0, 0%, 100%)",
  },
  // Stage 6: black holes — small, slow, very strong homing, absorb others.
  black: {
    type: "black",
    maxHp: 30,
    baseSpeed: 50,
    color: "hsl(0, 0%, 5%)",
    glowColor: "hsl(200, 100%, 65%)",
  },
};

export interface LevelDef {
  /** Counts per slot — actual asteroid types vary by stage via STAGE_ASTEROID_SLOTS. */
  slot1: number;
  slot2: number;
  slot3: number;
  slot4: number;
  hasBoss: boolean;
}

// Same numeric template as before — only the slot→type mapping changes per stage.
export const LEVEL_DEFS: LevelDef[] = [
  { slot1: 15, slot2: 0,  slot3: 0,  slot4: 0,  hasBoss: false },
  { slot1: 15, slot2: 5,  slot3: 0,  slot4: 0,  hasBoss: false },
  { slot1: 15, slot2: 15, slot3: 0,  slot4: 0,  hasBoss: false },
  { slot1: 20, slot2: 20, slot3: 0,  slot4: 0,  hasBoss: false },
  { slot1: 25, slot2: 15, slot3: 5,  slot4: 0,  hasBoss: false },
  { slot1: 25, slot2: 20, slot3: 10, slot4: 0,  hasBoss: false },
  { slot1: 25, slot2: 25, slot3: 15, slot4: 5,  hasBoss: false },
  { slot1: 25, slot2: 25, slot3: 20, slot4: 10, hasBoss: false },
  { slot1: 25, slot2: 25, slot3: 25, slot4: 15, hasBoss: false },
  { slot1: 25, slot2: 25, slot3: 25, slot4: 25, hasBoss: true  },
];

/**
 * Per-stage asteroid roster. As stages advance, the weakest type drops out
 * and a new variant slots in at the top end (slot4).
 *
 * Slot index → asteroid type for stage N (1-indexed via stage-1).
 */
export const STAGE_ASTEROID_SLOTS: AsteroidType[][] = [
  ["blue",   "orange", "purple", "red"   ], // Stage 1
  ["orange", "purple", "red",    "green" ], // Stage 2
  ["purple", "red",    "green",  "pink"  ], // Stage 3
  ["red",    "green",  "pink",   "yellow"], // Stage 4
  ["green",  "pink",   "yellow", "white" ], // Stage 5
  ["pink",   "yellow", "white",  "black" ], // Stage 6
];

export interface StageDef {
  name: string;
  speedMultiplier: number;
}

export const STAGE_DEFS: StageDef[] = [
  { name: "Very Easy", speedMultiplier: 0.5 },
  { name: "Easy", speedMultiplier: 0.75 },
  { name: "Medium", speedMultiplier: 1 },
  { name: "Hard", speedMultiplier: 1.5 },
  { name: "Very Hard", speedMultiplier: 2 },
  { name: "Impossible", speedMultiplier: 3 },
];

export const ASTEROID_SPAWN_INTERVAL = 1.5; // seconds between spawns
export const ASTEROID_MIN_RADIUS = 5;
export const ASTEROID_MAX_RADIUS = 50;

export function getTotalAsteroids(level: LevelDef): number {
  return level.slot1 + level.slot2 + level.slot3 + level.slot4;
}

export function buildSpawnQueue(level: LevelDef, stage: number): AsteroidType[] {
  const slots = STAGE_ASTEROID_SLOTS[Math.min(Math.max(stage - 1, 0), STAGE_ASTEROID_SLOTS.length - 1)];
  const queue: AsteroidType[] = [];
  for (let i = 0; i < level.slot1; i++) queue.push(slots[0]);
  for (let i = 0; i < level.slot2; i++) queue.push(slots[1]);
  for (let i = 0; i < level.slot3; i++) queue.push(slots[2]);
  for (let i = 0; i < level.slot4; i++) queue.push(slots[3]);
  // Shuffle
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  return queue;
}
