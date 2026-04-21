import { useState, useEffect, useRef } from "react";
import { Heart, Fuel, Snowflake } from "lucide-react";
import { GameState, FlyingPerkIcon } from "@/game/types";
import { ARENA_WIDTH, ARENA_HEIGHT, CANVAS_BLEED, FLYING_PERK_DURATION } from "@/game/constants";
import crosshairSvg from "@/assets/crosshair-target.svg";

interface Props {
  gameState: GameState;
  missileTargetActive: boolean;
  showSelectTarget: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

const PERK_RARITY_HUE: Record<string, string> = {
  blue: "hsl(210, 100%, 60%)",
  orange: "hsl(30, 100%, 50%)",
  red: "hsl(0, 80%, 55%)",
  purple: "hsl(270, 80%, 60%)",
};

const BattleHUD = ({ gameState, missileTargetActive, showSelectTarget, canvasRef }: Props) => {
  const { player, opponent } = gameState;
  const showOpponent = !gameState.campaignState || gameState.campaignState.bossPhase === "opponent";

  const playerHpPct = Math.max(0, (player.hp / player.maxHp) * 100);
  const opponentHpPct = Math.max(0, (opponent.hp / opponent.maxHp) * 100);
  const playerFuelPct = Math.max(0, (player.fuel / player.maxFuel) * 100);
  const opponentFuelPct = Math.max(0, (opponent.fuel / opponent.maxFuel) * 100);

  // Bar flash state
  const [flashBars, setFlashBars] = useState<Record<string, boolean>>({});
  const processedIconsRef = useRef<Set<string>>(new Set());

  // Detect when flying icons complete and trigger flash
  useEffect(() => {
    const now = gameState.timer;
    gameState.flyingPerkIcons.forEach(icon => {
      const elapsed = now - icon.startTime;
      if (elapsed >= FLYING_PERK_DURATION && !processedIconsRef.current.has(icon.id)) {
        processedIconsRef.current.add(icon.id);
        const barKey = getBarKey(icon);
        setFlashBars(prev => ({ ...prev, [barKey]: true }));
        setTimeout(() => {
          setFlashBars(prev => ({ ...prev, [barKey]: false }));
        }, 400);
      }
    });
    // Cleanup old processed ids
    if (processedIconsRef.current.size > 50) {
      processedIconsRef.current.clear();
    }
  }, [gameState.timer, gameState.flyingPerkIcons]);

  function getBarKey(icon: FlyingPerkIcon): string {
    if (icon.type === "hp") return `hp-${icon.owner}`;
    if (icon.type === "fuel") return `fuel-${icon.owner}`;
    return `heat-${icon.owner}`;
  }

  // Canvas bitmap is ARENA_WIDTH + 2*CANVAS_BLEED wide; arena x=0 maps to pixel CANVAS_BLEED
  const CANVAS_WIDTH = ARENA_WIDTH + CANVAS_BLEED * 2;

  // Convert arena coords to screen coords for crosshair overlay
  const getCrosshairScreenPos = () => {
    if (!missileTargetActive || !canvasRef.current) return null;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const parentRect = canvas.parentElement?.getBoundingClientRect();
    if (!parentRect) return null;
    const pxPerUnit = rect.width / CANVAS_WIDTH;
    return {
      x: (rect.left - parentRect.left) + (gameState.missileTarget.x + CANVAS_BLEED) * pxPerUnit,
      y: (rect.top - parentRect.top) + gameState.missileTarget.y * (rect.height / ARENA_HEIGHT),
    };
  };

  // Convert arena coords to screen coords for flying icons
  const getScreenPos = (arenaX: number, arenaY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const parentRect = canvas.parentElement?.getBoundingClientRect();
    if (!parentRect) return { x: 0, y: 0 };
    const pxPerUnit = rect.width / CANVAS_WIDTH;
    return {
      x: (rect.left - parentRect.left) + (arenaX + CANVAS_BLEED) * pxPerUnit,
      y: (rect.top - parentRect.top) + arenaY * (rect.height / ARENA_HEIGHT),
    };
  };

  // Get target position for a flying icon
  const getTargetPos = (icon: FlyingPerkIcon): { x: number; y: number } => {
    const parentRect = canvasRef.current?.parentElement?.getBoundingClientRect();
    if (!parentRect) return { x: 0, y: 0 };

    if (icon.type === "hp") {
      return icon.owner === "player"
        ? { x: 8, y: parentRect.height * 0.85 }
        : { x: 8, y: parentRect.height * 0.15 };
    }
    if (icon.type === "fuel") {
      return icon.owner === "player"
        ? { x: parentRect.width - 8, y: parentRect.height * 0.85 }
        : { x: parentRect.width - 8, y: parentRect.height * 0.15 };
    }
    return icon.owner === "player"
      ? { x: parentRect.width / 2, y: parentRect.height * 0.7 }
      : { x: parentRect.width / 2, y: parentRect.height * 0.3 };
  };

  const crosshairPos = getCrosshairScreenPos();

  // Render flying perk icons
  const renderFlyingIcons = () => {
    return gameState.flyingPerkIcons.map(icon => {
      const elapsed = gameState.timer - icon.startTime;
      const t = Math.min(1, elapsed / FLYING_PERK_DURATION);
      if (t >= 1) return null;

      const startPos = getScreenPos(icon.startX, icon.startY);
      const targetPos = getTargetPos(icon);

      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const x = startPos.x + (targetPos.x - startPos.x) * ease;
      const y = startPos.y + (targetPos.y - startPos.y) * ease;

      const scale = 1.5 - 0.8 * t;
      const color = PERK_RARITY_HUE[icon.rarity] || PERK_RARITY_HUE.blue;

      const IconComponent = icon.type === "hp" ? Heart : icon.type === "fuel" ? Fuel : Snowflake;

      return (
        <div
          key={icon.id}
          className="absolute pointer-events-none"
          style={{
            left: x - 12 * scale,
            top: y - 12 * scale,
            transform: `scale(${scale})`,
            filter: `drop-shadow(0 0 8px ${color})`,
            transition: "none",
            willChange: "transform",
          }}
        >
          <IconComponent
            className="h-6 w-6"
            style={{ color, fill: `${color}40` }}
          />
        </div>
      );
    });
  };

  const hpFlashPlayer = flashBars["hp-player"];
  const hpFlashOpponent = flashBars["hp-opponent"];
  const fuelFlashPlayer = flashBars["fuel-player"];
  const fuelFlashOpponent = flashBars["fuel-opponent"];

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Left side: HP bars with shared heart icon */}
      <div className="absolute left-1 top-[12%] bottom-[17%] w-4 flex flex-col items-center gap-0.5">
        {/* Enemy HP (top half) - fills from top down */}
        {showOpponent && (
          <div className={`flex-1 w-full relative rounded-full bg-muted/30 overflow-hidden transition-all ${hpFlashOpponent ? "ring-2 ring-destructive brightness-150" : ""}`}>
            <div
              className="absolute top-0 w-full rounded-full transition-all"
              style={{ height: `${opponentHpPct}%`, backgroundColor: 'hsl(0, 72%, 51%)' }}
            />
          </div>
        )}
        {/* Shared heart icon */}
        <Heart className="h-3.5 w-3.5 text-destructive shrink-0 fill-destructive/30" />
        {/* Player HP (bottom half) - fills from bottom up */}
        <div className={`flex-1 w-full relative rounded-full bg-muted/30 overflow-hidden transition-all ${hpFlashPlayer ? "ring-2 ring-destructive brightness-150" : ""}`}>
          <div
            className="absolute bottom-0 w-full rounded-full transition-all"
            style={{ height: `${playerHpPct}%`, backgroundColor: 'hsl(0, 72%, 51%)' }}
          />
        </div>
      </div>

      {/* Right side: Fuel bars with shared fuel icon */}
      <div className="absolute right-1 top-[12%] bottom-[17%] w-4 flex flex-col items-center gap-0.5">
        {/* Enemy fuel (top half) */}
        {showOpponent && (
          <div className={`flex-1 w-full relative rounded-full bg-muted/30 overflow-hidden transition-all ${fuelFlashOpponent ? "ring-2 ring-primary brightness-150" : ""}`}>
            <div
              className="absolute top-0 w-full rounded-full transition-all"
              style={{ height: `${opponentFuelPct}%`, backgroundColor: 'hsl(199, 89%, 48%)' }}
            />
          </div>
        )}
        {/* Shared fuel icon */}
        <Fuel className="h-3.5 w-3.5 text-primary shrink-0" />
        {/* Player fuel (bottom half) */}
        <div className={`flex-1 w-full relative rounded-full bg-muted/30 overflow-hidden transition-all ${fuelFlashPlayer ? "ring-2 ring-primary brightness-150" : ""}`}>
          <div
            className="absolute bottom-0 w-full rounded-full transition-all"
            style={{ height: `${playerFuelPct}%`, backgroundColor: 'hsl(199, 89%, 48%)' }}
          />
        </div>
      </div>

      {/* Heat purge warning */}
      {player.isHeatPurging && (
        <div className="absolute top-[14%] left-1/2 -translate-x-1/2 font-display text-sm text-destructive animate-pulse">
          HEAT PURGE
        </div>
      )}

      {/* SELECT TARGET pulse message */}
      {showSelectTarget && (
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 font-display text-sm text-primary animate-pulse whitespace-nowrap">
          SELECT TARGET
        </div>
      )}

      {/* Missile crosshair overlay on target */}
      {crosshairPos && missileTargetActive && (
        <img
          src={crosshairSvg}
          alt="Target"
          className="absolute pointer-events-none"
          style={{
            left: crosshairPos.x - 20,
            top: crosshairPos.y - 20,
            width: 40,
            height: 40,
            opacity: 0.7,
            filter: 'brightness(0) saturate(100%) invert(20%) sepia(95%) saturate(5000%) hue-rotate(0deg) brightness(95%) contrast(105%)',
          }}
        />
      )}

      {/* Evasion indicator */}
      {player.zLevel !== "normal" && (
        <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 font-display text-xs text-primary animate-pulse">
          {player.zLevel === "dive" ? "DIVING" : "SOARING"}
        </div>
      )}

      {/* Flying perk icons */}
      {renderFlyingIcons()}

      {/* Player warning overlays */}
      <div className="absolute bottom-[25%] left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none">
        {playerHpPct < 20 && playerHpPct > 0 && (
          <span className="font-display text-sm tracking-wider animate-pulse text-destructive"
            style={{ filter: "drop-shadow(0 0 8px hsl(0, 72%, 51%))" }}>
            CRITICAL DAMAGE
          </span>
        )}
        {playerFuelPct < 20 && playerFuelPct > 0 && (
          <span className="font-display text-sm tracking-wider animate-pulse text-primary"
            style={{ filter: "drop-shadow(0 0 8px hsl(199, 89%, 48%))" }}>
            LOW FUEL LEVEL
          </span>
        )}
        {(gameState.player.heat / gameState.player.maxHeat) > 0.8 && !gameState.player.isHeatPurging && (
          <span className="font-display text-sm tracking-wider animate-pulse"
            style={{ color: "hsl(30, 90%, 50%)", filter: "drop-shadow(0 0 8px hsl(30, 90%, 50%))" }}>
            HIGH HEAT
          </span>
        )}
      </div>
    </div>
  );
};

export default BattleHUD;
