import { useState, useEffect, useCallback } from "react";
import { Palette, Check, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import ShipDisplay from "@/components/ShipDisplay";
import ThrusterDisplay from "@/components/ThrusterDisplay";
import { SkinColourMap } from "@/game/skinUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SkinRecord {
  id: string;
  name: string;
  type: string;
  colours: SkinColourMap;
  playerSkinId?: string;
  appliedToShipId?: string | null;
}

interface GroupedSkin {
  id: string;
  name: string;
  type: string;
  colours: SkinColourMap;
  count: number;
  playerSkinIds: string[]; // all unapplied player_skins row IDs
}

interface Props {
  userId: string;
  playerShips: any[];
  currentPlayerShipId?: string;
  skinColourMap?: Record<string, SkinColourMap>;
  onSkinApplied?: () => void;
}

const HangarSkinsTab = ({ userId, playerShips, currentPlayerShipId, skinColourMap = {}, onSkinApplied }: Props) => {
  const { toast } = useToast();
  const [ownedSkins, setOwnedSkins] = useState<SkinRecord[]>([]);
  const [activeSkinIds, setActiveSkinIds] = useState<Record<string, string | null>>({});
  const [activeJetSkinIds, setActiveJetSkinIds] = useState<Record<string, string | null>>({});
  const [selectedSkin, setSelectedSkin] = useState<GroupedSkin | null>(null);
  const [applying, setApplying] = useState(false);

  const loadSkins = useCallback(async () => {
    const { data: playerSkins } = await supabase
      .from("player_skins")
      .select("id, skin_id, player_ship_id")
      .eq("user_id", userId);

    const skinIds = [...new Set((playerSkins || []).map((ps: any) => ps.skin_id))];
    
    let skinRecords: SkinRecord[] = [];
    if (skinIds.length > 0) {
      const { data: skins } = await supabase
        .from("skins")
        .select("*")
        .in("id", skinIds);
      
      for (const ps of (playerSkins || [])) {
        const s = (skins || []).find((sk: any) => sk.id === ps.skin_id);
        if (!s) continue;
        if (!ps.player_ship_id) {
          skinRecords.push({
            id: s.id,
            name: s.name,
            type: s.type,
            colours: s.colours as SkinColourMap,
            playerSkinId: ps.id,
            appliedToShipId: null,
          });
        }
      }
    }

    const skinMap: Record<string, string | null> = {};
    const jetSkinMap: Record<string, string | null> = {};
    for (const ship of playerShips) {
      skinMap[ship.id] = (ship as any).active_skin_id || null;
      jetSkinMap[ship.id] = (ship as any).active_jet_skin_id || null;
    }
    setActiveSkinIds(skinMap);
    setActiveJetSkinIds(jetSkinMap);
    setOwnedSkins(skinRecords);
  }, [userId, playerShips]);

  useEffect(() => {
    loadSkins();
  }, [loadSkins]);

  // Group skins by ID with counts
  const groupSkins = (skins: SkinRecord[]): GroupedSkin[] => {
    const map = new Map<string, GroupedSkin>();
    for (const s of skins) {
      const existing = map.get(s.id);
      if (existing) {
        existing.count++;
        if (s.playerSkinId) existing.playerSkinIds.push(s.playerSkinId);
      } else {
        map.set(s.id, {
          id: s.id,
          name: s.name,
          type: s.type,
          colours: s.colours,
          count: 1,
          playerSkinIds: s.playerSkinId ? [s.playerSkinId] : [],
        });
      }
    }
    return Array.from(map.values());
  };

  const handleApplySkin = async (skin: GroupedSkin, shipId: string) => {
    setApplying(true);
    try {
      const isJetSkin = skin.type === "jet";
      const activeField = isJetSkin ? "active_jet_skin_id" : "active_skin_id";
      const currentSkinId = isJetSkin ? activeJetSkinIds[shipId] : activeSkinIds[shipId];
      const playerSkinId = skin.playerSkinIds[0]; // use first available

      if (currentSkinId) {
        await supabase
          .from("player_skins")
          .delete()
          .eq("user_id", userId)
          .eq("skin_id", currentSkinId)
          .eq("player_ship_id", shipId);
      }

      await supabase
        .from("player_ships")
        .update({ [activeField]: skin.id } as any)
        .eq("id", shipId);

      if (playerSkinId) {
        await supabase
          .from("player_skins")
          .update({ player_ship_id: shipId })
          .eq("id", playerSkinId);
      }

      toast({ title: "Skin applied!", description: `${skin.name} skin has been equipped.` });
      setSelectedSkin(null);
      await loadSkins();
      onSkinApplied?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  const handleResetToDefault = async (shipId: string, skinType: "ship" | "jet" = "ship") => {
    setApplying(true);
    try {
      const isJet = skinType === "jet";
      const activeField = isJet ? "active_jet_skin_id" : "active_skin_id";
      const currentSkinId = isJet ? activeJetSkinIds[shipId] : activeSkinIds[shipId];
      
      if (currentSkinId) {
        await supabase
          .from("player_skins")
          .delete()
          .eq("user_id", userId)
          .eq("skin_id", currentSkinId)
          .eq("player_ship_id", shipId);
      }

      await supabase
        .from("player_ships")
        .update({ [activeField]: null } as any)
        .eq("id", shipId);

      toast({ title: "Default skin restored" });
      setSelectedSkin(null);
      await loadSkins();
      onSkinApplied?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  const currentShipActiveSkinId = currentPlayerShipId ? activeSkinIds[currentPlayerShipId] : null;
  const currentJetActiveSkinId = currentPlayerShipId ? activeJetSkinIds[currentPlayerShipId] : null;
  const availableShipSkins = ownedSkins.filter(s => s.type === "ship" && !s.appliedToShipId && s.playerSkinId);
  const availableJetSkins = ownedSkins.filter(s => s.type === "jet" && !s.appliedToShipId && s.playerSkinId);
  const groupedShipSkins = groupSkins(availableShipSkins);
  const groupedJetSkins = groupSkins(availableJetSkins);

  return (
    <div className="space-y-6">
      {/* Ship Skins */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm tracking-wider text-muted-foreground">SHIP SKINS</h2>
        </div>
        <p className="font-body text-xs text-muted-foreground">
          Apply skins to change your ship's colours. Skins are consumables — replacing one requires purchasing it again.
        </p>

        <div className="grid grid-cols-3 gap-3">
          {/* Default skin */}
          <button
            onClick={() => currentPlayerShipId && currentShipActiveSkinId ? handleResetToDefault(currentPlayerShipId) : undefined}
            className={`glass-panel p-2 space-y-1 text-center transition-all cursor-pointer ${
              !currentShipActiveSkinId ? "border-primary/50 bg-primary/5" : "hover:border-primary/30"
            }`}
          >
            <div className="relative rounded-lg bg-card/80 p-2 flex items-center justify-center aspect-square">
              <ShipDisplay shipName="AX15" className="h-14 w-14" />
              {!currentShipActiveSkinId && (
                <Badge variant="secondary" className="absolute top-1 right-1 font-display text-[7px] tracking-wider gap-0.5 px-1 py-0.5">
                  <Check className="h-2 w-2" />
                </Badge>
              )}
            </div>
            <span className="font-display text-[9px] tracking-wider text-foreground block">DEFAULT</span>
          </button>

          {groupedShipSkins.map((skin) => (
            <button
              key={skin.id}
              onClick={() => setSelectedSkin(skin)}
              className="glass-panel p-2 space-y-1 text-center transition-all hover:border-primary/30 cursor-pointer"
            >
              <div className="relative rounded-lg bg-card/80 p-2 flex items-center justify-center aspect-square">
                <ShipDisplay shipName="AX15" className="h-14 w-14" skinColours={skin.colours} />
                {skin.count > 1 && (
                  <Badge variant="default" className="absolute top-1 right-1 font-display text-[7px] tracking-wider px-1 py-0.5">
                    x{skin.count}
                  </Badge>
                )}
              </div>
              <span className="font-display text-[9px] tracking-wider text-foreground block">{skin.name}</span>
            </button>
          ))}
        </div>

        {groupedShipSkins.length === 0 && (
          <p className="font-body text-xs text-muted-foreground/60 text-center">
            No ship skins available. Purchase skins from the Store!
          </p>
        )}
      </div>

      {/* Jet / Flame Skins */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm tracking-wider text-muted-foreground">JET SKINS</h2>
        </div>
        <p className="font-body text-xs text-muted-foreground">
          Customise your thruster flame colours. Jet skins are consumables.
        </p>

        <div className="grid grid-cols-3 gap-3">
          {/* Default jet */}
          <button
            onClick={() => currentPlayerShipId && currentJetActiveSkinId ? handleResetToDefault(currentPlayerShipId, "jet") : undefined}
            className={`glass-panel p-2 space-y-1 text-center transition-all cursor-pointer ${
              !currentJetActiveSkinId ? "border-primary/50 bg-primary/5" : "hover:border-primary/30"
            }`}
          >
            <div className="relative rounded-lg bg-card/80 p-2 flex items-center justify-center aspect-square">
              <ThrusterDisplay className="h-14 w-14" />
              {!currentJetActiveSkinId && (
                <Badge variant="secondary" className="absolute top-1 right-1 font-display text-[7px] tracking-wider gap-0.5 px-1 py-0.5">
                  <Check className="h-2 w-2" />
                </Badge>
              )}
            </div>
            <span className="font-display text-[9px] tracking-wider text-foreground block">DEFAULT</span>
          </button>

          {groupedJetSkins.map((skin) => (
            <button
              key={skin.id}
              onClick={() => setSelectedSkin(skin)}
              className="glass-panel p-2 space-y-1 text-center transition-all hover:border-primary/30 cursor-pointer"
            >
              <div className="relative rounded-lg bg-card/80 p-2 flex items-center justify-center aspect-square">
                <ThrusterDisplay className="h-14 w-14" skinColours={skin.colours} />
                {skin.count > 1 && (
                  <Badge variant="default" className="absolute top-1 right-1 font-display text-[7px] tracking-wider px-1 py-0.5">
                    x{skin.count}
                  </Badge>
                )}
              </div>
              <span className="font-display text-[9px] tracking-wider text-foreground block">{skin.name}</span>
            </button>
          ))}
        </div>

        {groupedJetSkins.length === 0 && (
          <p className="font-body text-xs text-muted-foreground/60 text-center">
            No jet skins available. Purchase skins from the Store!
          </p>
        )}
      </div>

      {/* Apply skin dialog — now with ship thumbnails */}
      <Dialog open={!!selectedSkin} onOpenChange={(open) => !open && setSelectedSkin(null)}>
        <DialogContent className="glass-panel border-border/50 max-w-sm">
          {selectedSkin && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-lg tracking-wider text-primary">
                  APPLY {selectedSkin.name.toUpperCase()} SKIN
                </DialogTitle>
              </DialogHeader>
              <div className="rounded-lg bg-card/80 p-4 flex items-center justify-center">
                {selectedSkin.type === "jet" ? (
                  <ThrusterDisplay className="h-24 w-24" skinColours={selectedSkin.colours} />
                ) : (
                  <ShipDisplay shipName="AX15" className="h-24 w-24" skinColours={selectedSkin.colours} />
                )}
              </div>
              <p className="font-body text-xs text-muted-foreground text-center">
                Select a ship to apply this skin to. This will consume the skin.
              </p>
              <div className="space-y-2">
                {playerShips.map((ship) => {
                  const shipActiveSkinId = activeSkinIds[ship.id];
                  const shipSkinColours = shipActiveSkinId ? skinColourMap[shipActiveSkinId] : undefined;
                  return (
                    <button
                      key={ship.id}
                      onClick={() => handleApplySkin(selectedSkin, ship.id)}
                      disabled={applying}
                      className="w-full glass-panel p-2 flex items-center gap-3 transition-all hover:border-primary/30 cursor-pointer disabled:opacity-50"
                    >
                      <div className="h-10 w-10 flex-shrink-0">
                        <ShipDisplay shipName={ship.ships?.name || "AX15"} className="h-10 w-10" skinColours={shipSkinColours} />
                      </div>
                      <span className="font-display text-xs tracking-wider text-foreground flex-1 text-left">
                        {ship.ships?.name || "Ship"}
                      </span>
                      {shipActiveSkinId === selectedSkin.id && (
                        <Badge variant="secondary" className="text-[8px]">ACTIVE</Badge>
                      )}
                      {shipActiveSkinId && shipActiveSkinId !== selectedSkin.id && (
                        <Badge variant="outline" className="text-[8px]">SKINNED</Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HangarSkinsTab;
