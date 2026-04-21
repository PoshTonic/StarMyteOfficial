import React, { useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  STAR_CONFIG,
  STAR_ATTRIBUTES,
  STAR_SLOTS_PER_ATTRIBUTE,
  STAR_REMOVAL_COST,
  StarRarity,
  StarAttribute,
} from "@/game/constants";
import { StarRecord, assignStar, unassignStar } from "@/game/starUtils";
import { useToast } from "@/hooks/use-toast";
import StarOrb from "@/components/StarOrb";

interface StarSlotGridProps {
  assignedStars: StarRecord[];
  unassignedStars: StarRecord[];
  assignedToType: "profile" | "ship";
  assignedToId: string | null;
  credits: number;
  onStarChanged: () => void;
  onCreditsSpent: (amount: number) => void;
}

const ATTRIBUTE_LABELS: Record<StarAttribute, string> = {
  hp: "HP",
  dmg: "DMG",
  fuel: "FUEL",
  heat: "HEAT",
};

const SLOTS_PER_ROW = STAR_SLOTS_PER_ATTRIBUTE; // 5

/** Get all assigned stars for a given attribute on this target */
function getStarsForAttribute(
  assignedStars: StarRecord[],
  attr: StarAttribute,
  assignedToType: "profile" | "ship",
  assignedToId: string | null
): StarRecord[] {
  return assignedStars.filter(
    s =>
      s.assigned_attribute === attr &&
      s.assigned_to_type === assignedToType &&
      (assignedToType === "profile" || s.assigned_to_id === assignedToId)
  );
}

/** Check if a row (0-indexed) is fully filled with Legendary stars */
function isRowFullLegendary(
  attrStars: StarRecord[],
  rowIndex: number
): boolean {
  const startSlot = rowIndex * SLOTS_PER_ROW + 1;
  for (let i = 0; i < SLOTS_PER_ROW; i++) {
    const star = attrStars.find(s => s.assigned_slot === startSlot + i);
    if (!star || (star.rarity as StarRarity) !== "purple") return false;
  }
  return true;
}

/** Check if a row has any stars */
function isRowEmpty(attrStars: StarRecord[], rowIndex: number): boolean {
  const startSlot = rowIndex * SLOTS_PER_ROW + 1;
  for (let i = 0; i < SLOTS_PER_ROW; i++) {
    if (attrStars.find(s => s.assigned_slot === startSlot + i)) return false;
  }
  return true;
}

/** Calculate how many rows to show for an attribute */
function getRowCount(attrStars: StarRecord[]): number {
  let rows = 1;
  while (isRowFullLegendary(attrStars, rows - 1)) {
    rows++;
  }
  return rows;
}

const StarSlotGrid = ({
  assignedStars,
  unassignedStars,
  assignedToType,
  assignedToId,
  credits,
  onStarChanged,
  onCreditsSpent,
}: StarSlotGridProps) => {
  const { toast } = useToast();
  const [pickingSlot, setPickingSlot] = useState<{ attr: StarAttribute; slot: number } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<StarRecord | null>(null);

  const getStarForSlot = (attr: StarAttribute, slot: number): StarRecord | undefined => {
    return assignedStars.find(
      s =>
        s.assigned_attribute === attr &&
        s.assigned_slot === slot &&
        s.assigned_to_type === assignedToType &&
        (assignedToType === "profile" || s.assigned_to_id === assignedToId)
    );
  };

  const getMultiplierForAttribute = (attr: StarAttribute): number => {
    const stars = getStarsForAttribute(assignedStars, attr, assignedToType, assignedToId);
    let mult = 1;
    for (const s of stars) {
      mult *= STAR_CONFIG[s.rarity as StarRarity].multiplier;
    }
    return mult;
  };

  const isSlotUnlocked = (attr: StarAttribute, slot: number): boolean => {
    const rowIndex = Math.floor((slot - 1) / SLOTS_PER_ROW);
    const posInRow = (slot - 1) % SLOTS_PER_ROW;

    if (rowIndex === 0) {
      // First row: sequential unlock
      if (posInRow === 0) return true;
      return !!getStarForSlot(attr, slot - 1);
    }

    // Expansion rows: previous row must be full legendary
    const attrStars = getStarsForAttribute(assignedStars, attr, assignedToType, assignedToId);
    if (!isRowFullLegendary(attrStars, rowIndex - 1)) return false;

    // Sequential within the row
    if (posInRow === 0) return true;
    return !!getStarForSlot(attr, slot - 1);
  };

  const canRemoveStar = (star: StarRecord): boolean => {
    if (!star.assigned_slot) return true;
    const slot = star.assigned_slot;
    const rowIndex = Math.floor((slot - 1) / SLOTS_PER_ROW);
    const attrStars = getStarsForAttribute(
      assignedStars,
      star.assigned_attribute as StarAttribute,
      assignedToType,
      assignedToId
    );

    // If there's a next row with any stars, can't remove from this row
    if (!isRowEmpty(attrStars, rowIndex + 1)) {
      return false;
    }

    // Can't remove if a later slot in the same row has a star
    const startSlot = rowIndex * SLOTS_PER_ROW + 1;
    const endSlot = startSlot + SLOTS_PER_ROW - 1;
    for (let s = slot + 1; s <= endSlot; s++) {
      if (attrStars.find(st => st.assigned_slot === s)) return false;
    }
    return true;
  };

  const handleSlotClick = (attr: StarAttribute, slot: number) => {
    const existing = getStarForSlot(attr, slot);
    if (existing) {
      if (!canRemoveStar(existing)) {
        toast({ title: "Can't remove", description: "Clear the expansion row first." });
        return;
      }
      setConfirmRemove(existing);
      return;
    }
    if (!isSlotUnlocked(attr, slot)) {
      toast({ title: "Locked", description: "Fill the previous slot first." });
      return;
    }
    setPickingSlot({ attr, slot });
  };

  const handleAssignStar = async (star: StarRecord) => {
    if (!pickingSlot) return;
    const ok = await assignStar(
      star.id,
      assignedToType,
      assignedToId,
      pickingSlot.attr,
      pickingSlot.slot
    );
    if (ok) {
      toast({ title: "Star equipped!" });
      onStarChanged();
    }
    setPickingSlot(null);
  };

  const handleRemoveStar = async () => {
    if (!confirmRemove) return;
    if (credits < STAR_REMOVAL_COST) {
      toast({ title: "Not enough credits", description: `Need ${STAR_REMOVAL_COST} credits.`, variant: "destructive" });
      setConfirmRemove(null);
      return;
    }
    const ok = await unassignStar(confirmRemove.id);
    if (ok) {
      onCreditsSpent(STAR_REMOVAL_COST);
      toast({ title: "Star removed", description: `${STAR_REMOVAL_COST} credits spent.` });
      onStarChanged();
    }
    setConfirmRemove(null);
  };

  const bonusPercent = (attr: StarAttribute) => {
    const mult = getMultiplierForAttribute(attr);
    const pct = (mult - 1) * 100;
    return `+${pct.toFixed(1)}%`;
  };

  /** Get filtered stars for the picker based on slot */
  const getPickerStars = (): StarRecord[] => {
    if (!pickingSlot) return [];
    return unassignedStars;
  };

  return (
    <div className="space-y-4 max-h-[340px] overflow-y-auto pr-1">
      {STAR_ATTRIBUTES.map(attr => {
        const attrStars = getStarsForAttribute(assignedStars, attr, assignedToType, assignedToId);
        const rowCount = getRowCount(attrStars);

        return (
          <div key={attr} className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-[10px] tracking-wider text-muted-foreground">
                {ATTRIBUTE_LABELS[attr]}
              </span>
              <Badge variant="outline" className="font-display text-[10px] text-primary border-primary/30 whitespace-nowrap">
                {bonusPercent(attr)}
              </Badge>
            </div>

            {Array.from({ length: rowCount }, (_, rowIdx) => {
              const startSlot = rowIdx * SLOTS_PER_ROW + 1;
              const isExpansion = rowIdx > 0;

              return (
                <div key={rowIdx} className="space-y-0.5">
                  {isExpansion && (
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[8px] font-display tracking-widest text-purple-400/70">
                        ★ LEGENDARY ROW
                      </span>
                      <div className="flex-1 h-px bg-purple-500/20" />
                    </div>
                  )}
                  <div
                    className="grid items-center w-full"
                    style={{ gridTemplateColumns: 'auto 1fr auto 1fr auto 1fr auto 1fr auto' }}
                  >
                    {Array.from({ length: SLOTS_PER_ROW }, (_, i) => {
                      const slot = startSlot + i;
                      const star = getStarForSlot(attr, slot);
                      const unlocked = isSlotUnlocked(attr, slot);
                      const isNextAvailable = !star && unlocked;
                      return (
                        <React.Fragment key={slot}>
                          {i > 0 && (
                            <div
                              className={`h-[2px] transition-all ${
                                getStarForSlot(attr, slot - 1)
                                  ? "bg-primary shadow-[0_0_6px_hsl(var(--primary))]"
                                  : "bg-muted/50"
                              }`}
                            />
                          )}
                          <button
                            onClick={() => handleSlotClick(attr, slot)}
                            className={`relative h-9 w-9 shrink-0 rounded-full flex items-center justify-center transition-all ${
                              star
                                ? ""
                                : isNextAvailable
                                ? "border-2 border-primary/60 hover:border-primary bg-muted/20"
                                : "border-2 border-border/60 bg-muted/30 opacity-80"
                            }`}
                          >
                            {star && (
                              <StarOrb rarity={star.rarity as StarRarity} size={36} />
                            )}
                          </button>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Star picker modal */}
      {pickingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-[90%] max-w-[340px] rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-display text-sm tracking-wider">
                SELECT STAR — {ATTRIBUTE_LABELS[pickingSlot.attr]} SLOT {pickingSlot.slot}
              </span>
              <button onClick={() => setPickingSlot(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            {getPickerStars().length === 0 ? (
              <p className="text-sm text-muted-foreground font-body text-center py-4">
                No unassigned stars available. Win campaign battles to earn stars!
              </p>
            ) : (
              <div className="grid grid-cols-5 gap-3 max-h-[200px] overflow-y-auto">
                {getPickerStars().map(star => (
                  <button
                    key={star.id}
                    onClick={() => handleAssignStar(star)}
                    className="flex items-center justify-center transition-all hover:scale-110"
                  >
                    <StarOrb rarity={star.rarity as StarRarity} size={48} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Remove confirmation */}
      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-[85%] max-w-[300px] rounded-xl border border-border bg-card p-5 space-y-4 text-center">
            <p className="font-display text-sm tracking-wider">REMOVE STAR?</p>
            <div className="flex items-center justify-center gap-2">
              <StarOrb rarity={confirmRemove.rarity as StarRarity} size={40} />
              <span className="font-display text-xs" style={{ color: STAR_CONFIG[confirmRemove.rarity as StarRarity].color }}>
                {STAR_CONFIG[confirmRemove.rarity as StarRarity].label}
              </span>
            </div>
            <p className="text-sm text-muted-foreground font-body">
              Cost: <span className="text-yellow-400">{STAR_REMOVAL_COST}</span> credits
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmRemove(null)}
                className="flex-1 rounded-lg border border-border/30 bg-card/50 px-3 py-2 font-display text-[10px] tracking-wider text-muted-foreground"
              >
                CANCEL
              </button>
              <button
                onClick={handleRemoveStar}
                className="flex-1 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 font-display text-[10px] tracking-wider text-destructive"
              >
                REMOVE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StarSlotGrid;
