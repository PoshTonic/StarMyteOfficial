import { GameState, Projectile, Perk, Ship, Asteroid, ActiveBeam, MineExplosion, Shockwave, EndingInfo, AsteroidExplosion, AsteroidType } from "./types";
import { getShipImages } from "./shipAssets";
import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  CANVAS_BLEED,
  SHIP_Y_PLAYER,
  SHIP_Y_OPPONENT,
  SHIELD_RADIUS,
  PERK_SIZE,
  PROJECTILE_CONFIGS,
  PHASER_BEAM_WIDTH,
  PHASER_BEAM_DURATION,
  PERK_RARITY_COLORS,
  MINE_EXPLOSION_DURATION,
  RADIX_SHOCKWAVE_SPEED,
  RADIX_SHOCKWAVE_FADE_DURATION,
  PerkRarity,
} from "./constants";

const stars: { x: number; y: number; r: number; phase: number }[] = [];
for (let i = 0; i < 80; i++) {
  stars.push({
    x: Math.random() * ARENA_WIDTH,
    y: Math.random() * ARENA_HEIGHT,
    r: Math.random() * 1.2 + 0.3,
    phase: Math.random() * Math.PI * 2,
  });
}

const SHIP_RENDER_SIZE = 66;

export function render(ctx: CanvasRenderingContext2D, state: GameState, time: number) {
  const CW = ARENA_WIDTH + CANVAS_BLEED * 2;
  ctx.clearRect(0, 0, CW, ARENA_HEIGHT);

  ctx.fillStyle = "hsl(222, 47%, 6%)";
  ctx.fillRect(0, 0, CW, ARENA_HEIGHT);

  // Offset all drawing by CANVAS_BLEED so arena x=0 starts at pixel CANVAS_BLEED
  ctx.save();
  ctx.translate(CANVAS_BLEED, 0);

  stars.forEach((s) => {
    const o = 0.3 + 0.5 * Math.abs(Math.sin(time * 0.001 * 0.2 + s.phase));
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(199, 89%, 80%, ${o})`;
    ctx.fill();
  });
  // Draw campaign asteroids
  if (state.campaignState?.asteroids) {
    state.campaignState.asteroids.forEach((a) => drawAsteroid(ctx, a, time));
  }

  // Draw asteroid death explosions on top of asteroids
  if (state.asteroidExplosions && state.asteroidExplosions.length > 0) {
    state.asteroidExplosions.forEach((ex) => drawAsteroidExplosion(ctx, ex, state.timer));
  }

  state.perks.forEach((p) => drawPerk(ctx, p, time));

  // In campaign mode, only show opponent during boss "opponent" phase
  const showOpponent = !state.campaignState || state.campaignState.bossPhase === "opponent";

  // During ending phase, determine which ship is dying and whether to hide it
  const ending = state.endingInfo;
  const endingElapsed = ending ? state.timer - ending.startTime : 0;
  const dyingIsOpponent = ending?.result === "victory";
  const hideDyingShip = ending && endingElapsed >= 1.5;

  const zOrder: { ship: Ship; y: number; isOpponent: boolean; shipName: string; skinColours?: Record<string, string>; skinId?: string; jetSkinColours?: Record<string, string>; jetSkinId?: string }[] = [
    ...(showOpponent ? [{ ship: state.opponent, y: SHIP_Y_OPPONENT, isOpponent: true, shipName: state.opponentShipName, skinColours: state.opponentSkinColours, skinId: state.opponentSkinId, jetSkinColours: state.opponentJetSkinColours, jetSkinId: state.opponentJetSkinId }] : []),
    { ship: state.player, y: SHIP_Y_PLAYER, isOpponent: false, shipName: state.playerShipName, skinColours: state.playerSkinColours, skinId: state.playerSkinId, jetSkinColours: state.playerJetSkinColours, jetSkinId: state.playerJetSkinId },
  ];

  // Filter out the dying ship if it should be hidden
  const visibleZOrder = zOrder.filter(e => {
    if (hideDyingShip && ending?.hasOpponent && e.isOpponent === dyingIsOpponent) return false;
    return true;
  });

  // Apply shake offset to the dying ship during ending
  const getShakeOffset = (isOpponent: boolean): { dx: number; dy: number } => {
    if (!ending || !ending.hasOpponent || endingElapsed >= 1.5) return { dx: 0, dy: 0 };
    if (isOpponent !== dyingIsOpponent) return { dx: 0, dy: 0 };
    const intensity = Math.min(8, 3 + endingElapsed * 4);
    return {
      dx: (Math.random() - 0.5) * intensity * 2,
      dy: (Math.random() - 0.5) * intensity * 2,
    };
  };

  visibleZOrder.filter(e => e.ship.zLevel === "dive").forEach(e => {
    const shake = getShakeOffset(e.isOpponent);
    const shaken = { ...e.ship, x: e.ship.x + shake.dx };
    drawShip(ctx, shaken, e.y + shake.dy, e.isOpponent, time, e.shipName, e.skinColours, e.skinId, e.jetSkinColours, e.jetSkinId);
  });
  state.projectiles.forEach((p) => drawProjectile(ctx, p, time));

  // Draw mine explosions — pass game timer for correct timing
  if (state.mineExplosions) {
    state.mineExplosions.forEach(exp => drawMineExplosion(ctx, exp, state.timer));
  }

  // Draw shockwaves
  if (state.shockwaves) {
    state.shockwaves.forEach(sw => drawShockwave(ctx, sw, state.timer, time));
  }

  // Draw beams (non-reflected first, then reflected on top)
  const nonReflectedBeams = state.activeBeams.filter(b => !b.reflected);
  const reflectedBeams = state.activeBeams.filter(b => b.reflected);
  nonReflectedBeams.forEach(beam => drawBeam(ctx, beam, state, time));

  visibleZOrder.filter(e => e.ship.zLevel === "normal").forEach(e => {
    const shake = getShakeOffset(e.isOpponent);
    const shaken = { ...e.ship, x: e.ship.x + shake.dx };
    drawShip(ctx, shaken, e.y + shake.dy, e.isOpponent, time, e.shipName, e.skinColours, e.skinId, e.jetSkinColours, e.jetSkinId);
  });
  visibleZOrder.filter(e => e.ship.zLevel === "soar").forEach(e => {
    const shake = getShakeOffset(e.isOpponent);
    const shaken = { ...e.ship, x: e.ship.x + shake.dx };
    drawShip(ctx, shaken, e.y + shake.dy, e.isOpponent, time, e.shipName, e.skinColours, e.skinId, e.jetSkinColours, e.jetSkinId);
  });

  // Draw reflected beams on top (higher z-layer)
  reflectedBeams.forEach(beam => drawReflectedBeam(ctx, beam, state, time));

  // Draw clash power ball if two beams are clashing
  const playerBeam = nonReflectedBeams.find(b => b.owner === "player");
  const opponentBeam = nonReflectedBeams.find(b => b.owner === "opponent");
  if (playerBeam?.active && opponentBeam?.active && playerBeam.clashY !== undefined) {
    drawClashPowerBall(ctx, playerBeam, opponentBeam, time);
  }

  // Draw ending phase effects (explosions + text)
  if (state.phase === "ending" && ending) {
    drawEndingEffects(ctx, ending, state.timer, time);
  }

  if (state.phase === "countdown") {
    ctx.font = "bold 72px Orbitron";
    ctx.fillStyle = "hsl(199, 89%, 48%)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const text = state.countdownValue > 0 ? String(state.countdownValue) : "GO!";
    ctx.fillText(text, ARENA_WIDTH / 2, ARENA_HEIGHT / 2);
  }

  ctx.restore(); // undo CANVAS_BLEED translate
}

function drawBeam(ctx: CanvasRenderingContext2D, beam: ActiveBeam, state: GameState, time: number) {
  const shipY = beam.owner === "player" ? SHIP_Y_PLAYER : SHIP_Y_OPPONENT;
  const direction = beam.owner === "player" ? -1 : 1;

  if (beam.charging) {
    const chargeProgress = Math.min(1, (state.timer - beam.chargeStart) / 0.5);
    const radius = 4 + chargeProgress * 6;
    const pulse = 0.5 + 0.5 * Math.sin(time * 0.015);

    ctx.save();
    ctx.globalAlpha = 0.6 + 0.4 * pulse;
    ctx.fillStyle = "hsl(270, 80%, 65%)";
    ctx.shadowColor = "hsl(270, 80%, 75%)";
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(beam.x, shipY + direction * 25, radius, 0, Math.PI * 2);
    ctx.fill();

    // Gathering energy particles — purple/pink circles flowing toward ship
    const particleCount = 8 + Math.floor(chargeProgress * 12);
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2 + time * 0.002;
      const maxDist = 40 + chargeProgress * 30;
      const t = ((time * 0.003 + i * 0.4) % 1);
      const dist = maxDist * (1 - t);
      const px = beam.x + Math.cos(angle) * dist;
      const py = shipY + direction * 25 + Math.sin(angle) * dist;
      const pSize = 1 + t * 3;
      const pAlpha = t * 0.7;

      const hue = i % 2 === 0 ? 270 : 320; // purple / pink alternating
      ctx.globalAlpha = pAlpha * (0.5 + 0.5 * pulse);
      ctx.fillStyle = `hsl(${hue}, 80%, 70%)`;
      ctx.shadowColor = `hsl(${hue}, 80%, 80%)`;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(px, py, pSize, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    return;
  }

  if (beam.active || beam.draining) {
    const beamLength = beam.progress * ARENA_HEIGHT;
    let startY = shipY;
    let endY = startY + direction * beamLength;

    // If clashing, stop at clash point
    if (beam.clashY !== undefined && !beam.draining) {
      endY = beam.clashY;
    }

    // If draining, retract the start (ship end) toward the far end
    if (beam.draining && beam.drainProgress !== undefined) {
      const drainRatio = Math.min(1, beam.drainProgress / (beam.progress || 1));
      startY = startY + (endY - startY) * drainRatio;
    }

    const dmgTier = beam.elapsed <= PHASER_BEAM_DURATION
      ? Math.floor(beam.elapsed)
      : Math.floor(PHASER_BEAM_DURATION);
    const intensity = 0.6 + 0.4 * Math.min(1, dmgTier / 4);
    const pulse = 0.9 + 0.1 * Math.sin(time * 0.01);
    // Fade out during drain
    const drainAlpha = beam.draining && beam.drainProgress !== undefined
      ? Math.max(0, 1 - beam.drainProgress / (beam.progress || 1))
      : 1;

    ctx.save();

    // Outer glow
    ctx.globalAlpha = 0.15 * intensity * pulse * drainAlpha;
    ctx.strokeStyle = "hsl(270, 80%, 60%)";
    ctx.lineWidth = PHASER_BEAM_WIDTH * 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(beam.x, startY);
    ctx.lineTo(beam.x, endY);
    ctx.stroke();

    // Mid glow
    ctx.globalAlpha = 0.4 * intensity * pulse * drainAlpha;
    ctx.strokeStyle = "hsl(270, 80%, 65%)";
    ctx.lineWidth = PHASER_BEAM_WIDTH * 1.5;
    ctx.beginPath();
    ctx.moveTo(beam.x, startY);
    ctx.lineTo(beam.x, endY);
    ctx.stroke();

    // Core
    ctx.globalAlpha = 0.9 * pulse * drainAlpha;
    ctx.strokeStyle = "hsl(270, 90%, 80%)";
    ctx.shadowColor = "hsl(270, 80%, 75%)";
    ctx.shadowBlur = 12;
    ctx.lineWidth = PHASER_BEAM_WIDTH / 2;
    ctx.beginPath();
    ctx.moveTo(beam.x, startY);
    ctx.lineTo(beam.x, endY);
    ctx.stroke();

    ctx.restore();
  }
}

function drawReflectedBeam(ctx: CanvasRenderingContext2D, beam: ActiveBeam, state: GameState, time: number) {
  if (!beam.active || !beam.reflected) return;

  // Reflected beam goes from the defender toward the original firer
  const defenderY = beam.owner === "player" ? SHIP_Y_PLAYER : SHIP_Y_OPPONENT;
  const firerY = beam.owner === "player" ? SHIP_Y_OPPONENT : SHIP_Y_PLAYER;
  const startY = defenderY;
  const direction = beam.owner === "player" ? -1 : 1;
  const endY = firerY;
  const beamX = beam.reflectedFromX || beam.x;

  const pulse = 0.9 + 0.1 * Math.sin(time * 0.012);

  ctx.save();

  // Outer glow — blue
  ctx.globalAlpha = 0.15 * pulse;
  ctx.strokeStyle = "hsl(210, 90%, 55%)";
  ctx.lineWidth = PHASER_BEAM_WIDTH * 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(beamX, startY);
  ctx.lineTo(beamX, endY);
  ctx.stroke();

  // Mid glow
  ctx.globalAlpha = 0.4 * pulse;
  ctx.strokeStyle = "hsl(210, 90%, 65%)";
  ctx.lineWidth = PHASER_BEAM_WIDTH * 1.2;
  ctx.beginPath();
  ctx.moveTo(beamX, startY);
  ctx.lineTo(beamX, endY);
  ctx.stroke();

  // Core
  ctx.globalAlpha = 0.85 * pulse;
  ctx.strokeStyle = "hsl(210, 95%, 80%)";
  ctx.shadowColor = "hsl(210, 90%, 75%)";
  ctx.shadowBlur = 12;
  ctx.lineWidth = PHASER_BEAM_WIDTH / 2.5;
  ctx.beginPath();
  ctx.moveTo(beamX, startY);
  ctx.lineTo(beamX, endY);
  ctx.stroke();

  ctx.restore();
}

function drawClashPowerBall(ctx: CanvasRenderingContext2D, playerBeam: ActiveBeam, opponentBeam: ActiveBeam, time: number) {
  const clashY = playerBeam.clashY!;
  const clashX = (playerBeam.x + opponentBeam.x) / 2;

  ctx.save();

  // Pulsing power ball
  const basePulse = 0.7 + 0.3 * Math.sin(time * 0.008);
  const sizePulse = 1 + 0.3 * Math.sin(time * 0.006);
  const radius = (PHASER_BEAM_WIDTH * 1.5) * sizePulse;

  // White-yellow radial gradient
  const grad = ctx.createRadialGradient(clashX, clashY, 0, clashX, clashY, radius);
  grad.addColorStop(0, "hsla(50, 100%, 95%, 0.95)");
  grad.addColorStop(0.3, "hsla(45, 100%, 80%, 0.7)");
  grad.addColorStop(0.6, "hsla(40, 100%, 60%, 0.4)");
  grad.addColorStop(1, "hsla(30, 100%, 50%, 0)");

  ctx.globalAlpha = basePulse;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(clashX, clashY, radius, 0, Math.PI * 2);
  ctx.fill();

  // Inner bright core
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "hsla(60, 100%, 95%, 0.9)";
  ctx.shadowColor = "hsl(50, 100%, 80%)";
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(clashX, clashY, radius * 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Spark particles
  ctx.shadowBlur = 0;
  const sparkCount = 8;
  for (let i = 0; i < sparkCount; i++) {
    const angle = (time * 0.003 + i * (Math.PI * 2 / sparkCount)) % (Math.PI * 2);
    const sparkDist = radius * (0.8 + 0.6 * Math.sin(time * 0.01 + i * 1.5));
    const sx = clashX + Math.cos(angle) * sparkDist;
    const sy = clashY + Math.sin(angle) * sparkDist;
    const sparkSize = 1.5 + Math.sin(time * 0.015 + i) * 1;

    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 0.012 + i);
    ctx.fillStyle = i % 2 === 0 ? "hsl(50, 100%, 85%)" : "hsl(30, 100%, 70%)";
    ctx.beginPath();
    ctx.arc(sx, sy, sparkSize, 0, Math.PI * 2);
    ctx.fill();
  }

  // Additional flying sparks at random angles
  for (let i = 0; i < 4; i++) {
    const seed = i * 2.7 + 0.5;
    const angle = (time * 0.005 * (1 + i * 0.3) + seed) % (Math.PI * 2);
    const dist = radius * (1.2 + 0.8 * Math.sin(time * 0.008 + seed));
    const sx = clashX + Math.cos(angle) * dist;
    const sy = clashY + Math.sin(angle) * dist;

    ctx.globalAlpha = 0.3 + 0.3 * Math.sin(time * 0.02 + seed);
    ctx.fillStyle = "hsl(45, 100%, 90%)";
    ctx.beginPath();
    ctx.arc(sx, sy, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawShip(ctx: CanvasRenderingContext2D, ship: Ship, baseY: number, isOpponent: boolean, time: number, shipName: string, skinColours?: Record<string, string>, skinId?: string, jetSkinColours?: Record<string, string>, jetSkinId?: string) {
  const images = getShipImages(shipName || "AX15", skinColours, skinId, jetSkinColours, jetSkinId);

  ctx.save();
  ctx.translate(ship.x, baseY);

  let scale = 1;
  let alpha = 1;
  if (ship.zLevel === "dive") {
    scale = 0.75;
    alpha = 0.5;
  } else if (ship.zLevel === "soar") {
    scale = 1.15;
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(0, 15, 20, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = alpha;
  ctx.scale(scale, scale);
  if (isOpponent) ctx.scale(1, -1);

  const halfW = SHIP_RENDER_SIZE / 2;
  const halfH = SHIP_RENDER_SIZE / 2;

  if (ship.flameOpacity > 0.01) {
    ctx.save();
    const pulse = 1 + 0.05 * Math.sin(time * 0.025);
    ctx.globalAlpha = alpha * ship.flameOpacity;
    ctx.scale(1, pulse);
    ctx.drawImage(images.flames, -halfW, -halfH, SHIP_RENDER_SIZE, SHIP_RENDER_SIZE);
    ctx.restore();
  }

  ctx.drawImage(images.hull, -halfW, -halfH, SHIP_RENDER_SIZE, SHIP_RENDER_SIZE);
  ctx.restore();

  // Regular shield (blue)
  if (ship.shieldActive) {
    const recoilOffset = ship.shieldRecoil * 3;
    const radius = SHIELD_RADIUS + recoilOffset;
    ctx.save();
    ctx.globalAlpha = 0.25 + ship.shieldRecoil * 0.2;
    ctx.strokeStyle = "hsl(199, 89%, 60%)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ship.x, baseY, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "hsla(199, 89%, 48%, 0.08)";
    ctx.fill();
    ctx.restore();
  }

  // Ricochet shield (purple)
  if (ship.ricochetActive) {
    const recoilOffset = ship.shieldRecoil * 3;
    const radius = SHIELD_RADIUS + recoilOffset;
    ctx.save();
    ctx.globalAlpha = 0.25 + ship.shieldRecoil * 0.2;
    ctx.strokeStyle = "hsl(270, 80%, 60%)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ship.x, baseY, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "hsla(270, 80%, 48%, 0.08)";
    ctx.fill();
    ctx.restore();
  }

  // IsoSphere shield (red)
  if (ship.isoSphereActive) {
    const recoilOffset = ship.shieldRecoil * 3;
    const radius = SHIELD_RADIUS + recoilOffset;
    ctx.save();
    ctx.globalAlpha = 0.25 + ship.shieldRecoil * 0.2;
    ctx.strokeStyle = "hsl(0, 80%, 55%)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ship.x, baseY, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "hsla(0, 80%, 48%, 0.08)";
    ctx.fill();
    ctx.restore();
  }

  // RegenX shield (green)
  if (ship.regenXActive) {
    const recoilOffset = ship.shieldRecoil * 3;
    const radius = SHIELD_RADIUS + recoilOffset;
    ctx.save();
    ctx.globalAlpha = 0.25 + ship.shieldRecoil * 0.2;
    ctx.strokeStyle = "hsl(142, 71%, 45%)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ship.x, baseY, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "hsla(142, 71%, 45%, 0.08)";
    ctx.fill();
    ctx.restore();
  }

  if (ship.isHeatPurging) {
    const pulse = 0.3 + 0.2 * Math.sin(time * 0.008);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = "hsl(0, 80%, 50%)";
    ctx.beginPath();
    ctx.arc(ship.x, baseY, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile, time: number) {
  // Skip delayed projectiles (Trident stagger)
  if (p.spawnDelay !== undefined && p.spawnDelay > 0) return;

  ctx.save();

  if (p.type === "Missile") {
    ctx.translate(p.x, p.y);
    if (p.arcProgress !== undefined && p.arcProgress > 0.01) {
      const angle = Math.atan2(p.y - (p.startY || p.y), p.x - (p.startX || p.x));
      ctx.rotate(angle + Math.PI / 2);
    } else {
      ctx.rotate(p.owner === "player" ? 0 : Math.PI);
    }
    const cfg = PROJECTILE_CONFIGS.Missile;
    ctx.fillStyle = cfg.color;
    ctx.shadowColor = cfg.glowColor;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(5, 0);
    ctx.lineTo(7, 8);
    ctx.lineTo(0, 11);
    ctx.lineTo(-7, 8);
    ctx.lineTo(-5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "hsl(30, 90%, 60%)";
    ctx.beginPath();
    ctx.moveTo(-4, 11);
    ctx.lineTo(0, 16 + Math.random() * 4);
    ctx.lineTo(4, 11);
    ctx.closePath();
    ctx.fill();
  } else if (p.isMine) {
    // Mine projectile
    const radius = p.mineArmed ? 12 : 8;
    ctx.fillStyle = "hsl(0, 0%, 40%)";
    ctx.strokeStyle = "hsl(0, 0%, 85%)";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "hsl(0, 0%, 50%)";
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Flashing red LED dots
    const flash = Math.sin(time * 0.01) > 0 ? 1 : 0.3;
    ctx.fillStyle = `rgba(255, 50, 50, ${flash})`;
    const ledAngles = [0, 2.1, 4.2];
    ledAngles.forEach(angle => {
      const lx = p.x + Math.cos(angle) * radius * 0.5;
      const ly = p.y + Math.sin(angle) * radius * 0.5;
      ctx.beginPath();
      ctx.arc(lx, ly, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (p.type === "Trident") {
    const cfg = PROJECTILE_CONFIGS.Trident;
    ctx.fillStyle = cfg.color;
    ctx.shadowColor = cfg.glowColor;
    ctx.shadowBlur = 12;
    drawPill(ctx, p.x, p.y, cfg.width, cfg.height);
  } else if (p.type === "Cannon") {
    const cfg = PROJECTILE_CONFIGS.Cannon;
    ctx.fillStyle = cfg.color;
    ctx.shadowColor = cfg.glowColor;
    ctx.shadowBlur = 10;
    drawPill(ctx, p.x, p.y, cfg.width, cfg.height);
  } else if (p.type === "Machine Gun") {
    const cfg = PROJECTILE_CONFIGS["Machine Gun"];
    ctx.fillStyle = cfg.color;
    ctx.shadowColor = cfg.glowColor;
    ctx.shadowBlur = 6;
    drawPill(ctx, p.x, p.y, cfg.width, cfg.height);
  } else if (p.type === "Blaster") {
    const cfg = PROJECTILE_CONFIGS.Blaster;
    ctx.fillStyle = cfg.color;
    ctx.shadowColor = cfg.glowColor;
    ctx.shadowBlur = 12;
    drawPill(ctx, p.x, p.y, cfg.width, cfg.height);
  } else if (p.type === "Dual-BB") {
    const cfg = PROJECTILE_CONFIGS["Dual-BB"];
    ctx.fillStyle = cfg.color;
    ctx.shadowColor = cfg.glowColor;
    ctx.shadowBlur = 8;
    drawPill(ctx, p.x, p.y, cfg.width, cfg.height);
  }

  ctx.restore();
}

function drawMineExplosion(ctx: CanvasRenderingContext2D, exp: MineExplosion, gameTimer: number) {
  const elapsed = gameTimer - exp.startTime;
  const progress = Math.min(1, elapsed / MINE_EXPLOSION_DURATION);
  if (progress >= 1 || progress < 0) return;

  const radius = exp.radius * progress;
  const alpha = 1 - progress;

  ctx.save();
  const grad = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, radius);
  grad.addColorStop(0, `hsla(50, 100%, 90%, ${alpha * 0.9})`);
  grad.addColorStop(0.3, `hsla(30, 100%, 60%, ${alpha * 0.7})`);
  grad.addColorStop(0.7, `hsla(20, 100%, 50%, ${alpha * 0.3})`);
  grad.addColorStop(1, `hsla(15, 100%, 40%, 0)`);

  ctx.globalAlpha = alpha;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(exp.x, exp.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawShockwave(ctx: CanvasRenderingContext2D, sw: Shockwave, gameTimer: number, time: number) {
  const elapsed = gameTimer - sw.startTime;
  const currentRadius = elapsed * RADIX_SHOCKWAVE_SPEED;
  if (currentRadius <= 0) return;

  let alpha = 1;
  if (sw.fadingOut) {
    const fadeElapsed = gameTimer - sw.fadeStartTime;
    alpha = Math.max(0, 1 - fadeElapsed / RADIX_SHOCKWAVE_FADE_DURATION);
    if (alpha <= 0) return;
  }

  ctx.save();
  ctx.globalAlpha = alpha;

  // Blue radial gradient ring (transparent center)
  const innerRatio = Math.max(0, 1 - 40 / Math.max(1, currentRadius));
  const grad = ctx.createRadialGradient(sw.x, sw.y, currentRadius * innerRatio, sw.x, sw.y, currentRadius);
  grad.addColorStop(0, "hsla(200, 90%, 60%, 0)");
  grad.addColorStop(0.5, "hsla(200, 90%, 55%, 0.35)");
  grad.addColorStop(0.8, "hsla(200, 90%, 50%, 0.5)");
  grad.addColorStop(1, "hsla(200, 90%, 45%, 0)");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(sw.x, sw.y, currentRadius, 0, Math.PI * 2);
  ctx.fill();

  // White border ring
  ctx.globalAlpha = alpha * 0.8;
  ctx.strokeStyle = "hsla(0, 0%, 100%, 0.9)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(sw.x, sw.y, currentRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Inner glow ring
  ctx.globalAlpha = alpha * 0.4;
  ctx.strokeStyle = "hsla(200, 90%, 70%, 0.6)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(sw.x, sw.y, currentRadius - 3, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawPill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const r = w / 2;
  ctx.beginPath();
  ctx.moveTo(x - r, y - h / 2 + r);
  ctx.arcTo(x - r, y - h / 2, x, y - h / 2, r);
  ctx.arcTo(x + r, y - h / 2, x + r, y - h / 2 + r, r);
  ctx.lineTo(x + r, y + h / 2 - r);
  ctx.arcTo(x + r, y + h / 2, x, y + h / 2, r);
  ctx.arcTo(x - r, y + h / 2, x - r, y + h / 2 - r, r);
  ctx.closePath();
  ctx.fill();
}

function drawPerk(ctx: CanvasRenderingContext2D, perk: Perk, time: number) {
  ctx.save();
  const pulse = 0.7 + 0.3 * Math.sin(time * 0.003);
  ctx.globalAlpha = pulse;
  const r = PERK_SIZE / 2;

  // Color by rarity
  const rarityColors = PERK_RARITY_COLORS[perk.rarity as PerkRarity] || PERK_RARITY_COLORS.blue;
  ctx.fillStyle = rarityColors.fill;
  ctx.strokeStyle = rarityColors.stroke;

  // Glow scales with rarity
  const glowIntensity = perk.rarity === "purple" ? 14 : perk.rarity === "red" ? 10 : perk.rarity === "orange" ? 7 : 4;
  ctx.shadowColor = rarityColors.glow;
  ctx.shadowBlur = glowIntensity;

  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(perk.x, perk.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Icon color matches rarity glow
  ctx.fillStyle = rarityColors.glow;
  ctx.shadowBlur = 0;

  const iconSize = r * 0.6;

  if (perk.type === "hp") {
    ctx.beginPath();
    ctx.moveTo(perk.x, perk.y + iconSize * 0.5);
    ctx.bezierCurveTo(perk.x - iconSize, perk.y - iconSize * 0.2, perk.x - iconSize, perk.y - iconSize * 0.8, perk.x, perk.y - iconSize * 0.2);
    ctx.bezierCurveTo(perk.x + iconSize, perk.y - iconSize * 0.8, perk.x + iconSize, perk.y - iconSize * 0.2, perk.x, perk.y + iconSize * 0.5);
    ctx.fill();
  } else if (perk.type === "heat") {
    ctx.lineWidth = 2;
    ctx.strokeStyle = ctx.fillStyle;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      const a = (i * Math.PI) / 3;
      ctx.moveTo(perk.x + Math.cos(a) * iconSize, perk.y + Math.sin(a) * iconSize);
      ctx.lineTo(perk.x - Math.cos(a) * iconSize, perk.y - Math.sin(a) * iconSize);
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(perk.x, perk.y - iconSize * 0.7);
    ctx.bezierCurveTo(perk.x + iconSize * 0.6, perk.y + iconSize * 0.1, perk.x + iconSize * 0.6, perk.y + iconSize * 0.5, perk.x, perk.y + iconSize * 0.7);
    ctx.bezierCurveTo(perk.x - iconSize * 0.6, perk.y + iconSize * 0.5, perk.x - iconSize * 0.6, perk.y + iconSize * 0.1, perk.x, perk.y - iconSize * 0.7);
    ctx.fill();
  }

  // HP overlay — dark circle grows inward as HP decreases (asteroid-style)
  const hpRatio = perk.hp / perk.maxHp;
  if (hpRatio < 1) {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "hsl(0, 0%, 0%)";
    ctx.beginPath();
    ctx.arc(perk.x, perk.y, r * (1 - hpRatio), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// Tiny deterministic hash → [0,1) from a string id
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}
// Seeded PRNG (mulberry32) — stable per-asteroid crater layout
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

interface CraterDef { xOffset: number; yOffset: number; baseSize: number; }
const craterCache = new Map<string, { craters: CraterDef[]; speed: number; phase: number }>();

function getAsteroidCraters(a: Asteroid): { craters: CraterDef[]; speed: number; phase: number } {
  const cached = craterCache.get(a.id);
  if (cached) return cached;

  const seed = hashStr(a.id);
  const rng = makeRng(seed);
  const count = Math.max(3, Math.min(5, Math.round(a.radius / 14)));
  const craters: CraterDef[] = [];
  for (let i = 0; i < count; i++) {
    craters.push({
      xOffset: (rng() - 0.5) * 1.2, // -0.6r .. +0.6r relative to cluster centre
      yOffset: (rng() - 0.5) * 1.0, // -0.5r .. +0.5r relative to cluster centre
      baseSize: 0.12 + rng() * 0.18, // 12-30% of radius
    });
  }
  // Subtle per-asteroid speed variation + shared phase so cluster scrolls as one
  const speed = 0.18 + rng() * 0.18; // ~0.18-0.36 cycles/sec
  const phase = rng();
  const entry = { craters, speed, phase };
  craterCache.set(a.id, entry);
  return entry;
}

export function drawAsteroid(ctx: CanvasRenderingContext2D, a: Asteroid, time: number) {
  ctx.save();

  // ===== Black hole — special render path (no craters, no sphere shading) =====
  if (a.type === "black") {
    const tSec = time / 1000;
    // Solid near-black disc (no glow on the body itself)
    ctx.shadowBlur = 0;
    ctx.fillStyle = "hsl(0, 0%, 4%)";
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
    ctx.fill();

    // Pulsating + flickering blue ring at the outer boundary
    const flicker = (Math.sin(tSec * 4.0) + Math.sin(tSec * 9.7)) * 0.5; // -1..1
    const pulse = Math.sin(tSec * 1.2);
    ctx.strokeStyle = "hsl(200, 100%, 65%)";
    ctx.lineWidth = 2 + pulse * 1;
    ctx.shadowColor = "hsl(200, 100%, 70%)";
    ctx.shadowBlur = 8 + flicker * 6 + 4;
    ctx.globalAlpha = 0.85 + flicker * 0.15;
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Faint inner glow ring for depth
    ctx.globalAlpha = 0.4 + flicker * 0.2;
    ctx.lineWidth = 1;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(a.x, a.y, Math.max(1, a.radius - 3), 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
    return;
  }

  const colors: Record<string, { fill: string; stroke: string; crater: string }> = {
    blue:   { fill: "hsl(210, 80%, 55%)", stroke: "hsl(210, 80%, 40%)", crater: "hsl(210, 80%, 25%)" },
    orange: { fill: "hsl(30, 90%, 55%)",  stroke: "hsl(30, 90%, 40%)",  crater: "hsl(30, 90%, 28%)" },
    purple: { fill: "hsl(270, 70%, 55%)", stroke: "hsl(270, 70%, 40%)", crater: "hsl(270, 70%, 25%)" },
    red:    { fill: "hsl(0, 80%, 50%)",   stroke: "hsl(0, 80%, 35%)",   crater: "hsl(0, 80%, 22%)" },
    green:  { fill: "hsl(140, 70%, 45%)", stroke: "hsl(140, 70%, 30%)", crater: "hsl(140, 70%, 20%)" },
    pink:   { fill: "hsl(330, 85%, 65%)", stroke: "hsl(330, 85%, 50%)", crater: "hsl(330, 85%, 30%)" },
    yellow: { fill: "hsl(50, 95%, 55%)",  stroke: "hsl(45, 90%, 40%)",  crater: "hsl(40, 80%, 25%)" },
    // White asteroids: red craters intentional (per spec).
    white:  { fill: "hsl(0, 0%, 92%)",    stroke: "hsl(0, 0%, 75%)",    crater: "hsl(0, 80%, 30%)" },
  };

  const c = colors[a.type] || colors.blue;

  // Red and pink asteroids pulse (pink subtler since they're already small)
  if (a.type === "red") {
    const pulse = 0.7 + 0.3 * Math.sin(time * 0.008);
    ctx.globalAlpha = pulse;
    const scale = 1 + 0.05 * Math.sin(time * 0.006);
    ctx.translate(a.x, a.y);
    ctx.scale(scale, scale);
    ctx.translate(-a.x, -a.y);
  } else if (a.type === "pink") {
    const pulse = 0.85 + 0.15 * Math.sin(time * 0.012);
    ctx.globalAlpha = pulse;
    const scale = 1 + 0.03 * Math.sin(time * 0.009);
    ctx.translate(a.x, a.y);
    ctx.scale(scale, scale);
    ctx.translate(-a.x, -a.y);
  }

  // Glow
  ctx.shadowColor = c.fill;
  ctx.shadowBlur = 8;

  // Main body
  ctx.fillStyle = c.fill;
  ctx.strokeStyle = c.stroke;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // ===== 3D effects: clip to circle, scrolling craters, sphere shading =====
  ctx.shadowBlur = 0;
  ctx.save();
  ctx.beginPath();
  ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
  ctx.clip();

  // Scrolling craters (rotation illusion) — rigid cluster moves as one patch
  const { craters, speed, phase } = getAsteroidCraters(a);
  const r = a.radius;
  const tSec = time / 1000;
  ctx.fillStyle = c.crater;

  // Single cluster centre that scrolls vertically; all craters share its transform
  const clusterCycle = 2 * r * 1.6; // a bit of margin so the patch fully exits before re-entering
  const clusterY = (a.y - r * 1.3) + ((tSec * speed * clusterCycle + phase * clusterCycle) % clusterCycle);
  const tNorm = Math.max(-1, Math.min(1, (clusterY - a.y) / r));
  const t2 = tNorm * tNorm;
  const scaleX = 1 - 0.4 * t2;
  const scaleY = 0.6 + 0.4 * (1 - t2);
  const alpha = 0.5 + 0.5 * (1 - t2);

  for (const cr of craters) {
    const craterSize = r * cr.baseSize;
    const xPos = a.x + cr.xOffset * r * scaleX;
    const yPos = clusterY + cr.yOffset * r * scaleY;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = c.crater;
    ctx.beginPath();
    ctx.ellipse(xPos, yPos, craterSize * scaleX, craterSize * scaleY, 0, 0, Math.PI * 2);
    ctx.fill();

    // Subtle bottom-right inner rim — concave depth cue (never reads as white)
    ctx.globalAlpha = alpha * 0.25;
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.ellipse(
      xPos + craterSize * scaleX * 0.25,
      yPos + craterSize * scaleY * 0.3,
      craterSize * scaleX * 0.25,
      craterSize * scaleY * 0.18,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Curved bottom-right shadow (sphere shading)
  const shadowGrad = ctx.createRadialGradient(
    a.x - r * 0.3,
    a.y - r * 0.3,
    0,
    a.x,
    a.y,
    r * 1.05,
  );
  shadowGrad.addColorStop(0, "rgba(0,0,0,0)");
  shadowGrad.addColorStop(0.5, "rgba(0,0,0,0)");
  shadowGrad.addColorStop(0.85, "rgba(0,0,0,0.35)");
  shadowGrad.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
  ctx.fill();

  // Upper-left highlight (sphere lift)
  const hiGrad = ctx.createRadialGradient(
    a.x - r * 0.55,
    a.y - r * 0.55,
    0,
    a.x - r * 0.55,
    a.y - r * 0.55,
    r * 0.9,
  );
  hiGrad.addColorStop(0, "rgba(255,255,255,0.35)");
  hiGrad.addColorStop(0.48, "rgba(255,255,255,0.08)");
  hiGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = hiGrad;
  ctx.beginPath();
  ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore(); // end clip

  // HP indicator — sits on top of shading so damage is readable
  const hpRatio = a.hp / a.maxHp;
  if (hpRatio < 1) {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "hsl(0, 0%, 0%)";
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.radius * (1 - hpRatio), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawEndingEffects(ctx: CanvasRenderingContext2D, ending: EndingInfo, gameTimer: number, time: number) {
  const elapsed = gameTimer - ending.startTime;

  // Draw mini-explosions on the dying ship
  if (ending.hasOpponent) {
    for (const exp of ending.explosions) {
      const expAge = gameTimer - exp.spawnTime;
      if (expAge < 0 || expAge > 0.3) continue;
      const progress = expAge / 0.3;
      const radius = 8 + progress * 20;
      const alpha = 1 - progress;

      ctx.save();
      const grad = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, radius);
      grad.addColorStop(0, `hsla(50, 100%, 95%, ${alpha})`);
      grad.addColorStop(0.3, `hsla(30, 100%, 65%, ${alpha * 0.8})`);
      grad.addColorStop(0.7, `hsla(15, 100%, 50%, ${alpha * 0.4})`);
      grad.addColorStop(1, `hsla(0, 100%, 40%, 0)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Draw destruction shockwave (orange)
  if (ending.destructionShockwave) {
    const sw = ending.destructionShockwave;
    const swAge = gameTimer - sw.startTime;
    const expandSpeed = 700; // px/s
    const currentRadius = Math.min(sw.maxRadius, swAge * expandSpeed);
    const fadeDuration = 0.3;
    const totalDuration = sw.maxRadius / expandSpeed + fadeDuration;

    if (swAge < totalDuration) {
      const fadeStart = sw.maxRadius / expandSpeed;
      let alpha = 0.6;
      if (swAge > fadeStart) {
        alpha = 0.6 * (1 - (swAge - fadeStart) / fadeDuration);
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);

      // Outer ring glow
      const ringWidth = 12;
      const grad = ctx.createRadialGradient(sw.x, sw.y, Math.max(0, currentRadius - ringWidth), sw.x, sw.y, currentRadius + ringWidth);
      grad.addColorStop(0, "hsla(30, 100%, 60%, 0)");
      grad.addColorStop(0.3, "hsla(25, 100%, 55%, 0.6)");
      grad.addColorStop(0.5, "hsla(20, 100%, 65%, 0.8)");
      grad.addColorStop(0.7, "hsla(25, 100%, 55%, 0.6)");
      grad.addColorStop(1, "hsla(30, 100%, 60%, 0)");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, currentRadius + ringWidth, 0, Math.PI * 2);
      ctx.fill();

      // Inner fill
      ctx.globalAlpha = Math.max(0, alpha * 0.2);
      const innerGrad = ctx.createRadialGradient(sw.x, sw.y, 0, sw.x, sw.y, currentRadius);
      innerGrad.addColorStop(0, "hsla(40, 100%, 80%, 0.5)");
      innerGrad.addColorStop(0.5, "hsla(25, 100%, 55%, 0.2)");
      innerGrad.addColorStop(1, "hsla(20, 100%, 50%, 0)");
      ctx.fillStyle = innerGrad;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, currentRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  // Draw debris fragments
  if (ending.debris.length > 0) {
    const DEBRIS_RENDER_SIZE = 66;
    for (const d of ending.debris) {
      const age = gameTimer - d.spawnTime;
      if (age < 0) continue;
      // Full opacity for 0.5s, fade over next 0.7s
      let alpha = 1;
      if (age > 0.5) {
        alpha = Math.max(0, 1 - (age - 0.5) / 0.7);
      }
      if (alpha <= 0) continue;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rotation);
      // Subtle glow trail
      ctx.shadowColor = "hsla(25, 100%, 60%, 0.5)";
      ctx.shadowBlur = 8;
      ctx.drawImage(d.image, -DEBRIS_RENDER_SIZE / 2, -DEBRIS_RENDER_SIZE / 2, DEBRIS_RENDER_SIZE, DEBRIS_RENDER_SIZE);
      ctx.restore();
    }
  }

  // Draw VICTORY / DEFEAT text
  const textDelay = 0.5;
  if (elapsed >= textDelay) {
    const textAge = elapsed - textDelay;
    const text = ending.result === "victory" ? "VICTORY" : "DEFEAT";
    const color = ending.result === "victory"
      ? "hsl(142, 71%, 45%)"
      : "hsl(0, 72%, 51%)";
    const glowColor = ending.result === "victory"
      ? "hsl(142, 71%, 60%)"
      : "hsl(0, 72%, 65%)";

    // Scale in over 1s, then pulse
    let scale: number;
    let alpha: number;
    if (textAge < 1) {
      // Scale in: 0→1 with easeOut
      const t = textAge;
      scale = 1 - Math.pow(1 - t, 3); // easeOutCubic
      alpha = scale;
    } else {
      // Pulse
      scale = 1 + 0.05 * Math.sin((textAge - 1) * 4);
      alpha = 1;
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(ARENA_WIDTH / 2, ARENA_HEIGHT / 2);
    ctx.scale(scale, scale);
    ctx.font = "bold 52px Orbitron";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 25;
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);
    // Double pass for stronger glow
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }
}

// ============= Asteroid death explosion FX =============

const ASTEROID_EXPLOSION_DURATION = 0.85;

interface ExplosionPalette {
  shardFill: string;
  shardHi: string;
  shardStroke: string;
  spark: string;
  smokeInner: string;   // rgb only — alpha applied at draw
  smokeOuter: string;
  flashTint: string;    // 'rgba(r,g,b,1)' — alpha will be substituted
  flashBoost: number;
}

const EXPLOSION_PALETTES: Record<AsteroidType, ExplosionPalette> = {
  blue: {
    shardFill: "hsl(210, 75%, 50%)",
    shardHi: "hsl(200, 90%, 75%)",
    shardStroke: "hsl(210, 80%, 30%)",
    spark: "hsl(190, 100%, 85%)",
    smokeInner: "120, 150, 190",
    smokeOuter: "20, 25, 40",
    flashTint: "rgba(220, 240, 255, 1)",
    flashBoost: 1.0,
  },
  orange: {
    shardFill: "hsl(28, 88%, 52%)",
    shardHi: "hsl(45, 100%, 70%)",
    shardStroke: "hsl(20, 90%, 32%)",
    spark: "hsl(50, 100%, 80%)",
    smokeInner: "180, 130, 90",
    smokeOuter: "35, 25, 18",
    flashTint: "rgba(255, 240, 200, 1)",
    flashBoost: 1.05,
  },
  purple: {
    shardFill: "hsl(270, 65%, 50%)",
    shardHi: "hsl(290, 90%, 75%)",
    shardStroke: "hsl(270, 70%, 28%)",
    spark: "hsl(285, 100%, 88%)",
    smokeInner: "150, 110, 180",
    smokeOuter: "30, 20, 40",
    flashTint: "rgba(240, 220, 255, 1)",
    flashBoost: 1.0,
  },
  red: {
    shardFill: "hsl(0, 80%, 48%)",
    shardHi: "hsl(28, 100%, 65%)",
    shardStroke: "hsl(0, 80%, 28%)",
    spark: "hsl(40, 100%, 75%)",
    smokeInner: "180, 90, 70",
    smokeOuter: "40, 15, 15",
    flashTint: "rgba(255, 220, 200, 1)",
    flashBoost: 1.2,
  },
  green: {
    shardFill: "hsl(140, 70%, 42%)",
    shardHi: "hsl(120, 90%, 70%)",
    shardStroke: "hsl(140, 70%, 22%)",
    spark: "hsl(120, 100%, 80%)",
    smokeInner: "100, 180, 120",
    smokeOuter: "20, 40, 25",
    flashTint: "rgba(220, 255, 220, 1)",
    flashBoost: 1.05,
  },
  pink: {
    shardFill: "hsl(330, 80%, 60%)",
    shardHi: "hsl(320, 100%, 80%)",
    shardStroke: "hsl(330, 80%, 32%)",
    spark: "hsl(320, 100%, 88%)",
    smokeInner: "210, 130, 175",
    smokeOuter: "50, 20, 35",
    flashTint: "rgba(255, 220, 240, 1)",
    flashBoost: 1.1,
  },
  yellow: {
    shardFill: "hsl(50, 90%, 52%)",
    shardHi: "hsl(55, 100%, 80%)",
    shardStroke: "hsl(40, 80%, 28%)",
    spark: "hsl(55, 100%, 85%)",
    smokeInner: "210, 190, 110",
    smokeOuter: "45, 35, 15",
    flashTint: "rgba(255, 250, 210, 1)",
    flashBoost: 1.25,
  },
  white: {
    shardFill: "hsl(0, 0%, 88%)",
    shardHi: "hsl(0, 0%, 100%)",
    shardStroke: "hsl(0, 60%, 30%)",
    spark: "hsl(0, 0%, 100%)",
    smokeInner: "210, 210, 220",
    smokeOuter: "60, 30, 30",
    flashTint: "rgba(255, 255, 255, 1)",
    flashBoost: 1.15,
  },
  black: {
    shardFill: "hsl(0, 0%, 10%)",
    shardHi: "hsl(200, 90%, 65%)",
    shardStroke: "hsl(200, 100%, 30%)",
    spark: "hsl(200, 100%, 80%)",
    smokeInner: "60, 90, 130",
    smokeOuter: "5, 5, 15",
    flashTint: "rgba(180, 220, 255, 1)",
    flashBoost: 1.0,
  },
};

function drawAsteroidExplosion(
  ctx: CanvasRenderingContext2D,
  ex: AsteroidExplosion,
  timer: number,
) {
  const elapsed = timer - ex.startTime;
  if (elapsed < 0 || elapsed > ASTEROID_EXPLOSION_DURATION) return;

  const pal = EXPLOSION_PALETTES[ex.type] || EXPLOSION_PALETTES.blue;

  // ----- Layer 1: Flash (0-140ms, additive) -----
  const flashDur = 0.14;
  if (elapsed < flashDur) {
    const fT = elapsed / flashDur;
    const flashR = ex.radius * (0.6 + fT * 0.9) * pal.flashBoost;
    const flashAlpha = 1 - fT;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = flashAlpha;
    const fg = ctx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, flashR);
    fg.addColorStop(0, pal.flashTint);
    fg.addColorStop(0.4, pal.flashTint.replace(", 1)", ", 0.5)"));
    fg.addColorStop(1, pal.flashTint.replace(", 1)", ", 0)"));
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, flashR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ----- Layer 3 (drawn before shards → sits behind): Smoke puffs -----
  const smokeMaxT = 1.0;
  if (elapsed > 0.04) {
    ctx.save();
    for (let pass = 0; pass < 2; pass++) {
      const wantInner = pass === 1; // outer first, inner on top
      for (const puff of ex.puffs) {
        if (puff.isInner !== wantInner) continue;
        const pT = (elapsed - puff.delay) / smokeMaxT;
        if (pT <= 0 || pT >= 1) continue;
        const radius = puff.baseRadius * (0.35 + pT * 0.95);
        const px = ex.x + puff.ox + puff.vx * elapsed;
        const py = ex.y + puff.oy + puff.vy * elapsed;
        const alpha =
          (pT < 0.2 ? pT / 0.2 : 1 - (pT - 0.2) / 0.8) *
          (puff.isInner ? 0.55 : 0.7);
        const rgb = puff.isInner ? pal.smokeInner : pal.smokeOuter;
        const grad = ctx.createRadialGradient(px, py, 0, px, py, radius);
        grad.addColorStop(0, `rgba(${rgb}, ${alpha.toFixed(3)})`);
        grad.addColorStop(0.6, `rgba(${rgb}, ${(alpha * 0.5).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ----- Layer 2: Shards (0-700ms) -----
  const shardDur = 0.7;
  if (elapsed < shardDur) {
    const sT = elapsed / shardDur;
    const shardAlpha = 1 - sT * sT; // ease-out
    ctx.save();
    ctx.globalAlpha = shardAlpha;
    for (const sh of ex.shards) {
      const cx = ex.x + sh.vx * elapsed;
      const cy = ex.y + sh.vy * elapsed + 60 * elapsed * elapsed; // light gravity
      const rot = sh.rotation + sh.rotSpeed * elapsed;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.scale(sh.size, sh.size);
      // Body polygon
      ctx.beginPath();
      ctx.moveTo(sh.verts[0].x, sh.verts[0].y);
      for (let i = 1; i < sh.verts.length; i++) {
        ctx.lineTo(sh.verts[i].x, sh.verts[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = pal.shardFill;
      ctx.fill();
      // Top-left highlight overlay (matches asteroid lighting)
      ctx.save();
      ctx.clip();
      const hg = ctx.createLinearGradient(-1, -1, 1, 1);
      hg.addColorStop(0, pal.shardHi);
      hg.addColorStop(0.6, "rgba(0,0,0,0)");
      ctx.fillStyle = hg;
      ctx.globalAlpha = shardAlpha * 0.55;
      ctx.fillRect(-1.5, -1.5, 3, 3);
      ctx.restore();
      // Crisp edge
      ctx.lineWidth = 0.08;
      ctx.strokeStyle = pal.shardStroke;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // ----- Layer 4: Sparks (0-400ms, additive) -----
  const sparkDur = 0.4;
  if (elapsed < sparkDur) {
    const spT = elapsed / sparkDur;
    const sparkAlpha = 1 - spT;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = sparkAlpha;
    ctx.fillStyle = pal.spark;
    for (const sp of ex.sparks) {
      const x = ex.x + sp.vx * elapsed;
      const y = ex.y + sp.vy * elapsed;
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
