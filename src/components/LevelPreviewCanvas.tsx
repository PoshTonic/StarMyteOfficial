import { useEffect, useRef } from "react";
import { drawAsteroid } from "@/game/renderer";
import { STAGE_ASTEROID_SLOTS, ASTEROID_CONFIGS, type LevelDef } from "@/game/campaignData";
import type { Asteroid, AsteroidType } from "@/game/types";
import ShipDisplay from "@/components/ShipDisplay";
import type { SkinColourMap } from "@/game/skinUtils";

interface Props {
  stage: number;
  level: number;
  levelDef: LevelDef;
  hasBoss: boolean;
  bossSkinColours?: SkinColourMap;
}

const CANVAS_SIZE = 240;

// Simple seeded PRNG so the same level always lays out the same.
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

interface PreviewSpec {
  type: AsteroidType;
  radius: number;
}

/**
 * Build the list of asteroids to display for this level.
 * Counts and sizes scale with level number to telegraph difficulty.
 */
function buildPreviewSpecs(stage: number, level: number, hasBoss: boolean): PreviewSpec[] {
  const slots = STAGE_ASTEROID_SLOTS[Math.min(Math.max(stage - 1, 0), STAGE_ASTEROID_SLOTS.length - 1)];
  const specs: PreviewSpec[] = [];

  // Boss level: 4 small asteroids — one of each slot type, behind the ship
  if (hasBoss) {
    for (let i = 0; i < 4; i++) {
      specs.push({ type: slots[i], radius: 14 });
    }
    return specs;
  }

  // Per-level recipes (cap 6 asteroids).
  // [type-slot-index, radius]
  const recipes: Array<Array<[number, number]>> = [
    [[0, 50]],                                          // L1
    [[1, 44], [0, 28]],                                 // L2
    [[1, 36], [0, 30]],                                 // L3
    [[1, 32], [1, 28], [0, 26], [0, 22]],               // L4
    [[2, 34], [1, 26], [0, 22]],                        // L5
    [[2, 30], [2, 26], [1, 24], [0, 20], [0, 18]],      // L6
    [[3, 32], [2, 26], [1, 22], [0, 20]],               // L7
    [[3, 30], [3, 26], [2, 22], [1, 20], [0, 18]],      // L8
    [[3, 28], [2, 24], [2, 22], [1, 20], [0, 18], [0, 16]], // L9
  ];

  const idx = Math.min(Math.max(level - 1, 0), recipes.length - 1);
  const recipe = recipes[idx];

  for (const [slotIdx, radius] of recipe) {
    const safeSlot = Math.min(slotIdx, slots.length - 1);
    specs.push({ type: slots[safeSlot], radius });
  }

  return specs;
}

interface PlacedAsteroid extends Asteroid {}

function layoutAsteroids(
  specs: PreviewSpec[],
  hasBoss: boolean,
  rng: () => number,
): PlacedAsteroid[] {
  const placed: PlacedAsteroid[] = [];
  const padding = 8;

  // Boss: cluster the 4 small asteroids around the corners (behind ship)
  if (hasBoss) {
    const positions = [
      { x: 50, y: 50 },
      { x: CANVAS_SIZE - 50, y: 50 },
      { x: 50, y: CANVAS_SIZE - 50 },
      { x: CANVAS_SIZE - 50, y: CANVAS_SIZE - 50 },
    ];
    specs.forEach((spec, i) => {
      const cfg = ASTEROID_CONFIGS[spec.type];
      placed.push({
        id: `prev-${i}`,
        x: positions[i].x,
        y: positions[i].y,
        vx: 0,
        vy: 0,
        radius: spec.radius,
        type: spec.type,
        hp: cfg.maxHp,
        maxHp: cfg.maxHp,
      });
    });
    return placed;
  }

  // Single asteroid → centre it.
  if (specs.length === 1) {
    const spec = specs[0];
    const cfg = ASTEROID_CONFIGS[spec.type];
    placed.push({
      id: "prev-0",
      x: CANVAS_SIZE / 2,
      y: CANVAS_SIZE / 2,
      vx: 0,
      vy: 0,
      radius: spec.radius,
      type: spec.type,
      hp: cfg.maxHp,
      maxHp: cfg.maxHp,
    });
    return placed;
  }

  // Multiple: random non-overlapping placement (best-effort up to N tries).
  specs.forEach((spec, i) => {
    const cfg = ASTEROID_CONFIGS[spec.type];
    let x = CANVAS_SIZE / 2;
    let y = CANVAS_SIZE / 2;
    for (let attempt = 0; attempt < 30; attempt++) {
      const cx = padding + spec.radius + rng() * (CANVAS_SIZE - 2 * (padding + spec.radius));
      const cy = padding + spec.radius + rng() * (CANVAS_SIZE - 2 * (padding + spec.radius));
      const overlaps = placed.some((p) => {
        const dx = p.x - cx;
        const dy = p.y - cy;
        return Math.sqrt(dx * dx + dy * dy) < p.radius + spec.radius + 4;
      });
      if (!overlaps) {
        x = cx;
        y = cy;
        break;
      }
      if (attempt === 29) {
        x = cx;
        y = cy;
      }
    }
    placed.push({
      id: `prev-${i}`,
      x,
      y,
      vx: 0,
      vy: 0,
      radius: spec.radius,
      type: spec.type,
      hp: cfg.maxHp,
      maxHp: cfg.maxHp,
    });
  });

  return placed;
}

const LevelPreviewCanvas = ({ stage, level, levelDef, hasBoss, bossSkinColours }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = CANVAS_SIZE * dpr;
    canvas.height = CANVAS_SIZE * dpr;
    ctx.scale(dpr, dpr);

    const seed = stage * 1000 + level;
    const rng = makeRng(seed);

    // Twinkling stars
    const stars = Array.from({ length: 25 }, () => ({
      x: rng() * CANVAS_SIZE,
      y: rng() * CANVAS_SIZE,
      r: rng() * 1.2 + 0.3,
      phase: rng() * Math.PI * 2,
    }));

    const specs = buildPreviewSpecs(stage, level, hasBoss);
    const asteroids = layoutAsteroids(specs, hasBoss, rng);

    const animate = (t: number) => {
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Background
      ctx.fillStyle = "hsl(222, 47%, 6%)";
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Stars
      stars.forEach((s) => {
        const o = 0.3 + 0.5 * Math.abs(Math.sin(t * 0.001 * 0.6 + s.phase));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(199, 89%, 80%, ${o})`;
        ctx.fill();
      });

      // Asteroids — slightly faded if boss so the ship pops
      ctx.globalAlpha = hasBoss ? 0.55 : 1;
      asteroids.forEach((a) => drawAsteroid(ctx, a, t));
      ctx.globalAlpha = 1;

      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [stage, level, hasBoss, levelDef.slot1, levelDef.slot2, levelDef.slot3, levelDef.slot4]);

  return (
    <div className="absolute inset-0">
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      {hasBoss && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <ShipDisplay
            shipName="AX15"
            skinColours={bossSkinColours}
            className="h-[60%] w-[60%]"
          />
        </div>
      )}
    </div>
  );
};

export default LevelPreviewCanvas;
