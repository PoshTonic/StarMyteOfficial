import {
  GameState,
  Projectile,
  Ship,
  WeaponSlot,
  Perk,
  PerkType,
  WeaponType,
  ActiveBeam,
  FlyingPerkIcon,
  MineExplosion,
  Shockwave,
  EndingInfo,
  EndingExplosion,
  ShipDebris,
} from "./types";
import { audioManager } from "./audioManager";
import { getShipFragments } from "./shipAssets";
import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  SHIP_Y_PLAYER,
  SHIP_Y_OPPONENT,
  SHIP_DISTANCE,
  SHIELD_RADIUS,
  FUEL_DRAIN_MOVE,
  FUEL_DRAIN_Z,
  HEAT_RECOVERY_RATE,
  HEAT_PURGE_DURATION,
  PERK_SPAWN_MIN,
  PERK_SPAWN_MAX,
  PERK_LIFETIME,
  PERK_RARITY_VALUES,
  PERK_SIZE,
  PERK_HP,
  FLYING_PERK_DURATION,
  PROJECTILE_CONFIGS,
  MISSILE_HP,
  SHIP_WIDTH,
  PHASER_CHARGE_TIME,
  PHASER_BEAM_DURATION,
  PHASER_BEAM_WIDTH,
  RICOCHET_DAMAGE_MULTIPLIER,
  SHIELD_HEAT_FACTOR,
  RICOCHET_HEAT_FACTOR,
  ISOSPHERE_HEAT_FACTOR,
  ISOSPHERE_HEAL_FACTOR,
  REGENX_COOL_FACTOR,
  REGENX_DMG_FACTOR,
  MINE_FUSE_DURATION,
  MINE_EXPLOSION_RADIUS_RATIO,
  MINE_EXPLOSION_RADIUS,
  MINE_EXPLOSION_DURATION,
  RADIX_SHOCKWAVE_SPEED,
  RADIX_SHOCKWAVE_MAX_RADIUS,
  RADIX_SHOCKWAVE_FADE_DURATION,
  rollPerkRarity,
} from "./constants";

let projectileIdCounter = 0;
export const nextProjectileId = () => `p_${++projectileIdCounter}`;

export function createProjectile(
  weapon: WeaponSlot,
  ship: Ship,
  owner: "player" | "opponent",
  targetX?: number,
  targetY?: number
): Projectile | Projectile[] | null {
  if (weapon.name === "Shield" || weapon.name === "Ricochet" || weapon.name === "Phaser" || weapon.name === "IsoSphere" || weapon.name === "RegenX" || weapon.name === "RadixR4") return null;

  const direction = owner === "player" ? -1 : 1;
  const pixelsPerSecond = (weapon.spd / 100) * SHIP_DISTANCE;

  // Missile
  if (weapon.name === "Missile" && targetX !== undefined && targetY !== undefined) {
    const startX = ship.x;
    const startY = ship.y;
    const side = Math.random() > 0.5 ? 1 : -1;
    const controlX = (startX + targetX) / 2 + side * 80;
    const controlY = (startY + targetY) / 2 - 60 * direction;

    return {
      id: nextProjectileId(),
      x: startX,
      y: startY,
      vx: 0,
      vy: 0,
      type: "Missile",
      owner,
      dmg: weapon.dmg,
      spd: weapon.spd,
      hp: MISSILE_HP,
      startX,
      startY,
      targetX,
      targetY,
      arcProgress: 0,
      controlX,
      controlY,
    };
  }

  // Mine — arc to target like Missile, then arm
  if (weapon.name === "Mine" && targetX !== undefined && targetY !== undefined) {
    const startX = ship.x;
    const startY = ship.y;
    const side = Math.random() > 0.5 ? 1 : -1;
    const controlX = (startX + targetX) / 2 + side * 60;
    const controlY = (startY + targetY) / 2 - 80 * direction;

    return {
      id: nextProjectileId(),
      x: startX,
      y: startY,
      vx: 0,
      vy: 0,
      type: "Mine",
      owner,
      dmg: weapon.dmg,
      spd: weapon.spd,
      hp: 1,
      startX,
      startY,
      targetX,
      targetY,
      arcProgress: 0,
      controlX,
      controlY,
      isMine: true,
      mineArmed: false,
      mineTimer: MINE_FUSE_DURATION,
      mineRadius: MINE_EXPLOSION_RADIUS,
    };
  }

  // Dual-BB — 2 projectiles from wing-tips
  if (weapon.name === "Dual-BB") {
    const offset = SHIP_WIDTH * 0.4;
    return [-offset, offset].map((dx) => ({
      id: nextProjectileId(),
      x: ship.x + dx,
      y: ship.y + direction * 25,
      vx: 0,
      vy: direction * pixelsPerSecond,
      type: "Dual-BB" as WeaponType,
      owner,
      dmg: weapon.dmg,
      spd: weapon.spd,
      hp: 1,
    }));
  }

  // Trident — 3 projectiles fanning at -20°, 0°, +20°
  if (weapon.name === "Trident") {
    const angles = [-20, 0, 20];
    const delays = [0, 0.15, 0.30];
    return angles.map((angleDeg, i) => {
      const angleRad = (angleDeg * Math.PI) / 180;
      const vx = Math.sin(angleRad) * pixelsPerSecond * direction;
      const vy = direction * Math.cos(angleRad) * pixelsPerSecond * -1;
      return {
        id: nextProjectileId(),
        x: ship.x,
        y: ship.y + direction * 25,
        vx: Math.sin(angleRad) * pixelsPerSecond * (owner === "player" ? 1 : -1),
        vy: direction * pixelsPerSecond * Math.cos(angleRad),
        type: "Trident" as WeaponType,
        owner,
        dmg: weapon.dmg,
        spd: weapon.spd,
        hp: 1,
        spawnDelay: delays[i],
      };
    });
  }

  return {
    id: nextProjectileId(),
    x: ship.x,
    y: ship.y + direction * 25,
    vx: 0,
    vy: direction * pixelsPerSecond,
    type: weapon.name as WeaponType,
    owner,
    dmg: weapon.dmg,
    spd: weapon.spd,
    hp: 1,
  };
}

function quadBezier(t: number, p0: number, p1: number, p2: number): number {
  return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
}

export function updateGameState(
  state: GameState,
  dt: number,
  skipPerks?: boolean,
  isAuthoritative: boolean = true,
): GameState {
  // PVP guest (non-authoritative): snapshot HP so we can restore it after the
  // local sim runs. This keeps visual collisions, projectile removal, hit
  // markers, shield recoil, and audio working — but HP itself is owned by
  // the host and only mutated via the `hp_update` peer event.
  const hpSnapshotPlayer = isAuthoritative ? null : state.player.hp;
  const hpSnapshotOpponent = isAuthoritative ? null : state.opponent.hp;
  // Handle ending phase — play explosion sounds and check for transition,
  // but let the simulation continue running below
  if (state.phase === "ending" && state.endingInfo) {
    const elapsed = state.timer - state.endingInfo.startTime;

    // Play ship explosion SFX when mini-explosions finish (1.35s) — only for ship battles
    if (elapsed >= 1.35 && !state.endingInfo.soundsPlayed.has(-1)) {
      state.endingInfo.soundsPlayed.add(-1);
      if (state.endingInfo.hasOpponent) {
        audioManager.playShipExplosion();
      }
    }

    // Play explosion sounds for each explosion that has spawned
    if (state.endingInfo.hasOpponent) {
      for (const exp of state.endingInfo.explosions) {
        const expAge = state.timer - exp.spawnTime;
        if (expAge >= 0 && !state.endingInfo.soundsPlayed.has(exp.id)) {
          state.endingInfo.soundsPlayed.add(exp.id);
          audioManager.playExplosion();
        }
      }
    }

    // Spawn debris at 1.5s
    if (elapsed >= 1.5 && !state.endingInfo.debrisSpawned && state.endingInfo.hasOpponent) {
      state.endingInfo.debrisSpawned = true;
      const dyingShip = state.endingInfo.result === "victory" ? state.opponent : state.player;
      const dyingY = state.endingInfo.result === "victory" ? SHIP_Y_OPPONENT : SHIP_Y_PLAYER;
      const shipName = state.endingInfo.result === "victory" ? state.opponentShipName : state.playerShipName;
      const skinColours = state.endingInfo.result === "victory" ? state.opponentSkinColours : state.playerSkinColours;
      const skinId = state.endingInfo.result === "victory" ? state.opponentSkinId : state.playerSkinId;

      const fragments = getShipFragments(shipName, skinColours as Record<string, string> | undefined, skinId);
      const debris: ShipDebris[] = fragments.map((img) => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 150 + Math.random() * 200;
        return {
          image: img,
          x: dyingShip.x,
          y: dyingY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          rotation: 0,
          rotSpeed: (Math.random() - 0.5) * 16, // ±8 rad/s
          spawnTime: state.timer,
        };
      });
      state.endingInfo.debris = debris;
      state.endingInfo.destructionShockwave = {
        x: dyingShip.x,
        y: dyingY,
        startTime: state.timer,
        maxRadius: 150,
      };
    }

    // Update debris positions
    if (state.endingInfo.debris.length > 0) {
      const dtSec = dt / 1000;
      for (const d of state.endingInfo.debris) {
        d.x += d.vx * dtSec;
        d.y += d.vy * dtSec;
        d.rotation += d.rotSpeed * dtSec;
      }
    }

    if (elapsed >= 2.5) {
      // Fire victory/defeat chime exactly once at the phase flip
      audioManager.playVictoryChime(state.endingInfo.result === "victory");
      return {
        ...state,
        phase: state.endingInfo.result,
        timer: state.timer + dt / 1000,
      };
    }
    // Fall through to run the normal simulation
  }

  if (state.phase !== "playing" && state.phase !== "ending") return state;

  const dtSec = dt / 1000;
  let newState = { ...state };

  newState.timer += dtSec;

  // During ending phase, freeze the dead ship (no movement/firing)
  if (newState.phase === "ending" && newState.endingInfo) {
    const deadSide = newState.endingInfo.result === "victory" ? "opponent" : "player";
    if (deadSide === "opponent") {
      newState.opponent = { ...newState.opponent, targetX: newState.opponent.x };
      newState.player = updateShip(newState.player, dtSec);
      newState.playerWeapons = updateWeaponCooldowns(newState.playerWeapons, dtSec);
    } else {
      newState.player = { ...newState.player, targetX: newState.player.x };
      newState.opponent = updateShip(newState.opponent, dtSec);
      newState.opponentWeapons = updateWeaponCooldowns(newState.opponentWeapons, dtSec);
    }
  } else {
    newState.player = updateShip(newState.player, dtSec);
    newState.opponent = updateShip(newState.opponent, dtSec);
    newState.playerWeapons = updateWeaponCooldowns(newState.playerWeapons, dtSec);
    newState.opponentWeapons = updateWeaponCooldowns(newState.opponentWeapons, dtSec);
  }

  newState.projectiles = updateProjectiles(newState.projectiles, dtSec);

  // Update beams
  newState = updateBeams(newState, dtSec);

  // Update shockwaves
  newState = updateShockwaves(newState, dtSec);

  newState = handleCollisions(newState);
  if (!skipPerks) {
    newState = handlePerks(newState, dtSec);
  } else {
    // Still expire old perks even for non-host
    newState.perks = newState.perks.filter((p) => newState.timer - p.spawnTime < PERK_LIFETIME);
  }

  // Clean up expired flying perk icons
  newState.flyingPerkIcons = newState.flyingPerkIcons.filter(
    f => newState.timer - f.startTime < FLYING_PERK_DURATION
  );

  // Clean up expired mine explosions
  newState.mineExplosions = (newState.mineExplosions || []).filter(
    e => newState.timer - e.startTime < MINE_EXPLOSION_DURATION
  );

  // Skip win/loss checks during ending phase (already resolved) and campaign mode (handled by campaign logic).
  // Also skip on non-authoritative (PVP guest) — host owns the death trigger and broadcasts via game_over.
  if (isAuthoritative && state.phase !== "ending" && !newState.campaignState) {
    if (newState.player.hp <= 0) {
      newState = enterEndingPhase(newState, "defeat", true);
    } else if (newState.opponent.hp <= 0) {
      newState = enterEndingPhase(newState, "victory", true);
    }
  }

  // Non-authoritative: restore HP snapshots so any locally-computed damage
  // from beams, shockwaves, mines, projectiles, and perks is discarded.
  // The host's hp_update event is the only writer of HP on the guest.
  if (!isAuthoritative && hpSnapshotPlayer !== null && hpSnapshotOpponent !== null) {
    newState = {
      ...newState,
      player: { ...newState.player, hp: hpSnapshotPlayer },
      opponent: { ...newState.opponent, hp: hpSnapshotOpponent },
    };
  }

  return newState;
}

/** Generate ending phase state with explosion positions around the dying ship */
export function enterEndingPhase(
  state: GameState,
  result: "victory" | "defeat",
  hasOpponent: boolean
): GameState {
  // Calculate rewards
  const xpEarned = result === "victory"
    ? 50 + Math.floor(state.timer * 3)
    : Math.floor(state.timer * 2);
  const creditsEarned = result === "victory" ? 100 : 0;

  // Generate 10 explosion positions around the dying ship
  const dyingShip = result === "victory" ? state.opponent : state.player;
  const dyingY = result === "victory" ? SHIP_Y_OPPONENT : SHIP_Y_PLAYER;
  const explosions: EndingExplosion[] = [];
  for (let i = 0; i < 10; i++) {
    explosions.push({
      id: i,
      x: dyingShip.x + (Math.random() - 0.5) * 50,
      y: dyingY + (Math.random() - 0.5) * 50,
      spawnTime: state.timer + i * 0.15,
    });
  }

  return {
    ...state,
    phase: "ending",
    xpEarned,
    creditsEarned,
    endingInfo: {
      result,
      startTime: state.timer,
      explosions,
      hasOpponent,
      soundsPlayed: new Set(),
      debris: [],
      debrisSpawned: false,
    },
  };
}

// Exported for PVP perk sync
export { handlePerks };

function getBeamByOwner(beams: ActiveBeam[], owner: "player" | "opponent"): ActiveBeam | undefined {
  return beams.find(b => b.owner === owner && !b.reflected);
}

function getReflectedBeam(beams: ActiveBeam[]): ActiveBeam | undefined {
  return beams.find(b => b.reflected);
}

function updateBeams(state: GameState, dtSec: number): GameState {
  if (state.activeBeams.length === 0) return state;

  let player = { ...state.player };
  let opponent = { ...state.opponent };
  let beams = state.activeBeams.map(b => ({ ...b }));
  const beamsToRemove: number[] = [];

  // Check for dual beam clash
  const playerBeam = getBeamByOwner(beams, "player");
  const opponentBeam = getBeamByOwner(beams, "opponent");
  let clashing = false;
  let clashY: number | undefined;

  if (playerBeam?.active && opponentBeam?.active) {
    const xDist = Math.abs(playerBeam.x - opponentBeam.x);
    if (xDist < PHASER_BEAM_WIDTH) {
      clashing = true;
      const playerBeamEndY = SHIP_Y_PLAYER - playerBeam.progress * ARENA_HEIGHT;
      const opponentBeamEndY = SHIP_Y_OPPONENT + opponentBeam.progress * ARENA_HEIGHT;
      clashY = (playerBeamEndY + opponentBeamEndY) / 2;
      clashY = Math.max(SHIP_Y_OPPONENT + 30, Math.min(SHIP_Y_PLAYER - 30, clashY));
    }
  }

  for (let i = 0; i < beams.length; i++) {
    const beam = beams[i];

    // Handle draining beams
    if (beam.draining) {
      beam.drainProgress = (beam.drainProgress || 0) + dtSec / 0.3;
      if (beam.drainProgress >= (beam.progress || 1)) {
        beamsToRemove.push(i);
      }
      continue;
    }

    // Track beam X to ship position
    const ship = beam.owner === "player" ? player : opponent;
    if (!beam.reflected) {
      beam.x = ship.x;
    }

    if (beam.charging) {
      const chargeElapsed = state.timer - beam.chargeStart;
      if (chargeElapsed >= PHASER_CHARGE_TIME) {
        // Auto-transition to firing — lock ship in place
        beam.charging = false;
        beam.active = true;
        beam.startTime = state.timer;
        beam.elapsed = 0;
      } else {
        continue; // still charging, ship remains mobile
      }
    }

    if (beam.active) {
      beam.elapsed += dtSec;
      // Use weapon spd for beam travel speed: travelTime = 100 / spd seconds
      const travelTime = beam.spd ? 100 / beam.spd : 0.3;
      beam.progress = Math.min(1, beam.progress + dtSec / travelTime);

      // Set clash point
      if (clashing && !beam.reflected) {
        beam.clashY = clashY;
      } else {
        beam.clashY = undefined;
      }

      // Lock ship movement during active beam (not for reflected beams)
      if (!beam.reflected) {
        if (beam.owner === "player") {
          player = { ...player, targetX: player.x };
        } else {
          opponent = { ...opponent, targetX: opponent.x };
        }
      }

      // Apply beam damage if within duration (skip if clashing or reflected)
      // In campaign mode, skip opponent damage until boss phase is active
      const beamHitsOpponent = beam.owner === "player";
      const campaignBlocksBeam = beamHitsOpponent && state.campaignState && state.campaignState.bossPhase !== "opponent";
      if (beam.elapsed <= PHASER_BEAM_DURATION && !clashing && !beam.reflected && !campaignBlocksBeam) {
        const target = beam.owner === "player" ? opponent : player;
        const targetY = beam.owner === "player" ? SHIP_Y_OPPONENT : SHIP_Y_PLAYER;

        const beamHitWidth = PHASER_BEAM_WIDTH / 2 + SHIP_WIDTH / 2;
        const xOverlap = Math.abs(target.x - beam.x) < beamHitWidth;

        const beamLength = beam.progress * ARENA_HEIGHT;
        const distToTarget = Math.abs(
          (beam.owner === "player" ? SHIP_Y_PLAYER : SHIP_Y_OPPONENT) - targetY
        );
        const beamReachesTarget = beamLength >= distToTarget;

        if (xOverlap && beamReachesTarget && target.zLevel === "normal") {
          if (target.shieldActive) {
            const frameDmg = beam.baseDmg * dtSec;
            const heatAdd = SHIELD_HEAT_FACTOR * frameDmg;
            if (beam.owner === "player") {
              opponent = { ...opponent, shieldRecoil: Math.min(1, opponent.shieldRecoil + dtSec * 2), heat: Math.min(opponent.maxHeat, opponent.heat + heatAdd) };
            } else {
              player = { ...player, shieldRecoil: Math.min(1, player.shieldRecoil + dtSec * 2), heat: Math.min(player.maxHeat, player.heat + heatAdd) };
            }
          } else if (target.isoSphereActive) {
            const frameDmg = beam.baseDmg * dtSec;
            const healAmount = ISOSPHERE_HEAL_FACTOR * frameDmg;
            const heatAdd = ISOSPHERE_HEAT_FACTOR * frameDmg;
            if (beam.owner === "player") {
              opponent = { ...opponent, shieldRecoil: Math.min(1, opponent.shieldRecoil + dtSec * 2), hp: Math.min(opponent.maxHp, opponent.hp + healAmount), heat: Math.min(opponent.maxHeat, opponent.heat + heatAdd) };
            } else {
              player = { ...player, shieldRecoil: Math.min(1, player.shieldRecoil + dtSec * 2), hp: Math.min(player.maxHp, player.hp + healAmount), heat: Math.min(player.maxHeat, player.heat + heatAdd) };
            }
          } else if (target.regenXActive) {
            const frameDmg = beam.baseDmg * dtSec;
            const coolAmount = REGENX_COOL_FACTOR * frameDmg;
            const hpCost = REGENX_DMG_FACTOR * frameDmg;
            if (beam.owner === "player") {
              opponent = { ...opponent, shieldRecoil: Math.min(1, opponent.shieldRecoil + dtSec * 2), heat: Math.max(0, opponent.heat - coolAmount), hp: Math.max(0, opponent.hp - hpCost) };
            } else {
              player = { ...player, shieldRecoil: Math.min(1, player.shieldRecoil + dtSec * 2), heat: Math.max(0, player.heat - coolAmount), hp: Math.max(0, player.hp - hpCost) };
            }
          } else if (target.ricochetActive) {
            const frameDmg = beam.baseDmg * dtSec;
            const heatAdd = RICOCHET_HEAT_FACTOR * frameDmg;
            const existingReflected = beams.find(b => b.reflected && b.owner === (beam.owner === "player" ? "opponent" : "player"));
            if (!existingReflected) {
              const reflectedBeam: ActiveBeam = {
                owner: beam.owner === "player" ? "opponent" : "player",
                x: target.x,
                startTime: state.timer,
                progress: 1,
                duration: beam.duration,
                active: true,
                charging: false,
                chargeStart: 0,
                elapsed: beam.elapsed,
                baseDmg: beam.baseDmg * RICOCHET_DAMAGE_MULTIPLIER,
                reflected: true,
                reflectedFromX: target.x,
              };
              beams.push(reflectedBeam);
            }
            if (beam.owner === "player") {
              opponent = { ...opponent, shieldRecoil: Math.min(1, opponent.shieldRecoil + dtSec * 2), heat: Math.min(opponent.maxHeat, opponent.heat + heatAdd) };
            } else {
              player = { ...player, shieldRecoil: Math.min(1, player.shieldRecoil + dtSec * 2), heat: Math.min(player.maxHeat, player.heat + heatAdd) };
            }
          } else {
            const frameDmg = beam.baseDmg * dtSec;
            if (beam.owner === "player") {
              opponent = { ...opponent, hp: Math.max(0, opponent.hp - frameDmg) };
            } else {
              player = { ...player, hp: Math.max(0, player.hp - frameDmg) };
            }
          }
        }
      }

      // Reflected beam damage
      if (beam.reflected && beam.active && beam.elapsed <= PHASER_BEAM_DURATION) {
        const target = beam.owner === "player" ? opponent : player;
        const beamHitWidth = PHASER_BEAM_WIDTH / 2 + SHIP_WIDTH / 2;
        const xOverlap = Math.abs(target.x - (beam.reflectedFromX || beam.x)) < beamHitWidth;

        if (xOverlap && target.zLevel === "normal") {
          const frameDmg = beam.baseDmg * dtSec;
          if (beam.owner === "player") {
            opponent = { ...opponent, hp: Math.max(0, opponent.hp - frameDmg) };
          } else {
            player = { ...player, hp: Math.max(0, player.hp - frameDmg) };
          }
        }
      }

      // Beam duration expired — start draining instead of removing
      if (beam.elapsed > PHASER_BEAM_DURATION) {
        beam.draining = true;
        beam.active = false;
        beam.drainProgress = 0;
      }
    }
  }

  // Remove fully drained beams (and their reflected counterparts)
  if (beamsToRemove.length > 0) {
    const ownersToRemove = beamsToRemove.map(i => beams[i].owner);
    beams = beams.filter((b, i) => {
      if (beamsToRemove.includes(i)) return false;
      if (b.reflected) {
        const sourceOwner = b.owner === "player" ? "opponent" : "player";
        if (ownersToRemove.includes(sourceOwner)) return false;
      }
      return true;
    });
  }

  // Remove reflected beams if the target no longer has ricochet active
  beams = beams.filter(b => {
    if (!b.reflected) return true;
    const defender = b.owner === "player" ? player : opponent;
    return defender.ricochetActive;
  });

  return { ...state, player, opponent, activeBeams: beams };
}

function updateShockwaves(state: GameState, dtSec: number): GameState {
  const shockwaves = state.shockwaves || [];
  if (shockwaves.length === 0) return state;

  let player = { ...state.player };
  let opponent = { ...state.opponent };
  let perks = [...state.perks];
  let flyingPerkIcons = [...state.flyingPerkIcons];
  const updatedShockwaves: Shockwave[] = [];

  for (const sw of shockwaves) {
    const s = { ...sw, hitAsteroids: new Set(sw.hitAsteroids) };
    const elapsed = state.timer - s.startTime;

    if (s.fadingOut) {
      const fadeElapsed = state.timer - s.fadeStartTime;
      if (fadeElapsed >= RADIX_SHOCKWAVE_FADE_DURATION) {
        continue; // remove
      }
      updatedShockwaves.push(s);
      continue;
    }

    const currentRadius = elapsed * RADIX_SHOCKWAVE_SPEED;

    if (currentRadius >= s.maxRadius) {
      s.fadingOut = true;
      s.fadeStartTime = state.timer;
      audioManager.stopRadixShockwave();
      updatedShockwaves.push(s);
      continue;
    }

    // Damage logic — hit ship
    // In campaign mode, skip opponent damage until boss phase is active
    const shockwaveHitsOpponent = s.owner === "player";
    const campaignBlocksShockwave = shockwaveHitsOpponent && state.campaignState && state.campaignState.bossPhase !== "opponent";
    if (!s.hitShip && !campaignBlocksShockwave) {
      const target = s.owner === "player" ? opponent : player;
      const targetY = s.owner === "player" ? SHIP_Y_OPPONENT : SHIP_Y_PLAYER;
      const dist = Math.hypot(s.x - target.x, s.y - targetY);

      if (dist < currentRadius) {
        // Z-level dodge
        if (target.zLevel !== "normal") {
          // Safe — but don't mark hitShip yet, they might return to normal
        } else if (target.shieldActive) {
          const heatAdd = SHIELD_HEAT_FACTOR * s.dmg;
          if (s.owner === "player") opponent = { ...opponent, shieldRecoil: 1, heat: Math.min(opponent.maxHeat, opponent.heat + heatAdd) };
          else player = { ...player, shieldRecoil: 1, heat: Math.min(player.maxHeat, player.heat + heatAdd) };
          s.hitShip = true;
        } else if (target.isoSphereActive) {
          const healAmount = Math.round(ISOSPHERE_HEAL_FACTOR * s.dmg);
          const heatAdd = ISOSPHERE_HEAT_FACTOR * s.dmg;
          if (s.owner === "player") opponent = { ...opponent, shieldRecoil: 1, hp: Math.min(opponent.maxHp, opponent.hp + healAmount), heat: Math.min(opponent.maxHeat, opponent.heat + heatAdd) };
          else player = { ...player, shieldRecoil: 1, hp: Math.min(player.maxHp, player.hp + healAmount), heat: Math.min(player.maxHeat, player.heat + heatAdd) };
          s.hitShip = true;
        } else if (target.regenXActive) {
          const coolAmount = Math.round(REGENX_COOL_FACTOR * s.dmg);
          const hpCost = REGENX_DMG_FACTOR * s.dmg;
          if (s.owner === "player") opponent = { ...opponent, shieldRecoil: 1, heat: Math.max(0, opponent.heat - coolAmount), hp: Math.max(0, opponent.hp - hpCost) };
          else player = { ...player, shieldRecoil: 1, heat: Math.max(0, player.heat - coolAmount), hp: Math.max(0, player.hp - hpCost) };
          s.hitShip = true;
        } else if (target.ricochetActive) {
          const heatAdd = RICOCHET_HEAT_FACTOR * s.dmg;
          if (s.owner === "player") opponent = { ...opponent, shieldRecoil: 1, heat: Math.min(opponent.maxHeat, opponent.heat + heatAdd) };
          else player = { ...player, shieldRecoil: 1, heat: Math.min(player.maxHeat, player.heat + heatAdd) };
          s.hitShip = true;
        } else {
          // Direct hit
          if (s.owner === "player") opponent = { ...opponent, hp: Math.max(0, opponent.hp - s.dmg) };
          else player = { ...player, hp: Math.max(0, player.hp - s.dmg) };
          s.hitShip = true;
        }
      }
    }

    // Damage perks
    for (let k = perks.length - 1; k >= 0; k--) {
      const perk = perks[k];
      const perkDist = Math.hypot(s.x - perk.x, s.y - perk.y);
      if (perkDist < currentRadius && !s.hitAsteroids.has(perk.id)) {
        s.hitAsteroids.add(perk.id);
        const updatedPerk = { ...perk, hp: perk.hp - s.dmg };
        if (updatedPerk.hp <= 0) {
          const ship = s.owner === "player" ? player : opponent;
          const value = PERK_RARITY_VALUES[perk.rarity];
          if (perk.type === "hp") ship.hp = Math.min(ship.maxHp, ship.hp + value);
          if (perk.type === "heat") ship.heat = Math.max(0, ship.heat - value);
          if (perk.type === "fuel") ship.fuel = Math.min(ship.maxFuel, ship.fuel + value);
          if (s.owner === "player") player = { ...ship };
          else opponent = { ...ship };
          flyingPerkIcons.push({
            id: `fly_${perk.id}`,
            type: perk.type,
            owner: s.owner,
            startX: perk.x,
            startY: perk.y,
            startTime: state.timer,
            rarity: perk.rarity,
          });
          perks.splice(k, 1);
        } else {
          perks[k] = updatedPerk;
        }
      }
    }

    updatedShockwaves.push(s);
  }

  return { ...state, player, opponent, perks, flyingPerkIcons, shockwaves: updatedShockwaves };
}

function updateShip(ship: Ship, dtSec: number): Ship {
  const s = { ...ship };

  // Heat purge — disable ALL movement and actions
  if (s.isHeatPurging) {
    s.heatPurgeTimer -= dtSec;
    s.heat = Math.max(0, s.heat - (s.maxHeat / HEAT_PURGE_DURATION) * dtSec);
    if (s.heatPurgeTimer <= 0) {
      s.isHeatPurging = false;
      s.heat = 0;
      s.heatPurgeTimer = 0;
    }
    s.shieldActive = false;
    s.ricochetActive = false;
    s.isoSphereActive = false;
    s.regenXActive = false;
    s.zLevel = "normal";
    s.targetX = s.x;
    return s;
  }

  // Heat at max → trigger purge
  if (s.heat >= s.maxHeat) {
    s.isHeatPurging = true;
    s.heatPurgeTimer = HEAT_PURGE_DURATION;
    s.shieldActive = false;
    s.ricochetActive = false;
    s.isoSphereActive = false;
    s.regenXActive = false;
    return s;
  }

  // Zero fuel — lock all movement
  if (s.fuel <= 0) {
    s.targetX = s.x;
    // Still allow heat recovery, shield recoil, flame decay below
  }

  // Move toward target
  const oldX = s.x;
  const dx = s.targetX - s.x;
  const moveSpeed = s.speed * 3;
  const isMoving = Math.abs(dx) > 1;
  if (isMoving) {
    s.x += Math.sign(dx) * Math.min(Math.abs(dx), moveSpeed * dtSec);
  }

  // Clamp position
  s.x = Math.max(SHIP_WIDTH / 2 - 5, Math.min(ARENA_WIDTH - SHIP_WIDTH / 2 + 5, s.x));

  // Fuel drain based on ACTUAL pixel movement (dead-zone prevents sync-jitter drain)
  const actualDeltaX = Math.abs(s.x - oldX);
  if (actualDeltaX > 0.5) {
    s.fuel = Math.max(0, s.fuel - FUEL_DRAIN_MOVE * dtSec);
  }

  // Z-level: return to normal if fuel runs out (no fuel drain when stationary in dive/soar)
  if (s.zLevel !== "normal") {
    if (s.fuel <= 0) s.zLevel = "normal";
    s.shieldActive = false;
    s.ricochetActive = false;
    s.isoSphereActive = false;
    s.regenXActive = false;
  }

  // Natural heat recovery
  s.heat = Math.max(0, s.heat - HEAT_RECOVERY_RATE * dtSec);

  // Shield recoil decay
  if (s.shieldRecoil > 0) {
    s.shieldRecoil = Math.max(0, s.shieldRecoil - dtSec * 4);
  }

  // Flame opacity — based on actual movement this frame
  if (actualDeltaX > 0.5) {
    s.flameOpacity = Math.min(1, s.flameOpacity + dtSec * 6);
  } else {
    s.flameOpacity = Math.max(0, s.flameOpacity - dtSec * 3);
  }

  return s;
}

function updateWeaponCooldowns(weapons: WeaponSlot[], dtSec: number): WeaponSlot[] {
  return weapons.map((w) => ({
    ...w,
    currentCooldown: Math.max(0, w.currentCooldown - dtSec),
  }));
}

function updateProjectiles(projectiles: Projectile[], dtSec: number): Projectile[] {
  return projectiles
    .map((p) => {
      const np = { ...p };

      // Handle spawn delay for Trident stagger
      if (np.spawnDelay !== undefined && np.spawnDelay > 0) {
        np.spawnDelay -= dtSec;
        return np; // Don't move until delay elapses
      }

      // Mine: arc flight phase
      if (np.isMine && np.arcProgress !== undefined && !np.mineArmed) {
        const pixelsPerSecond = (np.spd / 100) * SHIP_DISTANCE;
        const arcSpeed = pixelsPerSecond / SHIP_DISTANCE;
        np.arcProgress += arcSpeed * dtSec;

        const t = Math.min(1, np.arcProgress);
        if (np.startX !== undefined && np.startY !== undefined &&
            np.targetX !== undefined && np.targetY !== undefined &&
            np.controlX !== undefined && np.controlY !== undefined) {
          np.x = quadBezier(t, np.startX, np.controlX, np.targetX);
          np.y = quadBezier(t, np.startY, np.controlY, np.targetY);
        }

        // Arrived at target — arm the mine
        if (np.arcProgress >= 1) {
          np.mineArmed = true;
          np.arcProgress = undefined;
          np.vx = 0;
          np.vy = 0;
        }
        return np;
      }

      // Mine: armed phase — countdown timer
      if (np.isMine && np.mineArmed) {
        np.mineTimer = (np.mineTimer || 0) - dtSec;
        // Timer expired — mark for explosion (handled in handleCollisions)
        return np;
      }

      if (np.type === "Missile" && np.arcProgress !== undefined) {
        const pixelsPerSecond = (np.spd / 100) * SHIP_DISTANCE;
        const arcSpeed = pixelsPerSecond / SHIP_DISTANCE;
        np.arcProgress += arcSpeed * dtSec;

        const t = np.arcProgress;
        if (np.startX !== undefined && np.startY !== undefined &&
            np.targetX !== undefined && np.targetY !== undefined &&
            np.controlX !== undefined && np.controlY !== undefined) {
          np.x = quadBezier(t, np.startX, np.controlX, np.targetX);
          np.y = quadBezier(t, np.startY, np.controlY, np.targetY);
        }
      } else {
        np.x += np.vx * dtSec;
        np.y += np.vy * dtSec;
      }

      return np;
    })
    .filter((p) => {
      // Armed mines stay in-bounds always
      if (p.isMine && p.mineArmed) return true;
      // Delayed projectiles stay
      if (p.spawnDelay !== undefined && p.spawnDelay > 0) return true;
      return p.x > -50 && p.x < ARENA_WIDTH + 50 && p.y > -50 && p.y < ARENA_HEIGHT + 50;
    });
}

function handleCollisions(state: GameState): GameState {
  let { projectiles, player, opponent, perks, activeBeams, flyingPerkIcons } = state;
  let mineExplosions = [...(state.mineExplosions || [])];
  projectiles = [...projectiles];
  player = { ...player };
  opponent = { ...opponent };
  perks = [...perks];
  flyingPerkIcons = [...flyingPerkIcons];

  const toRemove = new Set<string>();

  // Helper: trigger mine explosion
  const triggerMineExplosion = (mine: Projectile) => {
    toRemove.add(mine.id);
    const radius = mine.mineRadius || MINE_EXPLOSION_RADIUS;
    mineExplosions.push({
      id: `mexp_${mine.id}`,
      x: mine.x,
      y: mine.y,
      radius,
      startTime: state.timer,
    });
    // Area damage to both ships
    const playerY = SHIP_Y_PLAYER;
    const opponentY = SHIP_Y_OPPONENT;
    const distToPlayer = Math.hypot(mine.x - player.x, mine.y - playerY);
    const distToOpponent = Math.hypot(mine.x - opponent.x, mine.y - opponentY);
    if (distToPlayer < radius && player.zLevel === "normal") {
      if (player.shieldActive) {
        player = { ...player, shieldRecoil: 1, heat: Math.min(player.maxHeat, player.heat + SHIELD_HEAT_FACTOR * mine.dmg) };
      } else if (player.ricochetActive) {
        player = { ...player, shieldRecoil: 1, heat: Math.min(player.maxHeat, player.heat + RICOCHET_HEAT_FACTOR * mine.dmg) };
      } else if (player.isoSphereActive) {
        const healAmount = Math.round(ISOSPHERE_HEAL_FACTOR * mine.dmg);
        player = { ...player, shieldRecoil: 1, hp: Math.min(player.maxHp, player.hp + healAmount), heat: Math.min(player.maxHeat, player.heat + ISOSPHERE_HEAT_FACTOR * mine.dmg) };
      } else if (player.regenXActive) {
        const coolAmount = Math.round(REGENX_COOL_FACTOR * mine.dmg);
        player = { ...player, shieldRecoil: 1, heat: Math.max(0, player.heat - coolAmount), hp: Math.max(0, player.hp - REGENX_DMG_FACTOR * mine.dmg) };
      } else {
        player = { ...player, hp: Math.max(0, player.hp - mine.dmg) };
      }
    }
    if ((!state.campaignState || state.campaignState.bossPhase === "opponent") && distToOpponent < radius && opponent.zLevel === "normal") {
      if (opponent.shieldActive) {
        opponent = { ...opponent, shieldRecoil: 1, heat: Math.min(opponent.maxHeat, opponent.heat + SHIELD_HEAT_FACTOR * mine.dmg) };
      } else if (opponent.ricochetActive) {
        opponent = { ...opponent, shieldRecoil: 1, heat: Math.min(opponent.maxHeat, opponent.heat + RICOCHET_HEAT_FACTOR * mine.dmg) };
      } else if (opponent.isoSphereActive) {
        const healAmount = Math.round(ISOSPHERE_HEAL_FACTOR * mine.dmg);
        opponent = { ...opponent, shieldRecoil: 1, hp: Math.min(opponent.maxHp, opponent.hp + healAmount), heat: Math.min(opponent.maxHeat, opponent.heat + ISOSPHERE_HEAT_FACTOR * mine.dmg) };
      } else if (opponent.regenXActive) {
        const coolAmount = Math.round(REGENX_COOL_FACTOR * mine.dmg);
        opponent = { ...opponent, shieldRecoil: 1, heat: Math.max(0, opponent.heat - coolAmount), hp: Math.max(0, opponent.hp - REGENX_DMG_FACTOR * mine.dmg) };
      } else {
        opponent = { ...opponent, hp: Math.max(0, opponent.hp - mine.dmg) };
      }
    }
  };

  // Check armed mines: timer expired or proximity to ships
  for (let i = 0; i < projectiles.length; i++) {
    const p = projectiles[i];
    if (!p.isMine || !p.mineArmed || toRemove.has(p.id)) continue;

    // Timer expired
    if ((p.mineTimer || 0) <= 0) {
      triggerMineExplosion(p);
      continue;
    }

    // Proximity to player ship
    const distPlayer = Math.hypot(p.x - player.x, p.y - SHIP_Y_PLAYER);
    if (distPlayer < SHIP_WIDTH / 2 + 12) {
      triggerMineExplosion(p);
      continue;
    }

    // Proximity to opponent ship (skip in campaign/infinity — no real opponent)
    if (!state.campaignState) {
      const distOpp = Math.hypot(p.x - opponent.x, p.y - SHIP_Y_OPPONENT);
      if (distOpp < SHIP_WIDTH / 2 + 12) {
        triggerMineExplosion(p);
        continue;
      }
    }
  }

  for (let i = 0; i < projectiles.length; i++) {
    const p = projectiles[i];
    if (toRemove.has(p.id)) continue;

    // Skip mines in flight (not armed) — they fly over obstacles
    if (p.isMine && !p.mineArmed) continue;
    // Skip armed mines (handled above)
    if (p.isMine && p.mineArmed) continue;
    // Skip delayed projectiles (Trident stagger)
    if (p.spawnDelay !== undefined && p.spawnDelay > 0) continue;

    // In campaign/infinity modes, skip player projectiles hitting the dummy opponent
    // but still allow perk collisions below
    const skipOpponentHit = !!(state.campaignState && state.campaignState.bossPhase !== "opponent" && p.owner === "player");

    if (!skipOpponentHit) {
      const target = p.owner === "player" ? opponent : player;
      const targetY = p.owner === "player" ? SHIP_Y_OPPONENT : SHIP_Y_PLAYER;

      // IsoSphere shield check — absorbs + heals 20% dmg as HP + 35% heat
      if (target.isoSphereActive) {
        const distToShip = Math.hypot(p.x - target.x, p.y - targetY);
        if (distToShip < SHIELD_RADIUS + 5) {
          const healAmount = Math.round(ISOSPHERE_HEAL_FACTOR * p.dmg);
          const heatAdd = ISOSPHERE_HEAT_FACTOR * p.dmg;
          if (p.owner === "player") {
            opponent = { ...opponent, shieldRecoil: 1, hp: Math.min(opponent.maxHp, opponent.hp + healAmount), heat: Math.min(opponent.maxHeat, opponent.heat + heatAdd) };
          } else {
            player = { ...player, shieldRecoil: 1, hp: Math.min(player.maxHp, player.hp + healAmount), heat: Math.min(player.maxHeat, player.heat + heatAdd) };
          }
          toRemove.add(p.id);
          continue;
        }
      }

      // RegenX shield check — absorbs + cools 25% dmg as heat, 25% dmg sustained
      if (target.regenXActive) {
        const distToShip = Math.hypot(p.x - target.x, p.y - targetY);
        if (distToShip < SHIELD_RADIUS + 5) {
          const coolAmount = Math.round(REGENX_COOL_FACTOR * p.dmg);
          const hpCost = REGENX_DMG_FACTOR * p.dmg;
          if (p.owner === "player") {
            opponent = { ...opponent, shieldRecoil: 1, heat: Math.max(0, opponent.heat - coolAmount), hp: Math.max(0, opponent.hp - hpCost) };
          } else {
            player = { ...player, shieldRecoil: 1, heat: Math.max(0, player.heat - coolAmount), hp: Math.max(0, player.hp - hpCost) };
          }
          toRemove.add(p.id);
          continue;
        }
      }

      // Ricochet shield check (reflects projectiles back + adds heat)
      if (target.ricochetActive) {
        const distToShip = Math.hypot(p.x - target.x, p.y - targetY);
        if (distToShip < SHIELD_RADIUS + 5) {
          const heatAdd = RICOCHET_HEAT_FACTOR * p.dmg;
          const reflected = { ...p };
          reflected.vx = -reflected.vx;
          reflected.vy = -reflected.vy;
          reflected.owner = p.owner === "player" ? "opponent" : "player";
          reflected.dmg = Math.round(p.dmg * RICOCHET_DAMAGE_MULTIPLIER);
          if (reflected.type === "Missile") {
            reflected.arcProgress = undefined;
            reflected.startX = undefined;
            reflected.startY = undefined;
            reflected.targetX = undefined;
            reflected.targetY = undefined;
            reflected.controlX = undefined;
            reflected.controlY = undefined;
            const speed = (reflected.spd / 100) * SHIP_DISTANCE;
            reflected.vy = p.owner === "player" ? speed : -speed;
            reflected.vx = 0;
          }
          projectiles[i] = reflected;
          if (p.owner === "player") {
            opponent = { ...opponent, shieldRecoil: 1, heat: Math.min(opponent.maxHeat, opponent.heat + heatAdd) };
          } else {
            player = { ...player, shieldRecoil: 1, heat: Math.min(player.maxHeat, player.heat + heatAdd) };
          }
          continue;
        }
      }

      // Regular shield check (absorbs projectile + 20% heat)
      if (target.shieldActive) {
        const distToShip = Math.hypot(p.x - target.x, p.y - targetY);
        if (distToShip < SHIELD_RADIUS + 5) {
          const heatAdd = SHIELD_HEAT_FACTOR * p.dmg;
          toRemove.add(p.id);
          if (p.owner === "player") {
            opponent = { ...opponent, shieldRecoil: 1, heat: Math.min(opponent.maxHeat, opponent.heat + heatAdd) };
          } else {
            player = { ...player, shieldRecoil: 1, heat: Math.min(player.maxHeat, player.heat + heatAdd) };
          }
          continue;
        }
      }

      // Z-level dodge
      if (target.zLevel !== "normal") {
        continue;
      }

      // Hit check
      const hitDist = Math.hypot(p.x - target.x, p.y - targetY);
      if (hitDist < SHIP_WIDTH / 2 + 8) {
        if (p.owner === "player") {
          opponent = { ...opponent, hp: Math.max(0, opponent.hp - p.dmg) };
        } else {
          player = { ...player, hp: Math.max(0, player.hp - p.dmg) };

          const playerBeamIdx = activeBeams.findIndex(b => b.owner === "player" && !b.reflected && (b.active || b.charging));
          if (playerBeamIdx >= 0) {
            activeBeams = activeBeams.map((b, idx) => {
              if (idx === playerBeamIdx) {
                return { ...b, draining: true, active: false, charging: false, drainProgress: 0 };
              }
              return b;
            });
            activeBeams = activeBeams.filter(b => !(b.reflected && b.owner === "opponent"));
          }
        }

        const hitOwner = p.owner === "player" ? "opponent" : "player";
        const hitBeamIdx = activeBeams.findIndex(b => b.owner === hitOwner && !b.reflected && (b.active || b.charging));
        if (hitBeamIdx >= 0) {
          activeBeams = activeBeams.map((b, idx) => {
            if (idx === hitBeamIdx) {
              return { ...b, draining: true, active: false, charging: false, drainProgress: 0 };
            }
            return b;
          });
          activeBeams = activeBeams.filter(b => {
            if (b.reflected && b.owner !== hitOwner) return false;
            return true;
          });
        }

        toRemove.add(p.id);
        continue;
      }

      // Missile vs other projectiles
      if (p.type === "Missile") {
        for (let j = 0; j < projectiles.length; j++) {
          if (i === j || toRemove.has(projectiles[j].id)) continue;
          const other = projectiles[j];
          if (other.owner === p.owner) continue;
          const dist = Math.hypot(p.x - other.x, p.y - other.y);
          if (dist < 15) {
            const mp = { ...p, hp: p.hp - other.dmg };
            projectiles[i] = mp;
            toRemove.add(other.id);
            if (mp.hp <= 0) {
              toRemove.add(p.id);
            }
          }
        }
      }
    }

    // Projectile vs perks — damage perk HP, collect when destroyed
    for (let k = perks.length - 1; k >= 0; k--) {
      const perk = perks[k];
      const dist = Math.hypot(p.x - perk.x, p.y - perk.y);
      if (dist < PERK_SIZE) {
        // Subtract projectile damage from perk HP
        const updatedPerk = { ...perk, hp: perk.hp - p.dmg };
        if (updatedPerk.hp <= 0) {
          // Perk destroyed — apply stat boost and create flying icon
          const ship = p.owner === "player" ? player : opponent;
          const value = PERK_RARITY_VALUES[perk.rarity];
          if (perk.type === "hp") ship.hp = Math.min(ship.maxHp, ship.hp + value);
          if (perk.type === "heat") ship.heat = Math.max(0, ship.heat - value);
          if (perk.type === "fuel") ship.fuel = Math.min(ship.maxFuel, ship.fuel + value);
          if (p.owner === "player") player = { ...ship };
          else opponent = { ...ship };

          // Add flying perk icon
          const flyingIcon: FlyingPerkIcon = {
            id: `fly_${perk.id}`,
            type: perk.type,
            owner: p.owner,
            startX: perk.x,
            startY: perk.y,
            startTime: state.timer,
            rarity: perk.rarity,
          };
          flyingPerkIcons = [...flyingPerkIcons, flyingIcon];

          perks.splice(k, 1);
        } else {
          perks[k] = updatedPerk;
        }
        // Projectiles pass through perks (no toRemove)
        break;
      }
    }
  }

  projectiles = projectiles.filter((p) => !toRemove.has(p.id));

  return { ...state, projectiles, player, opponent, perks, activeBeams, flyingPerkIcons, mineExplosions };
}

function handlePerks(state: GameState, dtSec: number): GameState {
  let { perks, nextPerkSpawn, timer } = state;
  perks = [...perks];

  perks = perks.filter((p) => timer - p.spawnTime < PERK_LIFETIME);

  if (timer >= nextPerkSpawn) {
    const types: PerkType[] = ["hp", "heat", "fuel"];
    const rarity = rollPerkRarity();
    const hp = PERK_HP[rarity];
    perks.push({
      id: `perk_${Date.now()}`,
      x: 60 + Math.random() * (ARENA_WIDTH - 120),
      y: 200 + Math.random() * (ARENA_HEIGHT - 400),
      type: types[Math.floor(Math.random() * types.length)],
      rarity,
      spawnTime: timer,
      hp,
      maxHp: hp,
    });
    const next = PERK_SPAWN_MIN + Math.random() * (PERK_SPAWN_MAX - PERK_SPAWN_MIN);
    return { ...state, perks, nextPerkSpawn: timer + next };
  }

  return { ...state, perks };
}

/**
 * Fire a weapon. Returns unchanged state if:
 * - weapon on cooldown
 * - ship is heat purging
 * - ship is in dive/soar (evasion mode)
 * Shield/Ricochet are no longer handled here — managed as hold-to-activate in Battle.tsx
 * Phaser creates a beam state instead of a projectile
 */
export function tryFireWeapon(
  state: GameState,
  weaponIndex: number,
  owner: "player" | "opponent",
  targetX?: number,
  targetY?: number
): GameState {
  const ship = owner === "player" ? state.player : state.opponent;
  const weapons = owner === "player" ? state.playerWeapons : state.opponentWeapons;
  const weapon = weapons[weaponIndex];

  if (!weapon || weapon.currentCooldown > 0) return state;
  if (ship.isHeatPurging) return state;
  if (ship.zLevel !== "normal") return state;
  if (weapon.name === "Shield" || weapon.name === "Ricochet" || weapon.name === "IsoSphere" || weapon.name === "RegenX") return state;

  // RadixR4: create shockwave instead of projectile
  if (weapon.name === "RadixR4") {
    const shipY = owner === "player" ? SHIP_Y_PLAYER : SHIP_Y_OPPONENT;
    const newHeat = Math.min(ship.maxHeat, ship.heat + weapon.heat);
    const newShip = { ...ship, heat: newHeat };
    const newWeapons = weapons.map((w, i) =>
      i === weaponIndex ? { ...w, currentCooldown: w.cooldown > 0 ? w.cooldown : (w.fireRate > 0 ? 1 / w.fireRate : 0), lastFired: state.timer } : w
    );

    const shockwave: Shockwave = {
      id: `sw_${nextProjectileId()}`,
      owner,
      x: ship.x,
      y: shipY,
      startTime: state.timer,
      dmg: weapon.dmg,
      maxRadius: RADIX_SHOCKWAVE_MAX_RADIUS,
      fadingOut: false,
      fadeStartTime: 0,
      hitShip: false,
      hitAsteroids: new Set<string>(),
    };

    const newShockwaves = [...(state.shockwaves || []), shockwave];

    if (owner === "player") {
      return { ...state, player: newShip, playerWeapons: newWeapons, shockwaves: newShockwaves };
    }
    return { ...state, opponent: newShip, opponentWeapons: newWeapons, shockwaves: newShockwaves };
  }

  // Phaser: create beam in charging state (mobile during charge)
  if (weapon.name === "Phaser") {
    // Don't fire if this owner already has an active beam
    if (state.activeBeams.some(b => b.owner === owner && !b.reflected)) return state;

    const newHeat = Math.min(ship.maxHeat, ship.heat + weapon.heat);
    const newShip = { ...ship, heat: newHeat };
    const newWeapons = weapons.map((w, i) =>
      i === weaponIndex ? { ...w, currentCooldown: w.cooldown > 0 ? w.cooldown : (w.fireRate > 0 ? 1 / w.fireRate : 0), lastFired: state.timer } : w
    );

    const beam: ActiveBeam = {
      owner,
      x: ship.x,
      startTime: state.timer,
      progress: 0,
      duration: PHASER_BEAM_DURATION,
      active: false,
      charging: true,
      chargeStart: state.timer,
      elapsed: 0,
      baseDmg: weapon.dmg,
      spd: weapon.spd,
    };

    const newBeams = [...state.activeBeams, beam];

    if (owner === "player") {
      return { ...state, player: newShip, playerWeapons: newWeapons, activeBeams: newBeams };
    }
    return { ...state, opponent: newShip, opponentWeapons: newWeapons, activeBeams: newBeams };
  }

  const proj = createProjectile(weapon, ship, owner, targetX, targetY);
  if (!proj) return state;

  const newHeat = Math.min(ship.maxHeat, ship.heat + weapon.heat);
  const newShip = { ...ship, heat: newHeat };
  const newWeapons = weapons.map((w, i) =>
    i === weaponIndex ? { ...w, currentCooldown: w.cooldown > 0 ? w.cooldown : (w.fireRate > 0 ? 1 / w.fireRate : 0), lastFired: state.timer } : w
  );

  // Flatten: createProjectile returns Projectile | Projectile[] for Trident
  const newProjectiles = Array.isArray(proj)
    ? [...state.projectiles, ...proj]
    : [...state.projectiles, proj];

  if (owner === "player") {
    return { ...state, player: newShip, playerWeapons: newWeapons, projectiles: newProjectiles };
  }
  return { ...state, opponent: newShip, opponentWeapons: newWeapons, projectiles: newProjectiles };
}

/**
 * Release a charging Phaser beam — transitions from charging to active (firing).
 * Called on trigger release. If no charging beam exists, no-op.
 */
export function releasePhaserBeam(
  state: GameState,
  owner: "player" | "opponent"
): GameState {
  const beamIdx = state.activeBeams.findIndex(b => b.owner === owner && b.charging && !b.reflected);
  if (beamIdx < 0) return state;

  const newBeams = state.activeBeams.map((b, i) => {
    if (i === beamIdx) {
      return { ...b, charging: false, active: true, startTime: state.timer, elapsed: 0 };
    }
    return b;
  });

  return { ...state, activeBeams: newBeams };
}
