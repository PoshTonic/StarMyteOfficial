import { supabase } from "@/integrations/supabase/client";
import { STAR_CONFIG, StarRarity, StarAttribute } from "./constants";
import { xpForLevel } from "./xpHelper";

export interface StarRecord {
  id: string;
  user_id: string;
  rarity: StarRarity;
  assigned_to_type: string | null;
  assigned_to_id: string | null;
  assigned_attribute: string | null;
  assigned_slot: number | null;
  created_at: string;
}

export async function fetchUserStars(userId: string): Promise<StarRecord[]> {
  const { data } = await supabase
    .from("star_inventory" as any)
    .select("*")
    .eq("user_id", userId);
  return (data || []) as unknown as StarRecord[];
}

export async function insertStar(userId: string, rarity: StarRarity): Promise<StarRecord | null> {
  const { data } = await supabase
    .from("star_inventory" as any)
    .insert({ user_id: userId, rarity } as any)
    .select()
    .single();
  return data as unknown as StarRecord | null;
}

export async function assignStar(
  starId: string,
  assignedToType: "profile" | "ship",
  assignedToId: string | null,
  attribute: StarAttribute,
  slot: number
): Promise<boolean> {
  const { error } = await supabase
    .from("star_inventory" as any)
    .update({
      assigned_to_type: assignedToType,
      assigned_to_id: assignedToId,
      assigned_attribute: attribute,
      assigned_slot: slot,
    } as any)
    .eq("id", starId);
  return !error;
}

export async function unassignStar(starId: string): Promise<boolean> {
  const { error } = await supabase
    .from("star_inventory" as any)
    .update({
      assigned_to_type: null,
      assigned_to_id: null,
      assigned_attribute: null,
      assigned_slot: null,
    } as any)
    .eq("id", starId);
  return !error;
}

export async function deleteStar(starId: string): Promise<boolean> {
  const { error } = await supabase
    .from("star_inventory" as any)
    .delete()
    .eq("id", starId);
  return !error;
}

export async function mergeStars(
  userId: string,
  star1Id: string,
  star2Id: string,
  currentRarity: StarRarity
): Promise<StarRecord | null> {
  const rarityOrder: StarRarity[] = ["yellow", "blue", "orange", "red", "purple"];
  const idx = rarityOrder.indexOf(currentRarity);
  if (idx >= rarityOrder.length - 1) return null; // Can't merge legendary
  const nextRarity = rarityOrder[idx + 1];
  
  // Delete both stars, insert new one
  await Promise.all([deleteStar(star1Id), deleteStar(star2Id)]);
  return insertStar(userId, nextRarity);
}

/**
 * Calculate cumulative multiplier for an attribute from assigned stars.
 */
export function calculateMultiplier(stars: StarRecord[], attribute: StarAttribute): number {
  const assigned = stars.filter(
    s => s.assigned_attribute === attribute && s.assigned_to_type !== null
  );
  let multiplier = 1;
  for (const s of assigned) {
    multiplier *= STAR_CONFIG[s.rarity as StarRarity].multiplier;
  }
  return multiplier;
}

/**
 * Get multipliers from both profile and ship stars for a given ship.
 */
export function getCompositeMultipliers(
  allStars: StarRecord[],
  playerShipId: string
): Record<StarAttribute, number> {
  const profileStars = allStars.filter(s => s.assigned_to_type === "profile");
  const shipStars = allStars.filter(
    s => s.assigned_to_type === "ship" && s.assigned_to_id === playerShipId
  );
  const combined = [...profileStars, ...shipStars];
  
  return {
    hp: calculateMultiplier(combined, "hp"),
    dmg: calculateMultiplier(combined, "dmg"),
    fuel: calculateMultiplier(combined, "fuel"),
    heat: calculateMultiplier(combined, "heat"),
  };
}

/**
 * Check level up. Returns new level and whether leveled up.
 */
export function checkLevelUp(currentXp: number, currentLevel: number, xpGained: number): {
  newXp: number;
  newLevel: number;
  levelsGained: number;
} {
  let xp = currentXp + xpGained;
  let level = currentLevel;
  let levelsGained = 0;
  
  // level N requires xpForLevel(N) XP to advance (1.6x curve)
  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level++;
    levelsGained++;
  }
  
  return { newXp: xp, newLevel: level, levelsGained };
}
