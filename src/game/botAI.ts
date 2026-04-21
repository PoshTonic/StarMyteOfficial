import { GameState } from "./types";
import { tryFireWeapon } from "./gameLoop";
import { ARENA_WIDTH, FUEL_TRIGGER_Z } from "./constants";
import { BotDifficultyConfig, BOT_DIFFICULTY_PRESETS } from "./botDifficulty";

interface BotState {
  lastDecisionTime: number;
  targetX: number;
  dodging: boolean;
  dodgeTimer: number;
  shieldTimer: number;
  config: BotDifficultyConfig;
}

export function createBotState(config?: BotDifficultyConfig): BotState {
  return {
    lastDecisionTime: 0,
    targetX: ARENA_WIDTH / 2,
    dodging: false,
    dodgeTimer: 0,
    shieldTimer: 0,
    config: config || BOT_DIFFICULTY_PRESETS.medium,
  };
}

export function updateBotAI(
  state: GameState,
  botState: BotState,
  dt: number
): { newState: GameState; newBotState: BotState } {
  const dtSec = dt / 1000;
  let bs = { ...botState };
  let gs = { ...state };
  const cfg = bs.config;

  // Phaser auto-fires after charge — no manual release needed

  // --- Shield / defensive hold timer ---
  if (bs.shieldTimer > 0) {
    bs.shieldTimer -= dtSec;
    if (gs.opponent.zLevel === "normal" && !gs.opponent.isHeatPurging) {
      // Determine which defensive is active
      const hasShield = gs.opponentWeapons.find((w) => w.name === "Shield");
      const hasRicochet = gs.opponentWeapons.find((w) => w.name === "Ricochet");
      const hasIsoSphere = gs.opponentWeapons.find((w) => w.name === "IsoSphere");
      const hasRegenX = gs.opponentWeapons.find((w) => w.name === "RegenX");

      if (hasShield) {
        gs.opponent = { ...gs.opponent, shieldActive: true };
      } else if (hasRicochet) {
        gs.opponent = { ...gs.opponent, ricochetActive: true };
      } else if (hasIsoSphere) {
        gs.opponent = { ...gs.opponent, isoSphereActive: true };
      } else if (hasRegenX) {
        gs.opponent = { ...gs.opponent, regenXActive: true };
      }
    }
    if (bs.shieldTimer <= 0) {
      gs.opponent = { ...gs.opponent, shieldActive: false, ricochetActive: false, isoSphereActive: false, regenXActive: false };
      bs.shieldTimer = 0;
    }
  } else {
    // Ensure all defenses off when timer done
    if (gs.opponent.shieldActive || gs.opponent.ricochetActive || gs.opponent.isoSphereActive || gs.opponent.regenXActive) {
      gs.opponent = { ...gs.opponent, shieldActive: false, ricochetActive: false, isoSphereActive: false, regenXActive: false };
    }
  }

  // --- Undodge timer ---
  if (bs.dodging) {
    bs.dodgeTimer -= dtSec;
    if (bs.dodgeTimer <= 0) {
      gs.opponent = { ...gs.opponent, zLevel: "normal" };
      bs.dodging = false;
    }
  }

  // --- Decision making at configured reaction delay ---
  const reactionSec = cfg.reactionDelay / 1000;
  if (gs.timer - bs.lastDecisionTime > reactionSec) {
    bs.lastDecisionTime = gs.timer;

    // Skip all decisions when overheated
    if (gs.opponent.isHeatPurging) {
      return { newState: gs, newBotState: bs };
    }

    // Track player X with accuracy offset
    const offset = (Math.random() - 0.5) * cfg.aimAccuracy * 2;
    bs.targetX = gs.player.x + offset;
    bs.targetX = Math.max(30, Math.min(ARENA_WIDTH - 30, bs.targetX));

    // --- Defensive reactions ---
    const incomingMissiles = gs.projectiles.filter(
      (p) => p.owner === "player" && p.type === "Missile"
    );
    const hasDefensive = gs.opponentWeapons.some(
      (w) => w.name === "Shield" || w.name === "Ricochet" || w.name === "IsoSphere" || w.name === "RegenX"
    );

    if (incomingMissiles.length > 0 && Math.random() < cfg.shieldChance && bs.shieldTimer <= 0 && hasDefensive) {
      if (!gs.opponent.isHeatPurging && gs.opponent.zLevel === "normal") {
        bs.shieldTimer = 1.5;
      }
    }

    // --- Dodge incoming projectiles or shockwaves ---
    const incoming = gs.projectiles.filter(
      (p) => p.owner === "player" && p.type !== "Missile" && Math.abs(p.x - gs.opponent.x) < 30
    );
    const incomingShockwaves = (gs.shockwaves || []).filter(
      (sw) => sw.owner === "player" && !sw.fadingOut
    );
    const shouldDodge = incoming.length > 0 || incomingShockwaves.length > 0;
    if (shouldDodge && Math.random() < cfg.dodgeChance && gs.opponent.fuel >= cfg.fuelManagement && !bs.dodging) {
      gs.opponent = { ...gs.opponent, zLevel: Math.random() > 0.5 ? "dive" : "soar", shieldActive: false, ricochetActive: false, isoSphereActive: false, regenXActive: false, fuel: gs.opponent.fuel - FUEL_TRIGGER_Z };
      bs.dodging = true;
      bs.dodgeTimer = 0.5;
      bs.shieldTimer = 0;
    }

    // --- Fire weapons (only when zLevel normal and heat below threshold) ---
    if (gs.opponent.zLevel === "normal" && gs.opponent.heat < gs.opponent.maxHeat * cfg.heatThreshold && !gs.opponent.isHeatPurging) {
      for (let i = 0; i < gs.opponentWeapons.length; i++) {
        const w = gs.opponentWeapons[i];
        if (w.currentCooldown > 0) continue;

        // Skip defensives (handled via shield timer)
        if (w.name === "Shield" || w.name === "Ricochet" || w.name === "IsoSphere" || w.name === "RegenX") continue;

        const fireRoll = Math.random();

        switch (w.name) {
          case "Machine Gun":
          case "Blaster":
          case "Dual-BB":
            // Rapid fire weapons — always fire when ready
            if (fireRoll < cfg.aggressiveness) {
              gs = tryFireWeapon(gs, i, "opponent");
            }
            break;

          case "Cannon":
          case "Trident":
            // Single shot weapons — fire with some probability
            if (fireRoll < cfg.aggressiveness * 0.7) {
              gs = tryFireWeapon(gs, i, "opponent");
            }
            break;

          case "RadixR4":
            // Shockwave — fire with moderate probability
            if (fireRoll < cfg.aggressiveness * 0.6) {
              gs = tryFireWeapon(gs, i, "opponent");
            }
            break;

          case "Missile":
            // Targeted weapon — fire at player position
            if (fireRoll < cfg.aggressiveness * 0.5) {
              gs = tryFireWeapon(gs, i, "opponent", gs.player.x, gs.player.y);
            }
            break;

          case "Mine":
            // Targeted weapon — fire at player position
            if (fireRoll < cfg.aggressiveness * 0.4) {
              gs = tryFireWeapon(gs, i, "opponent", gs.player.x, gs.player.y);
            }
            break;

          case "Phaser":
            // Start charge — beam auto-fires after charge time
            if (!gs.activeBeams.some(b => b.owner === "opponent" && !b.reflected)) {
              if (fireRoll < cfg.aggressiveness * 0.5) {
                gs = tryFireWeapon(gs, i, "opponent");
              }
            }
            break;
        }
      }
    }
  }

  // Move opponent toward target (skip if actively firing Phaser)
  const hasActiveBeam = gs.activeBeams.some(b => b.active && b.owner === "opponent" && !b.reflected);
  if (!hasActiveBeam) {
    gs.opponent = { ...gs.opponent, targetX: bs.targetX };
  }

  return { newState: gs, newBotState: bs };
}
