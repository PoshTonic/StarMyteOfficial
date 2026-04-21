export type ZLevel = "normal" | "dive" | "soar";

export type WeaponType = "Shield" | "Cannon" | "Machine Gun" | "Missile" | "Blaster" | "Phaser" | "Ricochet" | "IsoSphere" | "RegenX" | "Trident" | "Mine" | "RadixR4" | "Dual-BB";

export interface Shockwave {
  id: string;
  owner: "player" | "opponent";
  x: number;
  y: number;
  startTime: number;
  dmg: number;
  maxRadius: number;
  fadingOut: boolean;
  fadeStartTime: number;
  hitShip: boolean;
  hitAsteroids: Set<string>;
}

export type FireMode = "hold" | "tap" | "target";

export interface WeaponSlot {
  id: string;
  name: WeaponType;
  type: string;
  dmg: number;
  heat: number;
  cooldown: number;
  fireRate: number;
  fireMode: FireMode;
  spd: number;
  slot: number;
  currentCooldown: number;
  lastFired: number;
}

export interface Ship {
  x: number;
  y: number;
  targetX: number;
  hp: number;
  maxHp: number;
  fuel: number;
  maxFuel: number;
  heat: number;
  maxHeat: number;
  speed: number;
  zLevel: ZLevel;
  isHeatPurging: boolean;
  heatPurgeTimer: number;
  shieldActive: boolean;
  ricochetActive: boolean;
  isoSphereActive: boolean;
  regenXActive: boolean;
  shieldRecoil: number;
  shieldHeatFactor: number;
  width: number;
  height: number;
  flameOpacity: number;
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: WeaponType;
  owner: "player" | "opponent";
  dmg: number;
  spd: number;
  hp: number;
  // Missile/Mine arc fields
  startX?: number;
  startY?: number;
  targetX?: number;
  targetY?: number;
  arcProgress?: number;
  controlX?: number;
  controlY?: number;
  // Trident stagger
  spawnDelay?: number;
  // Mine fields
  isMine?: boolean;
  mineArmed?: boolean;
  mineTimer?: number;
  mineRadius?: number;
}

export interface MineExplosion {
  id: string;
  x: number;
  y: number;
  radius: number;
  startTime: number;
}

export type PerkType = "hp" | "heat" | "fuel";

export interface Perk {
  id: string;
  x: number;
  y: number;
  type: PerkType;
  rarity: "blue" | "orange" | "red" | "purple";
  spawnTime: number;
  hp: number;
  maxHp: number;
}

export interface FlyingPerkIcon {
  id: string;
  type: PerkType;
  owner: "player" | "opponent";
  startX: number;
  startY: number;
  startTime: number;
  rarity: "blue" | "orange" | "red" | "purple";
}

export type GamePhase = "countdown" | "playing" | "ending" | "victory" | "defeat";

export interface EndingExplosion {
  id: number;
  x: number;
  y: number;
  spawnTime: number;
}

export interface ShipDebris {
  image: HTMLImageElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotSpeed: number;
  spawnTime: number;
}

export interface DestructionShockwave {
  x: number;
  y: number;
  startTime: number;
  maxRadius: number;
}

export interface EndingInfo {
  result: "victory" | "defeat";
  startTime: number;
  explosions: EndingExplosion[];
  hasOpponent: boolean;
  soundsPlayed: Set<number>;
  debris: ShipDebris[];
  debrisSpawned: boolean;
  destructionShockwave?: DestructionShockwave;
}

export interface MissileTarget {
  x: number;
  y: number;
  active: boolean;
}

export interface ActiveBeam {
  owner: "player" | "opponent";
  x: number;
  startTime: number;
  progress: number; // 0→1 visual fill
  duration: number; // total beam time (5s)
  active: boolean; // beam actually firing (after charge)
  charging: boolean;
  chargeStart: number;
  elapsed: number; // seconds since beam became active
  baseDmg: number; // weapon's dmg stat from database (= DPS)
  spd?: number; // weapon speed stat — controls beam travel speed
  reflected?: boolean; // true for ricochet-reflected beams
  reflectedFromX?: number; // X position of the reflecting ship
  clashY?: number; // Y coordinate where beams meet
  draining?: boolean; // beam is trailing off (no damage, no movement lock)
  drainProgress?: number; // 0→progress, how far the tail has retracted
}

export type AsteroidType =
  | "blue"
  | "orange"
  | "purple"
  | "red"
  | "green"
  | "pink"
  | "yellow"
  | "white"
  | "black";

export interface ExplosionShard {
  // Vertices in local space (relative to shard centre, before rotation)
  verts: { x: number; y: number }[];
  // Position offset from explosion centre
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  rotation: number;
  rotSpeed: number;
  size: number; // baseline radius used to scale verts at draw
}

export interface ExplosionPuff {
  ox: number; // initial offset from centre
  oy: number;
  vx: number;
  vy: number;
  baseRadius: number;
  isInner: boolean; // true → tinted with asteroid colour, false → dark anchor
  delay: number; // seconds before puff appears
}

export interface ExplosionSpark {
  vx: number;
  vy: number;
}

export interface AsteroidExplosion {
  id: string;
  startTime: number;
  x: number;
  y: number;
  radius: number;
  type: AsteroidType;
  shards: ExplosionShard[];
  puffs: ExplosionPuff[];
  sparks: ExplosionSpark[];
}

export interface Asteroid {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  type: AsteroidType;
  hp: number;
  maxHp: number;
  homingDisabledUntil?: number;
  /** Multiplier applied to player-impact damage (default 1). Pink=2, Yellow=5. */
  damageMultiplier?: number;
}

export interface CampaignState {
  stage: number;
  level: number;
  asteroids: Asteroid[];
  asteroidsDestroyed: number;
  totalAsteroids: number;
  damageTaken: number;
  spawnQueue: AsteroidType[];
  nextSpawnTime: number;
  speedMultiplier: number;
  bossPhase?: "asteroids" | "opponent";
  infinityScore?: number;
}

export interface GameState {
  phase: GamePhase;
  timer: number;
  player: Ship;
  opponent: Ship;
  playerWeapons: WeaponSlot[];
  opponentWeapons: WeaponSlot[];
  selectedWeapon: number;
  projectiles: Projectile[];
  perks: Perk[];
  missileTarget: MissileTarget;
  nextPerkSpawn: number;
  arenaWidth: number;
  arenaHeight: number;
  countdownValue: number;
  xpEarned: number;
  creditsEarned: number;
  playerShipName: string;
  opponentShipName: string;
  playerSkinColours?: Record<string, string>;
  playerSkinId?: string;
  playerJetSkinColours?: Record<string, string>;
  playerJetSkinId?: string;
  opponentSkinColours?: Record<string, string>;
  opponentSkinId?: string;
  opponentJetSkinColours?: Record<string, string>;
  opponentJetSkinId?: string;
  activeBeams: ActiveBeam[];
  flyingPerkIcons: FlyingPerkIcon[];
  campaignState?: CampaignState;
  mineExplosions: MineExplosion[];
  shockwaves: Shockwave[];
  endingInfo?: EndingInfo;
  asteroidExplosions?: AsteroidExplosion[];
}

export interface InputState {
  dragging: boolean;
  dragStartX: number;
  dragStartY: number;
  currentX: number;
  currentY: number;
  shipTapped: boolean;
  canvasTapped: boolean;
  tapX: number;
  tapY: number;
  swipeUpHeld: boolean;
  swipeDownHeld: boolean;
  holdingFire: boolean;
}
