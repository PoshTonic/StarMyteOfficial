import { supabase } from "@/integrations/supabase/client";

interface StatsIncrement {
  battles_fought?: number;
  pvp_wins?: number;
  pvp_losses?: number;
  enemies_defeated?: number;
  asteroids_destroyed?: number;
  bosses_defeated?: number;
  distance_flown?: number;
}

/**
 * Upsert ship_stats: increment the given fields for the player's active ship.
 * Uses select + insert/update since Supabase JS doesn't support ON CONFLICT increments natively.
 */
export async function upsertShipStats(
  userId: string,
  playerShipId: string,
  increment: StatsIncrement
): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from("ship_stats" as any)
      .select("*")
      .eq("player_ship_id", playerShipId)
      .single();

    if (existing) {
      const updates: Record<string, number> = {};
      for (const [key, val] of Object.entries(increment)) {
        if (val && val > 0) {
          updates[key] = ((existing as any)[key] || 0) + val;
        }
      }
      if (Object.keys(updates).length > 0) {
        await supabase
          .from("ship_stats" as any)
          .update(updates as any)
          .eq("player_ship_id", playerShipId);
      }
    } else {
      await supabase.from("ship_stats" as any).insert({
        user_id: userId,
        player_ship_id: playerShipId,
        ...increment,
      } as any);
    }
  } catch (e) {
    console.error("Failed to upsert ship stats:", e);
  }
}
