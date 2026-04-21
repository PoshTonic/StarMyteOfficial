import { useState, useRef, useCallback, useEffect } from "react";
import {
  STAR_CONFIG,
  STAR_RARITIES,
  StarRarity,
} from "@/game/constants";
import { StarRecord, mergeStars } from "@/game/starUtils";
import { useToast } from "@/hooks/use-toast";
import StarOrb from "@/components/StarOrb";
import { audioManager } from "@/game/audioManager";

interface StarInventoryGridProps {
  stars: StarRecord[];
  userId: string;
  onStarChanged: () => void;
}

// Helper: get element position relative to a container using offsetLeft/offsetTop chain (scroll-invariant)
function getOffsetRelativeTo(el: HTMLElement, container: HTMLElement): { x: number; y: number } {
  let x = 0, y = 0;
  let current: HTMLElement | null = el;
  while (current && current !== container) {
    x += current.offsetLeft;
    y += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

interface MergeAnim {
  star1Id: string;
  star2Id: string;
  phase: 1 | 2 | 3 | 4;
  startTime: number;
  // Positions relative to container (scroll-invariant)
  star1X: number;
  star1Y: number;
  star2X: number;
  star2Y: number;
  currentRarity: StarRarity;
  nextRarity: StarRarity;
  // Clone positions (updated each frame)
  clone1X: number;
  clone1Y: number;
  clone2X: number;
  clone2Y: number;
  // Phase 2+
  syncOpacity: number;
  syncWhite: number;
  // Phase 3
  shrinkScale: number;
  // Phase 4
  targetX: number;
  targetY: number;
  newScale: number;
  shockwaveRadius: number;
  shockwaveOpacity: number;
}

const PHASE_DURATIONS = { 1: 1000, 2: 1000, 3: 250, 4: 250 };

const StarInventoryGrid = ({ stars, userId, onStarChanged }: StarInventoryGridProps) => {
  const { toast } = useToast();
  const [selectedStar, setSelectedStar] = useState<StarRecord | null>(null);
  const [mergeAnim, setMergeAnim] = useState<MergeAnim | null>(null);
  const [merging, setMerging] = useState(false);
  const starRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const mergeAnimRef = useRef<MergeAnim | null>(null);

  // Restore scroll on unmount if animation was in progress
  useEffect(() => {
    return () => { document.body.style.overflow = ""; };
  }, []);

  const unassigned = stars.filter(s => !s.assigned_to_type);

  const grouped = STAR_RARITIES.map(rarity => ({
    rarity,
    stars: unassigned.filter(s => s.rarity === rarity),
  })).filter(g => g.stars.length > 0);

  const boostPercent = (rarity: StarRarity) => {
    return ((STAR_CONFIG[rarity].multiplier - 1) * 100).toFixed(1);
  };

  // Find the next rarity row's last star position for Phase 4 target
  const getNextRarityTarget = useCallback((currentRarity: StarRarity): { x: number; y: number } | null => {
    const rarityOrder: StarRarity[] = ["yellow", "blue", "orange", "red", "purple"];
    const idx = rarityOrder.indexOf(currentRarity);
    if (idx >= rarityOrder.length - 1) return null;
    const nextRarity = rarityOrder[idx + 1];

    const nextRarityStars = unassigned.filter(s => s.rarity === nextRarity);
    if (nextRarityStars.length > 0) {
      const lastStar = nextRarityStars[nextRarityStars.length - 1];
      const el = starRefs.current[lastStar.id];
      if (el && containerRef.current) {
        const pos = getOffsetRelativeTo(el, containerRef.current);
        return { x: pos.x + el.offsetWidth + 12, y: pos.y + el.offsetHeight / 2 };
      }
    }

    return null;
  }, [unassigned]);

  const startMergeAnimation = useCallback((star1: StarRecord, star2: StarRecord) => {
    const el1 = starRefs.current[star1.id];
    const el2 = starRefs.current[star2.id];
    const container = containerRef.current;
    if (!el1 || !el2 || !container) return;

    // Lock scroll
    document.body.style.overflow = "hidden";

    const pos1 = getOffsetRelativeTo(el1, container);
    const pos2 = getOffsetRelativeTo(el2, container);

    const rarityOrder: StarRarity[] = ["yellow", "blue", "orange", "red", "purple"];
    const idx = rarityOrder.indexOf(star1.rarity as StarRarity);
    const nextRarity = rarityOrder[idx + 1];

    const target = getNextRarityTarget(star1.rarity as StarRarity);

    const anim: MergeAnim = {
      star1Id: star1.id,
      star2Id: star2.id,
      phase: 1,
      startTime: performance.now(),
      star1X: pos1.x,
      star1Y: pos1.y,
      star2X: pos2.x,
      star2Y: pos2.y,
      currentRarity: star1.rarity as StarRarity,
      nextRarity: nextRarity,
      clone1X: pos1.x,
      clone1Y: pos1.y,
      clone2X: pos2.x,
      clone2Y: pos2.y,
      syncOpacity: 1,
      syncWhite: 0,
      shrinkScale: 1,
      targetX: target ? target.x - 24 : (pos1.x + pos2.x) / 2,
      targetY: target ? target.y - 24 : (pos1.y + pos2.y) / 2,
      newScale: 0,
      shockwaveRadius: 0,
      shockwaveOpacity: 0,
    };

    mergeAnimRef.current = anim;
    setMergeAnim(anim);
    setMerging(true);
    setSelectedStar(null);
  }, [getNextRarityTarget]);

  // Animation loop
  useEffect(() => {
    if (!mergeAnim) return;

    const animate = (now: number) => {
      const anim = mergeAnimRef.current;
      if (!anim) return;

      const elapsed = now - anim.startTime;
      const phaseDur = PHASE_DURATIONS[anim.phase];

      if (anim.phase === 1) {
        const t = Math.min(elapsed / phaseDur, 1);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const midX = (anim.star1X + anim.star2X) / 2;
        anim.clone1X = anim.star1X + (midX - anim.star1X) * ease;
        anim.clone2X = anim.star2X + (midX - anim.star2X) * ease;

        if (t >= 1) {
          anim.phase = 2;
          anim.startTime = now;
        }
      } else if (anim.phase === 2) {
        const t = Math.min(elapsed / phaseDur, 1);
        anim.syncWhite = t;
        anim.syncOpacity = 1;

        if (t >= 1) {
          anim.phase = 3;
          anim.startTime = now;
        }
      } else if (anim.phase === 3) {
        const t = Math.min(elapsed / phaseDur, 1);
        const ease = t * t;
        anim.shrinkScale = 1 - ease;

        if (t >= 1) {
          anim.phase = 4;
          anim.startTime = now;
          audioManager.playSizzlingZap();
        }
      } else if (anim.phase === 4) {
        const t = Math.min(elapsed / phaseDur, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        anim.newScale = ease;
        anim.shockwaveRadius = ease * 80;
        anim.shockwaveOpacity = 1 - t;

        if (t >= 1) {
          // Animation complete — do the backend merge
          mergeAnimRef.current = null;
          setMergeAnim(null);
          performMerge(anim.star1Id, anim.star2Id, anim.currentRarity);
          return;
        }
      }

      setMergeAnim({ ...anim });
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [mergeAnim?.phase]); // re-subscribe on phase change

  const performMerge = async (star1Id: string, star2Id: string, rarity: StarRarity) => {
    // Unlock scroll
    document.body.style.overflow = "";
    const result = await mergeStars(userId, star1Id, star2Id, rarity);
    setMerging(false);
    if (result) {
      const nextRarity = result.rarity as StarRarity;
      toast({
        title: "Stars merged!",
        description: `Created a ${STAR_CONFIG[nextRarity].label} star!`,
      });
      onStarChanged();
    }
  };

  const handleStarClick = (star: StarRecord) => {
    if (merging) return;

    // If no star selected, select this one
    if (!selectedStar) {
      // Don't select purple for merge (can't merge)
      setSelectedStar(star);
      return;
    }

    // If same star, deselect
    if (selectedStar.id === star.id) {
      setSelectedStar(null);
      return;
    }

    // If same rarity and not purple, trigger merge animation
    if (selectedStar.rarity === star.rarity && star.rarity !== "purple") {
      startMergeAnimation(selectedStar, star);
      return;
    }

    // Different rarity or purple — switch selection
    setSelectedStar(star);
  };

  const isAnimating = (starId: string) => {
    return mergeAnim && (mergeAnim.star1Id === starId || mergeAnim.star2Id === starId);
  };

  if (unassigned.length === 0) {
    return (
      <div className="text-center py-10">
        <div className="flex justify-center mb-3">
          <StarOrb rarity="yellow" size={32} className="opacity-30" />
        </div>
        <p className="font-body text-sm text-muted-foreground">No stars yet.</p>
        <p className="font-body text-xs text-muted-foreground/60 mt-1">
          Win campaign battles with 4+ stars to earn them!
        </p>
      </div>
    );
  }

  // Determine which stars should glow (same rarity as selected, not purple, not the selected star itself)
  const glowingIds = new Set<string>();
  if (selectedStar && selectedStar.rarity !== "purple") {
    unassigned.forEach(s => {
      if (s.id !== selectedStar.id && s.rarity === selectedStar.rarity) {
        glowingIds.add(s.id);
      }
    });
  }

  return (
    <div className="space-y-4 relative" ref={containerRef}>
      <p className="font-body text-[11px] text-muted-foreground">
        Tap a star to select it for merging.
      </p>
      {grouped.map(({ rarity, stars: rarityStars }) => (
        <div key={rarity} className="space-y-2">
          <div className="flex items-center gap-2">
            <StarOrb rarity={rarity} size={12} />
            <div>
              <span className="font-display text-sm tracking-wider text-muted-foreground">
                {STAR_CONFIG[rarity].label.toUpperCase()} ({rarityStars.length})
              </span>
              <p className="font-body text-[10px] text-muted-foreground/70">
                {boostPercent(rarity)}% boost per star
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-1">
            {rarityStars.map(star => {
              const isSelected = selectedStar?.id === star.id;
              const animating = isAnimating(star.id);
              return (
                <button
                  key={star.id}
                  ref={el => { starRefs.current[star.id] = el; }}
                  onClick={() => handleStarClick(star)}
                  disabled={merging}
                  className={`relative flex items-center justify-center transition-all ${
                    merging ? "opacity-50" : ""
                  }`}
                  style={{
                    visibility: animating ? "hidden" : "visible",
                  }}
                >
                  <StarOrb
                    rarity={star.rarity as StarRarity}
                    size={48}
                    selected={isSelected}
                    glowing={glowingIds.has(star.id)}
                  />
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Merge Animation Overlay */}
      {mergeAnim && (
        <div className="absolute inset-0 pointer-events-none z-50">
          {/* Phase 1-3: Clone orbs */}
          {mergeAnim.phase <= 3 && (
            <>
              {/* Clone 1 (always visible in phase 1-3) */}
              <div
                className="absolute"
                style={{
                  left: mergeAnim.clone1X,
                  top: mergeAnim.clone1Y,
                  transform: mergeAnim.phase === 3 ? `scale(${mergeAnim.shrinkScale})` : undefined,
                  transition: "none",
                }}
              >
                <div
                  className="rounded-full"
                  style={{
                    width: 48,
                    height: 48,
                    background: mergeAnim.phase >= 2
                      ? `radial-gradient(circle at 35% 35%, white 0%, white ${mergeAnim.syncWhite * 70}%, ${STAR_CONFIG[mergeAnim.currentRarity].glowColor} ${30 + mergeAnim.syncWhite * 40}%, ${STAR_CONFIG[mergeAnim.currentRarity].color} 70%, transparent 100%)`
                      : `radial-gradient(circle at 35% 35%, white 0%, ${STAR_CONFIG[mergeAnim.currentRarity].glowColor} 30%, ${STAR_CONFIG[mergeAnim.currentRarity].color} 70%, transparent 100%)`,
                    boxShadow: mergeAnim.phase >= 2
                      ? `0 0 ${16 + mergeAnim.syncWhite * 20}px ${STAR_CONFIG[mergeAnim.currentRarity].color}, 0 0 ${24 + mergeAnim.syncWhite * 30}px ${STAR_CONFIG[mergeAnim.currentRarity].color}`
                      : `0 0 16px ${STAR_CONFIG[mergeAnim.currentRarity].color}`,
                  }}
                />
              </div>
              {/* Clone 2 (hidden in phase 2+) */}
              {mergeAnim.phase === 1 && (
                <div
                  className="absolute"
                  style={{
                    left: mergeAnim.clone2X,
                    top: mergeAnim.clone2Y,
                    transition: "none",
                  }}
                >
                  <div
                    className="rounded-full"
                    style={{
                      width: 48,
                      height: 48,
                      background: `radial-gradient(circle at 35% 35%, white 0%, ${STAR_CONFIG[mergeAnim.currentRarity].glowColor} 30%, ${STAR_CONFIG[mergeAnim.currentRarity].color} 70%, transparent 100%)`,
                      boxShadow: `0 0 16px ${STAR_CONFIG[mergeAnim.currentRarity].color}`,
                    }}
                  />
                </div>
              )}
            </>
          )}

          {/* Phase 4: New star + shockwave at target position */}
          {mergeAnim.phase === 4 && (
            <div
              className="absolute"
              style={{
                left: mergeAnim.targetX,
                top: mergeAnim.targetY,
              }}
            >
              {/* Shockwave ring */}
              <div
                className="absolute rounded-full"
                style={{
                  width: mergeAnim.shockwaveRadius * 2,
                  height: mergeAnim.shockwaveRadius * 2,
                  left: 24 - mergeAnim.shockwaveRadius,
                  top: 24 - mergeAnim.shockwaveRadius,
                  border: `2px solid ${STAR_CONFIG[mergeAnim.nextRarity].color}`,
                  boxShadow: `0 0 12px ${STAR_CONFIG[mergeAnim.nextRarity].color}, inset 0 0 12px ${STAR_CONFIG[mergeAnim.nextRarity].color}40`,
                  opacity: mergeAnim.shockwaveOpacity,
                }}
              />
              {/* New star expanding */}
              <div style={{ transform: `scale(${mergeAnim.newScale})`, transformOrigin: "center" }}>
                <StarOrb rarity={mergeAnim.nextRarity} size={48} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StarInventoryGrid;
