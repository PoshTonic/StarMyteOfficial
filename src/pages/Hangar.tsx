import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus, Palette, TrendingUp, Trophy, Crosshair, Target, Rocket, Skull, Map } from "lucide-react";
import { weaponImages } from "@/game/weaponImages";
import GameImage from "@/components/GameImage";
import { WEAPON_DESCRIPTIONS } from "@/game/weaponDescriptions";
import StarOrb from "@/components/StarOrb";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import WeaponSelectDialog from "@/components/WeaponSelectDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ShipDisplay from "@/components/ShipDisplay";
import StarSlotGrid from "@/components/StarSlotGrid";
import HangarSkinsTab from "@/components/HangarSkinsTab";
import StarInventoryGrid from "@/components/StarInventoryGrid";
import { fetchUserStars, StarRecord, getCompositeMultipliers } from "@/game/starUtils";
import { SkinColourMap } from "@/game/skinUtils";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { ShipStats, getBestFlex } from "@/data/flexRemarks";

type HangarTab = "hangar" | "stars" | "skins";

const Hangar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [playerShips, setPlayerShips] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [weapons, setWeapons] = useState<any[]>([]);
  const [allWeapons, setAllWeapons] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [detailWeapon, setDetailWeapon] = useState<any | null>(null);
  const [ownedWeaponIds, setOwnedWeaponIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<HangarTab>("hangar");
  const [stars, setStars] = useState<StarRecord[]>([]);
  const [credits, setCredits] = useState(0);
  const [showEmptySlotsWarning, setShowEmptySlotsWarning] = useState(false);
  const [skinColourMap, setSkinColourMap] = useState<Record<string, SkinColourMap>>({});
  const [shipStats, setShipStats] = useState<ShipStats | null>(null);

  const currentPlayerShip = playerShips[currentIndex];
  const ship = currentPlayerShip?.ships;

  const loadStars = useCallback(async () => {
    if (!user) return;
    const data = await fetchUserStars(user.id);
    setStars(data);
  }, [user]);

  const loadWeapons = useCallback(async (playerShipId: string) => {
    const { data } = await supabase
      .from("player_weapons")
      .select("*, weapons(*)")
      .eq("player_ship_id", playerShipId)
      .order("slot");
    if (data) {
      setWeapons(data.map((pw: any) => ({ ...pw.weapons, slot: pw.slot, pw_id: pw.id })));
    }
  }, []);

  const loadShipStats = useCallback(async (playerShipId: string) => {
    const { data } = await supabase
      .from("ship_stats" as any)
      .select("*")
      .eq("player_ship_id", playerShipId)
      .single();
    if (data) {
      setShipStats({
        battles_fought: (data as any).battles_fought || 0,
        pvp_wins: (data as any).pvp_wins || 0,
        pvp_losses: (data as any).pvp_losses || 0,
        enemies_defeated: (data as any).enemies_defeated || 0,
        asteroids_destroyed: (data as any).asteroids_destroyed || 0,
        bosses_defeated: (data as any).bosses_defeated || 0,
        distance_flown: (data as any).distance_flown || 0,
      });
    } else {
      setShipStats(null);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      const [{ data: ships }, { data: weaponCatalog }, { data: ownedWeapons }, { data: profileData }] = await Promise.all([
        supabase.from("player_ships").select("*, ships(*)").eq("user_id", user.id).order("created_at"),
        supabase.from("weapons").select("*").order("created_at"),
        supabase.from("player_owned_weapons").select("weapon_id").eq("user_id", user.id),
        supabase.from("profiles").select("credits").eq("id", user.id).single(),
      ]);

      if (ships && ships.length > 0) {
        setPlayerShips(ships);
        const activeIdx = ships.findIndex((s: any) => s.is_active);
        const idx = activeIdx >= 0 ? activeIdx : 0;
        setCurrentIndex(idx);
        await loadWeapons(ships[idx].id);
        await loadShipStats(ships[idx].id);

        // Fetch skin colour maps for all active skins
        const activeSkinIds = [...new Set([
          ...ships.map((s: any) => s.active_skin_id),
          ...ships.map((s: any) => s.active_jet_skin_id),
        ].filter(Boolean))];
        if (activeSkinIds.length > 0) {
          const { data: skinData } = await supabase.from("skins").select("id, colours").in("id", activeSkinIds);
          const map: Record<string, SkinColourMap> = {};
          (skinData || []).forEach((s: any) => { map[s.id] = s.colours as SkinColourMap; });
          setSkinColourMap(map);
        }
      }
      if (weaponCatalog) setAllWeapons(weaponCatalog);
      setOwnedWeaponIds(new Set((ownedWeapons || []).map((ow: any) => ow.weapon_id)));
      setCredits(profileData?.credits || 0);
    };
    loadData();
    loadStars();
  }, [user, loadWeapons, loadStars, loadShipStats]);

  const switchShip = useCallback(async (newIndex: number) => {
    if (!user || !playerShips[newIndex]) return;
    const newShip = playerShips[newIndex];
    await supabase.from("player_ships").update({ is_active: false }).eq("user_id", user.id);
    await supabase.from("player_ships").update({ is_active: true }).eq("id", newShip.id);
    setPlayerShips(prev => prev.map((s, i) => ({ ...s, is_active: i === newIndex })));
    setCurrentIndex(newIndex);
    await loadWeapons(newShip.id);
    await loadShipStats(newShip.id);
  }, [user, playerShips, loadWeapons, loadShipStats]);

  const handleWeaponSelect = useCallback(async (weaponId: string) => {
    if (!user || !currentPlayerShip || selectedSlot === null) return;

    const existingInSlot = weapons.find(w => w.slot === selectedSlot);
    const alreadyEquippedElsewhere = weapons.find(w => w.id === weaponId && w.slot !== selectedSlot);

    if (alreadyEquippedElsewhere && existingInSlot) {
      // Swap: update both rows
      await Promise.all([
        supabase.from("player_weapons").update({ weapon_id: weaponId }).eq("id", existingInSlot.pw_id),
        supabase.from("player_weapons").update({ weapon_id: existingInSlot.id }).eq("id", alreadyEquippedElsewhere.pw_id),
      ]);
    } else if (alreadyEquippedElsewhere && !existingInSlot) {
      // Move from other slot to this empty slot
      await supabase.from("player_weapons").update({ slot: selectedSlot }).eq("id", alreadyEquippedElsewhere.pw_id);
    } else if (existingInSlot) {
      // Replace weapon in current slot
      await supabase.from("player_weapons").update({ weapon_id: weaponId }).eq("id", existingInSlot.pw_id);
    } else {
      // Insert new weapon into empty slot
      await supabase.from("player_weapons").insert({
        user_id: user.id,
        weapon_id: weaponId,
        player_ship_id: currentPlayerShip.id,
        slot: selectedSlot,
      });
    }

    await loadWeapons(currentPlayerShip.id);
    setSelectedSlot(null);
  }, [user, currentPlayerShip, selectedSlot, weapons, loadWeapons]);

  const handleWeaponRemove = useCallback(async () => {
    if (!currentPlayerShip || selectedSlot === null) return;
    const existing = weapons.find(w => w.slot === selectedSlot);
    if (existing) {
      await supabase.from("player_weapons").delete().eq("id", existing.pw_id);
      await loadWeapons(currentPlayerShip.id);
    }
    setSelectedSlot(null);
  }, [currentPlayerShip, selectedSlot, weapons, loadWeapons]);

  const handleBack = () => {
    const filledSlots = weapons.length;
    if (filledSlots < 4) {
      setShowEmptySlotsWarning(true);
      return;
    }
  };

  const handleCreditsSpent = async (amount: number) => {
    if (!user) return;
    const newCredits = Math.max(0, credits - amount);
    await supabase.from("profiles").update({ credits: newCredits }).eq("id", user.id);
    setCredits(newCredits);
  };

  const statBar = (label: string, value: number, max: number, colorClass: string, buffedValue?: number) => (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-body">
        <span className="text-muted-foreground">{label}</span>
        <div className="flex items-center gap-1">
          <span className="text-foreground">{value}</span>
          {buffedValue !== undefined && buffedValue !== value && (
            <span className="flex items-center gap-0.5 text-green-400">
              <TrendingUp className="h-2.5 w-2.5" />
              {buffedValue}
            </span>
          )}
        </div>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${colorClass} transition-all`} style={{ width: `${(Math.max(value, buffedValue || 0) / max) * 100}%` }} />
      </div>
    </div>
  );

  const currentWeaponForSlot = (slot: number) => weapons.find(ww => ww.slot === slot) || null;

  const shipStars = currentPlayerShip
    ? stars.filter(s => s.assigned_to_type === "ship" && s.assigned_to_id === currentPlayerShip.id)
    : [];
  const unassignedStars = stars.filter(s => !s.assigned_to_type);

  const multipliers = currentPlayerShip ? getCompositeMultipliers(stars, currentPlayerShip.id) : { hp: 1, dmg: 1, fuel: 1, heat: 1 };
  const avgDmg = weapons.length > 0 ? Math.round(weapons.reduce((s, w) => s + (w.dmg || 0), 0) / weapons.length) : 0;

  return (
    <div className="px-4 py-4 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-bold tracking-wider text-primary glow-text">HANGAR</h1>
          <Badge variant="default" className="font-display text-[8px] tracking-wider">ACTIVE</Badge>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("hangar")}
            className={`flex-1 rounded-lg border px-3 py-2 font-display text-[10px] tracking-wider transition-all ${
              activeTab === "hangar" ? "border-primary bg-primary/10 text-primary" : "border-border/30 bg-card/50 text-muted-foreground"
            }`}
          >
            HANGAR
          </button>
          <button
            onClick={() => setActiveTab("stars")}
            className={`flex-1 rounded-lg border px-3 py-2 font-display text-[10px] tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "stars" ? "border-primary bg-primary/10 text-primary" : "border-border/30 bg-card/50 text-muted-foreground"
            }`}
          >
            <StarOrb rarity="yellow" size={12} />
            STARS ({unassignedStars.length})
          </button>
          <button
            onClick={() => setActiveTab("skins")}
            className={`flex-1 rounded-lg border px-3 py-2 font-display text-[10px] tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "skins" ? "border-primary bg-primary/10 text-primary" : "border-border/30 bg-card/50 text-muted-foreground"
            }`}
          >
            <Palette className="h-3 w-3" />
            SKINS
          </button>
        </div>

        {activeTab === "skins" && user && (
          <div className="glass-panel p-6">
            <HangarSkinsTab
              userId={user.id}
              playerShips={playerShips}
              currentPlayerShipId={currentPlayerShip?.id}
              skinColourMap={skinColourMap}
              onSkinApplied={() => {
                // Reload ships to get updated active_skin_id and skin colours
                const reload = async () => {
                  const { data: ships } = await supabase.from("player_ships").select("*, ships(*)").eq("user_id", user.id).order("created_at");
                  if (ships) {
                    setPlayerShips(ships);
                    const activeSkinIds = [...new Set([
                      ...ships.map((s: any) => s.active_skin_id),
                      ...ships.map((s: any) => s.active_jet_skin_id),
                    ].filter(Boolean))];
                    if (activeSkinIds.length > 0) {
                      const { data: skinData } = await supabase.from("skins").select("id, colours").in("id", activeSkinIds);
                      const map: Record<string, SkinColourMap> = {};
                      (skinData || []).forEach((s: any) => { map[s.id] = s.colours as SkinColourMap; });
                      setSkinColourMap(map);
                    } else {
                      setSkinColourMap({});
                    }
                  }
                };
                reload();
              }}
            />
          </div>
        )}

        {activeTab === "stars" && user && (
          <div className="glass-panel p-6">
            <StarInventoryGrid stars={stars} userId={user.id} onStarChanged={loadStars} />
          </div>
        )}

        {activeTab === "hangar" && ship && (
          <>
            <div className="glass-panel p-6 space-y-6">
              {/* Ship display with navigation */}
              <div className="flex items-center gap-2">
                <button onClick={() => switchShip(currentIndex - 1)} disabled={currentIndex <= 0}
                  className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-all">
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <div className="flex-1 flex flex-col items-center gap-4">
                  <div className="relative flex h-40 w-40 items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-primary/10 animate-pulse-glow" />
                    <div className="relative z-10">
                      <ShipDisplay shipName={ship.name} className="h-32 w-32" skinColours={currentPlayerShip?.active_skin_id ? skinColourMap[currentPlayerShip.active_skin_id] : undefined} />
                    </div>
                  </div>
                  <div className="text-center">
                    <h2 className="font-display text-xl tracking-wider text-foreground">{ship.name}</h2>
                    <p className="font-body text-xs text-muted-foreground">{currentIndex + 1} / {playerShips.length}</p>
                  </div>
                </div>
                <button onClick={() => switchShip(currentIndex + 1)} disabled={currentIndex >= playerShips.length - 1}
                  className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-all">
                  <ChevronRight className="h-6 w-6" />
                </button>
              </div>

              {/* Ship stats */}
              <div className="space-y-3">
                {statBar("HP", ship.hp, 100, "bg-game-hp", Math.round(ship.hp * multipliers.hp))}
                {statBar("SPEED", ship.speed, 100, "bg-green-500")}
                {statBar("FUEL", ship.fuel, 100, "bg-game-fuel", Math.round(ship.fuel * multipliers.fuel))}
                {statBar("HEAT CAP", ship.heat_cap, 100, "bg-game-heat", Math.round(ship.heat_cap * multipliers.heat))}
                {statBar("AVG DMG", avgDmg, 100, "bg-purple-500", Math.round(avgDmg * multipliers.dmg))}
              </div>
            </div>

            {/* Ship Star Slots */}
            {currentPlayerShip && (
              <div className="glass-panel space-y-4 p-6">
                <div className="flex items-center gap-2">
                  <StarOrb rarity="yellow" size={16} />
                  <h2 className="font-display text-sm tracking-wider text-muted-foreground">SHIP ATTRIBUTES</h2>
                </div>
                <p className="font-body text-xs text-muted-foreground">
                  Apply Stars to your Ship's attributes to boost your stats!
                </p>
                <StarSlotGrid
                  assignedStars={shipStars}
                  unassignedStars={unassignedStars}
                  assignedToType="ship"
                  assignedToId={currentPlayerShip.id}
                  credits={credits}
                  onStarChanged={loadStars}
                  onCreditsSpent={handleCreditsSpent}
                />
              </div>
            )}

            {/* Weapons */}
            <div className="space-y-3">
              <h2 className="font-display text-sm tracking-wider text-muted-foreground">EQUIPPED WEAPONS</h2>
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((slotNumber) => {
                  const w = currentWeaponForSlot(slotNumber);
                  if (w) {
                    const img = weaponImages[w.name];
                    return (
                      <button key={slotNumber} onClick={() => setDetailWeapon({ ...w, slotNumber })}
                        className="glass-panel p-2 space-y-1.5 text-left transition-all hover:border-primary/50 cursor-pointer">
                        <div className="rounded-md overflow-hidden aspect-square">
                          {img && <GameImage src={img} alt={w.name} className="w-full h-full object-cover" />}
                        </div>
                        <span className="font-display text-[10px] tracking-wider text-center block">{w.name}</span>
                      </button>
                    );
                  }
                  return (
                    <button key={slotNumber} onClick={() => setSelectedSlot(slotNumber)}
                      className="glass-panel p-4 flex flex-col items-center justify-center gap-2 min-h-[100px] text-muted-foreground/40 hover:text-muted-foreground hover:border-primary/30 transition-all cursor-pointer">
                      <Plus className="h-6 w-6" />
                      <span className="font-display text-[10px] tracking-wider">ADD WEAPON</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Battle Record */}
            <div className="glass-panel p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                <h2 className="font-display text-sm tracking-wider text-muted-foreground">BATTLE RECORD</h2>
              </div>

              {shipStats ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 rounded-lg border border-border/20 bg-card/30 p-3">
                    <Crosshair className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <p className="font-display text-xs tracking-wider text-muted-foreground">BATTLES</p>
                      <p className="font-display text-lg text-foreground">{shipStats.battles_fought.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-border/20 bg-card/30 p-3">
                    <Skull className="h-4 w-4 text-destructive shrink-0" />
                    <div>
                      <p className="font-display text-xs tracking-wider text-muted-foreground">ENEMIES</p>
                      <p className="font-display text-lg text-foreground">{shipStats.enemies_defeated.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-border/20 bg-card/30 p-3">
                    <Trophy className="h-4 w-4 text-yellow-500 shrink-0" />
                    <div>
                      <p className="font-display text-xs tracking-wider text-muted-foreground">W/L RATIO</p>
                      <p className="font-display text-lg text-foreground">
                        {shipStats.pvp_wins + shipStats.pvp_losses > 0
                          ? (shipStats.pvp_wins / (shipStats.pvp_wins + shipStats.pvp_losses)).toFixed(2)
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-border/20 bg-card/30 p-3">
                    <Target className="h-4 w-4 text-orange-400 shrink-0" />
                    <div>
                      <p className="font-display text-xs tracking-wider text-muted-foreground">ASTEROIDS</p>
                      <p className="font-display text-lg text-foreground">{shipStats.asteroids_destroyed.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-border/20 bg-card/30 p-3">
                    <Skull className="h-4 w-4 text-purple-400 shrink-0" />
                    <div>
                      <p className="font-display text-xs tracking-wider text-muted-foreground">BOSSES</p>
                      <p className="font-display text-lg text-foreground">{shipStats.bosses_defeated.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-border/20 bg-card/30 p-3">
                    <Rocket className="h-4 w-4 text-accent shrink-0" />
                    <div>
                      <p className="font-display text-xs tracking-wider text-muted-foreground">DISTANCE</p>
                      <p className="font-display text-lg text-foreground">{shipStats.distance_flown.toLocaleString()} km</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="font-body text-xs text-muted-foreground/50 text-center py-4">
                  No battle data yet. Fight some battles to build your record!
                </p>
              )}

              {/* Personal Flex */}
              {shipStats && (() => {
                const flex = getBestFlex(shipStats);
                if (!flex) return null;
                return (
                  <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-1">
                    <p className="font-display text-[10px] tracking-widest text-primary/70">⚡ PERSONAL FLEX</p>
                    <p className="font-display text-sm tracking-wider text-foreground">
                      {flex.label}: {shipStats[flex.stat].toLocaleString()}{flex.stat === "distance_flown" ? " km" : ""}
                    </p>
                    <p className="font-body text-xs text-muted-foreground italic">
                      {flex.remark}
                    </p>
                  </div>
                );
              })()}
            </div>
          </>
        )}
      </div>

      <WeaponSelectDialog
        open={selectedSlot !== null}
        onOpenChange={(open) => !open && setSelectedSlot(null)}
        slot={selectedSlot ?? 1}
        allWeapons={allWeapons.filter((w: any) => {
          const starterWeapons = ["Shield", "Cannon", "Machine Gun", "Missile"];
          return starterWeapons.includes(w.name) || ownedWeaponIds.has(w.id);
        })}
        currentWeaponId={selectedSlot ? (currentWeaponForSlot(selectedSlot)?.id ?? null) : null}
        onSelect={handleWeaponSelect}
        onRemove={handleWeaponRemove}
      />

      {/* Weapon Detail Dialog */}
      <Dialog open={!!detailWeapon} onOpenChange={(open) => !open && setDetailWeapon(null)}>
        <DialogContent className="glass-panel border-border/30 max-w-sm">
          {detailWeapon && (() => {
            const img = weaponImages[detailWeapon.name];
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="font-display text-xl tracking-wider text-primary">{detailWeapon.name}</DialogTitle>
                </DialogHeader>
                <div className="rounded-lg overflow-hidden">
                  {img && <GameImage src={img} alt={detailWeapon.name} className="w-full h-auto object-cover rounded-lg" />}
                </div>
                {WEAPON_DESCRIPTIONS[detailWeapon.name] && (
                  <p className="font-body text-xs text-muted-foreground">{WEAPON_DESCRIPTIONS[detailWeapon.name]}</p>
                )}
                <div className="space-y-2">
                  {detailWeapon.dmg > 0 && (
                    <div className="flex justify-between text-xs font-body">
                      <span className="text-muted-foreground">DMG</span>
                      <span className="text-foreground">{detailWeapon.dmg}</span>
                    </div>
                  )}
                  {detailWeapon.spd > 0 && (
                    <div className="flex justify-between text-xs font-body">
                      <span className="text-muted-foreground">SPD</span>
                      <span className="text-foreground">{detailWeapon.spd}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs font-body">
                    <span className="text-muted-foreground">HEAT</span>
                    <span className="text-foreground">{["Shield", "Ricochet", "IsoSphere", "RegenX"].includes(detailWeapon.name) ? `${detailWeapon.name === "RegenX" ? "-" : ""}${detailWeapon.heat}%` : `${detailWeapon.heat}${detailWeapon.fire_mode === "hold" ? "/s" : ""}`}</span>
                  </div>
                  {detailWeapon.name !== "Shield" && detailWeapon.cooldown > 0 && (
                    <div className="flex justify-between text-xs font-body">
                      <span className="text-muted-foreground">RATE</span>
                      <span className="text-primary">{(1 / detailWeapon.cooldown).toFixed(1)}/s</span>
                    </div>
                  )}
                  {detailWeapon.name !== "Shield" && detailWeapon.fire_rate > 0 && detailWeapon.cooldown <= 0 && (
                    <div className="flex justify-between text-xs font-body">
                      <span className="text-muted-foreground">RATE</span>
                      <span className="text-primary">{Number(detailWeapon.fire_rate).toFixed(1)}/s</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs font-body">
                    <span className="text-muted-foreground">MODE</span>
                    <span className="text-foreground capitalize">{detailWeapon.fire_mode}</span>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    const slot = detailWeapon.slotNumber;
                    setDetailWeapon(null);
                    setSelectedSlot(slot);
                  }}
                  className="w-full font-display tracking-wider text-xs"
                >
                  CHANGE WEAPON
                </Button>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Empty slots warning */}
      <AlertDialog open={showEmptySlotsWarning} onOpenChange={setShowEmptySlotsWarning}>
        <AlertDialogContent className="glass-panel border-border/30 max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display tracking-wider text-destructive">
              WEAPON SLOTS EMPTY
            </AlertDialogTitle>
            <AlertDialogDescription className="font-body text-sm text-muted-foreground">
              All 4 weapon slots must be filled before leaving the Hangar. Equip weapons to the empty slots to continue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setShowEmptySlotsWarning(false)}
              className="font-display text-xs tracking-wider"
            >
              STAY
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Hangar;
