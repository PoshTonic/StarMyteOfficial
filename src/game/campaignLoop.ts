import {
  GameState,
  Asteroid,
  CampaignState,
  MineExplosion,
  Shockwave,
  AsteroidExplosion,
  ExplosionShard,
  ExplosionPuff,
  ExplosionSpark,
} from "./types";
import {
  ASTEROID_CONFIGS,
  ASTEROID_SPAWN_INTERVAL,
  ASTEROID_MIN_RADIUS,
  ASTEROID_MAX_RADIUS,
  AsteroidType,
} from "./campaignData";
import { audioManager } from "./audioManager";
import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  SHIP_Y_PLAYER,
  SHIELD_RADIUS,
  SHIP_WIDTH,
  PHASER_BEAM_WIDTH,
  MINE_EXPLOSION_RADIUS_RATIO,
  RADIX_SHOCKWAVE_SPEED,
  SHIELD_HEAT_FACTOR,
  RICOCHET_HEAT_FACTOR,
  ISOSPHERE_HEAT_FACTOR,
  ISOSPHERE_HEAL_FACTOR,
  REGENX_COOL_FACTOR,
  REGENX_DMG_FACTOR,
} from "./constants";

export const ASTEROID_EXPLOSION_DURATION = 0.85; // seconds — outlives all four FX layers

let asteroidIdCounter = 0;
let explosionIdCounter = 0;
const nextAsteroidId = () => `ast_${++asteroidIdCounter}`;
const nextExplosionId = () => `aex_${++explosionIdCounter}`;

// Tiny deterministic PRNG seeded from asteroid id so the same asteroid
// always blows up the same way (mulberry32, mirrors renderer.ts).
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}
function makeRng(seed: number) {
  let t = Math.floor(seed * 4294967295) >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function buildAsteroidExplosion(a: Asteroid, timer: number): AsteroidExplosion {
  // Salt the seed so the explosion shape is decorrelated from the crater layout.
  const rng = makeRng(hashStr(a.id + "|explode"));
  const r = a.radius;

  // Shard count scales gently with size (smaller asteroids → fewer chunks)
  const shardCount = Math.max(4, Math.min(8, Math.round(r / 8)));
  const shards: ExplosionShard[] = [];
  for (let i = 0; i < shardCount; i++) {
    // Irregular polygon: 3-5 vertices around the shard centre
    const vCount = 3 + Math.floor(rng() * 3);
    const verts: { x: number; y: number }[] = [];
    for (let v = 0; v < vCount; v++) {
      const ang = (v / vCount) * Math.PI * 2 + rng() * 0.6;
      const rad = 0.6 + rng() * 0.6; // 0.6-1.2 of shard size
      verts.push({ x: Math.cos(ang) * rad, y: Math.sin(ang) * rad });
    }
    const dir = rng() * Math.PI * 2;
    const speed = 80 + rng() * 120;
    shards.push({
      verts,
      ox: 0,
      oy: 0,
      vx: Math.cos(dir) * speed,
      vy: Math.sin(dir) * speed - 30, // slight upward bias for "pop"
      rotation: rng() * Math.PI * 2,
      rotSpeed: (rng() - 0.5) * 6,
      size: r * (0.18 + rng() * 0.18),
    });
  }

  // Smoke puffs — staggered birth, drifting outward
  const puffCount = 10;
  const puffs: ExplosionPuff[] = [];
  for (let i = 0; i < puffCount; i++) {
    const ang = rng() * Math.PI * 2;
    const dist = rng() * r * 0.4;
    const drift = 20 + rng() * 25;
    puffs.push({
      ox: Math.cos(ang) * dist,
      oy: Math.sin(ang) * dist,
      vx: Math.cos(ang) * drift,
      vy: Math.sin(ang) * drift,
      baseRadius: r * (0.5 + rng() * 0.5),
      isInner: i % 2 === 0, // alternate inner/outer for layering
      delay: rng() * 0.08, // 0-80ms stagger
    });
  }

  // Sparks — fast, tight burst
  const sparkCount = 8 + Math.floor(rng() * 5);
  const sparks: ExplosionSpark[] = [];
  for (let i = 0; i < sparkCount; i++) {
    const ang = rng() * Math.PI * 2;
    const speed = 250 + rng() * 150;
    sparks.push({
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
    });
  }

  return {
    id: nextExplosionId(),
    startTime: timer,
    x: a.x,
    y: a.y,
    radius: r,
    type: a.type,
    shards,
    puffs,
    sparks,
  };
}

function spawnAsteroid(type: AsteroidType, speedMultiplier: number): Asteroid {
  const cfg = ASTEROID_CONFIGS[type];

  // Per-type size constraints
  let radius: number;
  switch (type) {
    case "pink":
    case "black":
      // Always small
      radius = 5 + Math.random() * 13; // 5..18
      break;
    case "yellow":
      // Always very large
      radius = 40 + Math.random() * 10; // 40..50
      break;
    case "white":
      // Always medium
      radius = 18 + Math.random() * 17; // 18..35
      break;
    default:
      radius =
        ASTEROID_MIN_RADIUS +
        Math.random() * (ASTEROID_MAX_RADIUS - ASTEROID_MIN_RADIUS);
  }

  let baseSpeed = cfg.baseSpeed;
  if (type === "red") {
    baseSpeed = 60 + Math.random() * 90; // 60-150
  }
  const speed = baseSpeed * speedMultiplier;

  const x = radius + Math.random() * (ARENA_WIDTH - radius * 2);
  const vx = (Math.random() - 0.5) * speed * 0.5;
  const vy = speed * (0.5 + Math.random() * 0.5);

  // Per-type impact-damage multipliers (player-collision only)
  let damageMultiplier: number | undefined;
  if (type === "pink") damageMultiplier = 2;
  else if (type === "yellow") damageMultiplier = 5;

  return {
    id: nextAsteroidId(),
    x,
    y: -radius,
    vx,
    vy,
    radius,
    type,
    hp: cfg.maxHp,
    maxHp: cfg.maxHp,
    damageMultiplier,
  };
}

/**
 * Spawn child asteroids at a parent's death location.
 * Used by green (5 blue children, parent radius clamped ≤50)
 * and white (5 small red children, radius 5–15).
 * Children count toward the level total — caller bumps `totalAsteroids`.
 */
function spawnChildAsteroids(
  parent: Asteroid,
  childType: AsteroidType,
  speedMultiplier: number,
  count: number,
  childRadius: number,
): Asteroid[] {
  const cfg = ASTEROID_CONFIGS[childType];
  const children: Asteroid[] = [];
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const speed = (cfg.baseSpeed * 0.6 + Math.random() * cfg.baseSpeed * 0.4) * speedMultiplier;
    children.push({
      id: nextAsteroidId(),
      x: parent.x,
      y: parent.y,
      vx: Math.cos(ang) * speed,
      vy: Math.abs(Math.sin(ang) * speed) * 0.7 + speed * 0.3, // bias downward
      radius: childRadius,
      type: childType,
      hp: cfg.maxHp,
      maxHp: cfg.maxHp,
    });
  }
  return children;
}

export function updateCampaignAsteroids(
  state: GameState,
  dtSec: number
): GameState {
  const cs = state.campaignState;
  if (!cs) return state;

  let campaign = { ...cs };
  let asteroids = campaign.asteroids.map((a) => ({ ...a }));
  let player = { ...state.player };
  let projectiles = [...state.projectiles];
  let asteroidExplosions = [...(state.asteroidExplosions || [])];

  // Helper — handle a destroyed asteroid: spawn children for green/white,
  // and bump totalAsteroids so completion math stays correct.
  const onAsteroidDestroyed = (dead: Asteroid) => {
    const speedMult = campaign.speedMultiplier ?? 1;
    if (dead.type === "green") {
      const childRadius = Math.min(50, dead.radius);
      const kids = spawnChildAsteroids(dead, "blue", speedMult, 5, childRadius);
      asteroids.push(...kids);
      campaign.totalAsteroids += 5;
    } else if (dead.type === "white") {
      const childRadius = 5 + Math.random() * 10; // 5..15
      const kids = spawnChildAsteroids(dead, "red", speedMult, 5, childRadius);
      asteroids.push(...kids);
      campaign.totalAsteroids += 5;
    }
  };

  // Spawn asteroids from queue
  if (campaign.spawnQueue.length > 0 && state.timer >= campaign.nextSpawnTime) {
    const type = campaign.spawnQueue[0];
    const remaining = campaign.spawnQueue.slice(1);
    const asteroid = spawnAsteroid(
      type,
      campaign.speedMultiplier ?? 1
    );
    asteroids.push(asteroid);
    campaign = {
      ...campaign,
      spawnQueue: remaining,
      nextSpawnTime: state.timer + ASTEROID_SPAWN_INTERVAL,
    };
  }

  // Move asteroids
  for (let i = asteroids.length - 1; i >= 0; i--) {
    const a = asteroids[i];

    // Homing — red (1×), green (2×), black hole (3×)
    const isHoming = a.type === "red" || a.type === "green" || a.type === "black";
    if (isHoming && (a.homingDisabledUntil ?? 0) <= state.timer) {
      const targetX = player.x;
      const targetY = SHIP_Y_PLAYER;
      const dx = targetX - a.x;
      const dy = targetY - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 1) {
        const nx = dx / dist;
        const ny = dy / dist;
        const homingMult = a.type === "black" ? 3 : a.type === "green" ? 2 : 1;
        const steerStrength = 30 * homingMult * (campaign.speedMultiplier ?? 1);
        a.vx += nx * steerStrength * dtSec;
        a.vy += ny * steerStrength * dtSec;
        // Cap speed — black holes have a much lower cap (slow but relentless)
        const speed = Math.hypot(a.vx, a.vy);
        const baseMax = a.type === "black" ? 80 : 200;
        const maxSpeed = baseMax * (campaign.speedMultiplier ?? 1);
        if (speed > maxSpeed) {
          a.vx = (a.vx / speed) * maxSpeed;
          a.vy = (a.vy / speed) * maxSpeed;
        }
      }
    }

    a.x += a.vx * dtSec;
    a.y += a.vy * dtSec;

    // Bounce off left/right walls
    if (a.x - a.radius < 0) {
      a.x = a.radius;
      a.vx = Math.abs(a.vx);
    } else if (a.x + a.radius > ARENA_WIDTH) {
      a.x = ARENA_WIDTH - a.radius;
      a.vx = -Math.abs(a.vx);
    }

    // Bounce off top wall
    if (a.y - a.radius < 0) {
      a.y = a.radius;
      a.vy = Math.abs(a.vy);
    }

    // Exit through bottom
    if (a.y - a.radius > ARENA_HEIGHT) {
      asteroids.splice(i, 1);
      continue;
    }
  }

  // Asteroid vs asteroid collisions (simple elastic bounce + black-hole absorption)
  for (let i = 0; i < asteroids.length; i++) {
    for (let j = i + 1; j < asteroids.length; j++) {
      const a = asteroids[i];
      const b = asteroids[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const minDist = a.radius + b.radius;
      if (dist < minDist && dist > 0) {
        // Black hole absorption — only if exactly one of the two is black.
        // Black-vs-black: skip absorption entirely (just bounces below).
        const aIsBlack = a.type === "black";
        const bIsBlack = b.type === "black";
        if (aIsBlack !== bIsBlack) {
          const hole = aIsBlack ? a : b;
          const prey = aIsBlack ? b : a;
          // Absorb HP and grow 5%
          hole.hp += prey.hp;
          hole.maxHp += prey.maxHp;
          hole.radius *= 1.05;
          // Counts toward destroyed (so totals stay consistent)
          campaign.asteroidsDestroyed++;
          campaign.infinityScore = (campaign.infinityScore || 0) + prey.maxHp;
          // Small absorption FX (reuse explosion at prey's location)
          asteroidExplosions.push(buildAsteroidExplosion(prey, state.timer));
          // Remove prey
          const preyIdx = aIsBlack ? j : i;
          asteroids.splice(preyIdx, 1);
          if (preyIdx <= i) i--;
          break; // restart j-loop for this i (a may have moved)
        }

        const nx = dx / dist;
        const ny = dy / dist;
        // Separate
        const overlap = (minDist - dist) / 2;
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;
        // Swap velocity components along collision axis
        const dvx = a.vx - b.vx;
        const dvy = a.vy - b.vy;
        const dot = dvx * nx + dvy * ny;
        if (dot > 0) {
          a.vx -= dot * nx;
          a.vy -= dot * ny;
          b.vx += dot * nx;
          b.vy += dot * ny;
        }
        // Disable homing for 1s on red asteroids that collide
        if (a.type === "red") a.homingDisabledUntil = state.timer + 1;
        if (b.type === "red") b.homingDisabledUntil = state.timer + 1;
      }
    }
  }

  // Asteroid vs projectile collisions
  let mineExplosions = [...(state.mineExplosions || [])];
  const projToRemove = new Set<string>();
  for (let i = asteroids.length - 1; i >= 0; i--) {
    const a = asteroids[i];
    for (let j = 0; j < projectiles.length; j++) {
      const p = projectiles[j];
      if (p.owner !== "player" || projToRemove.has(p.id)) continue;
      // Skip mines in flight
      if (p.isMine && !p.mineArmed) continue;
      // Skip delayed projectiles (Trident stagger)
      if (p.spawnDelay !== undefined && p.spawnDelay > 0) continue;

      // Armed mine proximity → explode
      if (p.isMine && p.mineArmed) {
        const dist = Math.hypot(p.x - a.x, p.y - a.y);
        if (dist < a.radius + 12) {
          // Trigger mine explosion
          projToRemove.add(p.id);
          const radius = p.mineRadius || ARENA_WIDTH * MINE_EXPLOSION_RADIUS_RATIO;
          mineExplosions.push({
            id: `mexp_${p.id}`,
            x: p.x,
            y: p.y,
            radius,
            startTime: state.timer,
          });
          // Damage all asteroids in blast radius
          for (let k = asteroids.length - 1; k >= 0; k--) {
            const ast = asteroids[k];
            const d = Math.hypot(p.x - ast.x, p.y - ast.y);
            if (d < radius) {
              ast.hp -= p.dmg;
              if (ast.hp <= 0) {
                campaign.asteroidsDestroyed++;
                campaign.infinityScore = (campaign.infinityScore || 0) + ast.maxHp;
                asteroidExplosions.push(buildAsteroidExplosion(ast, state.timer));
                audioManager.playAsteroidExplosion(ast.radius);
                onAsteroidDestroyed(ast);
                asteroids.splice(k, 1);
                if (k <= i) i--;
              }
            }
          }
          break;
        }
        continue;
      }

      const dist = Math.hypot(p.x - a.x, p.y - a.y);
      if (dist < a.radius + 5) {
        a.hp -= p.dmg;
        projToRemove.add(p.id);
        if (a.hp <= 0) {
          campaign.asteroidsDestroyed++;
          campaign.infinityScore = (campaign.infinityScore || 0) + a.maxHp;
          asteroidExplosions.push(buildAsteroidExplosion(a, state.timer));
          audioManager.playAsteroidExplosion(a.radius);
          onAsteroidDestroyed(a);
          asteroids.splice(i, 1);
          break;
        }
      }
    }
  }

  // Check armed mines with expired timers
  for (let j = 0; j < projectiles.length; j++) {
    const p = projectiles[j];
    if (!p.isMine || !p.mineArmed || projToRemove.has(p.id)) continue;
    if ((p.mineTimer || 0) <= 0) {
      projToRemove.add(p.id);
      const radius = p.mineRadius || ARENA_WIDTH * MINE_EXPLOSION_RADIUS_RATIO;
      mineExplosions.push({
        id: `mexp_${p.id}`,
        x: p.x,
        y: p.y,
        radius,
        startTime: state.timer,
      });
      for (let k = asteroids.length - 1; k >= 0; k--) {
        const ast = asteroids[k];
        const d = Math.hypot(p.x - ast.x, p.y - ast.y);
        if (d < radius) {
          ast.hp -= p.dmg;
          if (ast.hp <= 0) {
            campaign.asteroidsDestroyed++;
            campaign.infinityScore = (campaign.infinityScore || 0) + ast.maxHp;
            asteroidExplosions.push(buildAsteroidExplosion(ast, state.timer));
            audioManager.playAsteroidExplosion(ast.radius);
            onAsteroidDestroyed(ast);
            asteroids.splice(k, 1);
          }
        }
      }
    }
  }

  projectiles = projectiles.filter((p) => !projToRemove.has(p.id));

  // Phaser beam vs asteroids
  const playerBeam = state.activeBeams.find(b => b.active && b.owner === "player" && !b.reflected);
  if (playerBeam) {
    const beam = playerBeam;
    const beamHitWidth = PHASER_BEAM_WIDTH / 2 + 5;
    const beamLength = beam.progress * ARENA_HEIGHT;
    for (let i = asteroids.length - 1; i >= 0; i--) {
      const a = asteroids[i];
      if (Math.abs(a.x - beam.x) < beamHitWidth + a.radius) {
        const beamEndY = SHIP_Y_PLAYER - beamLength;
        if (a.y > beamEndY && a.y < SHIP_Y_PLAYER) {
          // Flat DPS
          const frameDmg = beam.baseDmg * dtSec;
          a.hp -= frameDmg;
          if (a.hp <= 0) {
            campaign.asteroidsDestroyed++;
            campaign.infinityScore = (campaign.infinityScore || 0) + a.maxHp;
            asteroidExplosions.push(buildAsteroidExplosion(a, state.timer));
            audioManager.playAsteroidExplosion(a.radius);
            onAsteroidDestroyed(a);
            asteroids.splice(i, 1);
          }
        }
      }
    }
  }

  // Asteroid vs player ship
  for (let i = asteroids.length - 1; i >= 0; i--) {
    const a = asteroids[i];
    const dist = Math.hypot(a.x - player.x, a.y - SHIP_Y_PLAYER);
    const hitDist = a.radius + SHIP_WIDTH / 2;

    // Shield blocks asteroid (bounces)
    if (player.shieldActive && dist < SHIELD_RADIUS + a.radius) {
      const heatAdd = SHIELD_HEAT_FACTOR * a.hp;
      a.vy = -Math.abs(a.vy);
      a.y = SHIP_Y_PLAYER - SHIELD_RADIUS - a.radius;
      player = { ...player, shieldRecoil: 1, heat: Math.min(player.maxHeat, player.heat + heatAdd) };
      continue;
    }

    // Ricochet reflects asteroid upward at 50% speed (no DMG change to asteroid)
    if (player.ricochetActive && dist < SHIELD_RADIUS + a.radius) {
      const heatAdd = RICOCHET_HEAT_FACTOR * a.hp;
      a.vy = -Math.abs(a.vy) * 0.5;
      a.vx *= 0.5;
      a.y = SHIP_Y_PLAYER - SHIELD_RADIUS - a.radius;
      player = { ...player, shieldRecoil: 1, heat: Math.min(player.maxHeat, player.heat + heatAdd) };
      continue;
    }

    // IsoSphere: bounces asteroid + heals 20% of asteroid's current HP + 35% heat
    if (player.isoSphereActive && dist < SHIELD_RADIUS + a.radius) {
      const healAmount = Math.round(ISOSPHERE_HEAL_FACTOR * a.hp);
      const heatAdd = ISOSPHERE_HEAT_FACTOR * a.hp;
      a.vy = -Math.abs(a.vy);
      a.y = SHIP_Y_PLAYER - SHIELD_RADIUS - a.radius;
      player = { ...player, shieldRecoil: 1, hp: Math.min(player.maxHp, player.hp + healAmount), heat: Math.min(player.maxHeat, player.heat + heatAdd) };
      continue;
    }

    // RegenX: bounces asteroid + cools 25% heat + sustains 25% DMG
    if (player.regenXActive && dist < SHIELD_RADIUS + a.radius) {
      const coolAmount = Math.round(REGENX_COOL_FACTOR * a.hp);
      const hpCost = Math.round(REGENX_DMG_FACTOR * a.hp);
      a.vy = -Math.abs(a.vy);
      a.y = SHIP_Y_PLAYER - SHIELD_RADIUS - a.radius;
      player = { ...player, shieldRecoil: 1, heat: Math.max(0, player.heat - coolAmount), hp: Math.max(0, player.hp - hpCost) };
      continue;
    }

    // Z-level dodge
    if (player.zLevel !== "normal") continue;

    if (dist < hitDist) {
      // DMG = current HP × type-specific impact multiplier (pink ×2, yellow ×5; black already accumulates HP)
      const dmg = Math.max(0, a.hp) * (a.damageMultiplier ?? 1);
      player = { ...player, hp: Math.max(0, player.hp - dmg) };
      campaign.damageTaken += dmg;
      campaign.asteroidsDestroyed++;
      campaign.infinityScore = (campaign.infinityScore || 0) + a.maxHp;
      asteroidExplosions.push(buildAsteroidExplosion(a, state.timer));
      audioManager.playAsteroidExplosion(a.radius);
      onAsteroidDestroyed(a);
      asteroids.splice(i, 1);
    }
  }

  campaign.asteroids = asteroids;

  // Shockwave vs asteroids
  let shockwaves = [...(state.shockwaves || [])];
  for (let si = 0; si < shockwaves.length; si++) {
    const sw = { ...shockwaves[si], hitAsteroids: new Set(shockwaves[si].hitAsteroids) };
    if (sw.owner !== "player" || sw.fadingOut) { shockwaves[si] = sw; continue; }
    const elapsed = state.timer - sw.startTime;
    const currentRadius = elapsed * RADIX_SHOCKWAVE_SPEED;
    for (let i = campaign.asteroids.length - 1; i >= 0; i--) {
      const a = campaign.asteroids[i];
      if (sw.hitAsteroids.has(a.id)) continue;
      const dist = Math.hypot(sw.x - a.x, sw.y - a.y);
      if (dist < currentRadius) {
        sw.hitAsteroids.add(a.id);
        a.hp -= sw.dmg;
        if (a.hp <= 0) {
          campaign.asteroidsDestroyed++;
          campaign.infinityScore = (campaign.infinityScore || 0) + a.maxHp;
          asteroidExplosions.push(buildAsteroidExplosion(a, state.timer));
          audioManager.playAsteroidExplosion(a.radius);
          onAsteroidDestroyed(a);
          campaign.asteroids.splice(i, 1);
        }
      }
    }
    shockwaves[si] = sw;
  }

  // Age + prune asteroid explosions (visual FX only — no gameplay effect)
  asteroidExplosions = asteroidExplosions.filter(
    (ex) => state.timer - ex.startTime < ASTEROID_EXPLOSION_DURATION,
  );

  return {
    ...state,
    player,
    projectiles,
    campaignState: campaign,
    mineExplosions,
    shockwaves,
    asteroidExplosions,
  };
}

export function calculateStars(
  asteroidsDestroyed: number,
  totalAsteroids: number,
  damageTaken: number
): number {
  const pct = totalAsteroids > 0 ? asteroidsDestroyed / totalAsteroids : 0;
  if (pct === 1 && damageTaken === 0) return 5;
  if (pct >= 0.7) return 4;
  if (pct >= 0.5) return 3;
  if (pct >= 0.3) return 2;
  return 1;
}
