import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Rocket, Crosshair, UserCircle, Coins, Check, Palette, Crown, MessageSquareMore } from "lucide-react";
import { useVipStatus } from "@/hooks/useVipStatus";
import { VipDialog } from "@/components/VipDialog";
import { PurchaseSuccessDialog, type PurchaseType } from "@/components/PurchaseSuccessDialog";
import { weaponImages } from "@/game/weaponImages";
import GameImage from "@/components/GameImage";
import { WEAPON_DESCRIPTIONS } from "@/game/weaponDescriptions";
import { getAvatarImageUrl } from "@/game/avatarImageUrl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import ShipDisplay from "@/components/ShipDisplay";
import ThrusterDisplay from "@/components/ThrusterDisplay";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SkinColourMap } from "@/game/skinUtils";

const tabs = [
  { value: "ships", label: "Ships", icon: Rocket },
  { value: "weapons", label: "Weapons", icon: Crosshair },
  { value: "skins", label: "Skins", icon: Palette },
  { value: "avatars", label: "Avatars", icon: UserCircle },
];

const SHIP_GRADIENTS: Record<string, string> = {
  KARQQ: "from-amber-900/40 to-yellow-600/20",
  SCORJ: "from-cyan-900/40 to-blue-600/20",
  AX15: "from-red-900/40 to-orange-600/20",
  STNGRY: "from-emerald-900/40 to-teal-600/20",
  CROWN: "from-violet-900/40 to-purple-600/20",
  NR77: "from-rose-900/40 to-pink-600/20",
};

const WEAPON_STORE_ITEMS = [
  { name: "Blaster", price: 100, gradient: "from-red-900/40 to-orange-600/20" },
  { name: "Ricochet", price: 200, gradient: "from-purple-900/40 to-violet-600/20" },
  { name: "Dual-BB", price: 300, gradient: "from-slate-900/40 to-gray-600/20" },
  { name: "Phaser", price: 400, gradient: "from-indigo-900/40 to-purple-600/20" },
  { name: "IsoSphere", price: 500, gradient: "from-red-900/40 to-rose-600/20" },
  { name: "Mine", price: 500, gradient: "from-gray-900/40 to-red-600/20" },
  { name: "RadixR4", price: 500, gradient: "from-blue-900/40 to-cyan-600/20" },
  { name: "RegenX", price: 500, gradient: "from-green-900/40 to-emerald-600/20" },
  { name: "Trident", price: 500, gradient: "from-purple-900/40 to-violet-600/20" },
];

interface SkinRecord {
  id: string;
  name: string;
  type: string;
  price: number;
  colours: SkinColourMap;
}

const Store = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const { isVip, checkVip } = useVipStatus();

  const getEffectivePrice = (price: number) => isVip ? Math.floor(price / 2) : price;
  const [vipOpen, setVipOpen] = useState(false);
  const [successType, setSuccessType] = useState<PurchaseType | null>(null);
  const [successItemName, setSuccessItemName] = useState("");

  // Handle ?purchase=vip redirect from Stripe
  useEffect(() => {
    const purchaseParam = searchParams.get("purchase");
    if (purchaseParam === "vip") {
      setSuccessType("vip");
      setSuccessItemName("VIP Pass");
      checkVip();
      // Clean URL
      searchParams.delete("purchase");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, checkVip]);
  const [credits, setCredits] = useState(0);
  const [allShips, setAllShips] = useState<any[]>([]);
  const [ownedShipIds, setOwnedShipIds] = useState<Set<string>>(new Set());
  const [purchasing, setPurchasing] = useState(false);
  const [selectedShip, setSelectedShip] = useState<any | null>(null);
  const [allWeapons, setAllWeapons] = useState<any[]>([]);
  const [ownedWeaponNames, setOwnedWeaponNames] = useState<Set<string>>(new Set());
  const [selectedWeapon, setSelectedWeapon] = useState<typeof WEAPON_STORE_ITEMS[0] | null>(null);
  const [allSkins, setAllSkins] = useState<SkinRecord[]>([]);
  const [ownedSkinCounts, setOwnedSkinCounts] = useState<Record<string, number>>({});
  const [allAvatars, setAllAvatars] = useState<any[]>([]);
  const [ownedAvatarIds, setOwnedAvatarIds] = useState<Set<string>>(new Set());
  const [selectedSkinForPurchase, setSelectedSkinForPurchase] = useState<SkinRecord | null>(null);
  const [selectedAvatarForPurchase, setSelectedAvatarForPurchase] = useState<any | null>(null);
  const [storeEmotes, setStoreEmotes] = useState<any[]>([]);
  const [ownedEmoteIds, setOwnedEmoteIds] = useState<Set<string>>(new Set());
  const [selectedEmoteForPurchase, setSelectedEmoteForPurchase] = useState<any | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: profile }, { data: ships }, { data: playerShips }, { data: weaponCatalog }, { data: ownedWeapons }, { data: skins }, { data: playerSkins }, { data: avatarCatalog }, { data: playerAvatars }, { data: emoteCatalog }, { data: playerEmotes }] = await Promise.all([
        supabase.from("profiles").select("credits").eq("id", user.id).single(),
        supabase.from("ships").select("*").in("availability", ["store", "both"]).order("price"),
        supabase.from("player_ships").select("ship_id").eq("user_id", user.id),
        supabase.from("weapons").select("*").order("created_at"),
        supabase.from("player_owned_weapons").select("weapon_id").eq("user_id", user.id),
        supabase.from("skins").select("*").in("availability", ["store", "both"]).order("price"),
        supabase.from("player_skins").select("skin_id").eq("user_id", user.id),
        supabase.from("avatars").select("*").in("availability", ["store", "both"]).order("price"),
        supabase.from("player_avatars").select("avatar_id").eq("user_id", user.id),
        supabase.from("emotes").select("*").eq("is_default", false).gt("price", 0).order("price"),
        supabase.from("player_emotes").select("emote_id").eq("user_id", user.id),
      ]);
      setCredits(profile?.credits ?? 0);
      setAllShips(ships || []);
      setOwnedShipIds(new Set((playerShips || []).map((ps: any) => ps.ship_id)));
      setAllWeapons(weaponCatalog || []);
      const ownedIds = new Set((ownedWeapons || []).map((ow: any) => ow.weapon_id));
      const nameSet = new Set<string>();
      (weaponCatalog || []).forEach((w: any) => {
        if (ownedIds.has(w.id)) nameSet.add(w.name);
      });
      setOwnedWeaponNames(nameSet);
      setAllSkins((skins || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        price: s.price,
        colours: s.colours as SkinColourMap,
      })));
      const skinCounts: Record<string, number> = {};
      (playerSkins || []).forEach((ps: any) => {
        skinCounts[ps.skin_id] = (skinCounts[ps.skin_id] || 0) + 1;
      });
      setOwnedSkinCounts(skinCounts);
      setAllAvatars(avatarCatalog || []);
      setOwnedAvatarIds(new Set((playerAvatars || []).map((pa: any) => pa.avatar_id)));
      setStoreEmotes(emoteCatalog || []);
      setOwnedEmoteIds(new Set((playerEmotes || []).map((pe: any) => pe.emote_id)));
    };
    load();
  }, [user]);

  const handlePurchase = async (ship: any) => {
    if (!user || purchasing) return;
    const rawPrice = ship.price ?? 200;
    const shipPrice = getEffectivePrice(rawPrice);
    if (credits < shipPrice) {
      toast({ title: "Not enough credits", description: `You need ${shipPrice} credits.`, variant: "destructive" });
      return;
    }

    setPurchasing(true);
    try {
      // Atomic: only deduct if player actually has enough
      const { data: updated, error: creditErr } = await supabase
        .from("profiles")
        .update({ credits: credits - shipPrice })
        .eq("id", user.id)
        .gte("credits", shipPrice)
        .select("credits")
        .single();
      if (creditErr || !updated) {
        toast({ title: "Not enough credits", description: "Your balance has changed. Please try again.", variant: "destructive" });
        return;
      }

      const { data: newPlayerShip, error: shipErr } = await supabase
        .from("player_ships")
        .insert({ user_id: user.id, ship_id: ship.id, is_active: false })
        .select("id")
        .single();
      if (shipErr) {
        // Rollback credits
        await supabase.from("profiles").update({ credits: updated.credits + shipPrice }).eq("id", user.id);
        throw shipErr;
      }

      const { data: weapons } = await supabase
        .from("weapons")
        .select("id")
        .order("created_at")
        .limit(4);

      if (weapons && newPlayerShip) {
        const weaponInserts = weapons.map((w: any, i: number) => ({
          user_id: user.id,
          weapon_id: w.id,
          player_ship_id: newPlayerShip.id,
          slot: i + 1,
        }));
        await supabase.from("player_weapons").insert(weaponInserts);
      }

      setCredits(updated.credits);
      setOwnedShipIds((prev) => new Set([...prev, ship.id]));
      setSelectedShip(null);
      setSuccessType("ship");
      setSuccessItemName(ship.name);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setPurchasing(false);
    }
  };

  const handleWeaponPurchase = async (item: typeof WEAPON_STORE_ITEMS[0]) => {
    if (!user || purchasing) return;
    const effectivePrice = getEffectivePrice(item.price);
    if (credits < effectivePrice) {
      toast({ title: "Not enough credits", description: `You need ${effectivePrice} credits.`, variant: "destructive" });
      return;
    }
    const weaponRecord = allWeapons.find((w: any) => w.name === item.name);
    if (!weaponRecord) return;

    setPurchasing(true);
    try {
      const { data: updated, error: creditErr } = await supabase
        .from("profiles")
        .update({ credits: credits - effectivePrice })
        .eq("id", user.id)
        .gte("credits", effectivePrice)
        .select("credits")
        .single();
      if (creditErr || !updated) {
        toast({ title: "Not enough credits", description: "Your balance has changed. Please try again.", variant: "destructive" });
        return;
      }

      const { error: ownerErr } = await supabase
        .from("player_owned_weapons")
        .insert({ user_id: user.id, weapon_id: weaponRecord.id });
      if (ownerErr) {
        await supabase.from("profiles").update({ credits: updated.credits + effectivePrice }).eq("id", user.id);
        throw ownerErr;
      }

      setCredits(updated.credits);
      setOwnedWeaponNames((prev) => new Set([...prev, item.name]));
      setSelectedWeapon(null);
      setSuccessType("weapon");
      setSuccessItemName(item.name);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setPurchasing(false);
    }
  };

  const handleSkinPurchase = async (skin: SkinRecord) => {
    if (!user || purchasing) return;
    const effectivePrice = getEffectivePrice(skin.price);
    if (credits < effectivePrice) {
      toast({ title: "Not enough credits", description: `You need ${effectivePrice} credits.`, variant: "destructive" });
      return;
    }

    setPurchasing(true);
    try {
      const { data: updated, error: creditErr } = await supabase
        .from("profiles")
        .update({ credits: credits - effectivePrice })
        .eq("id", user.id)
        .gte("credits", effectivePrice)
        .select("credits")
        .single();
      if (creditErr || !updated) {
        toast({ title: "Not enough credits", description: "Your balance has changed. Please try again.", variant: "destructive" });
        return;
      }

      const { error: skinErr } = await supabase
        .from("player_skins")
        .insert({ user_id: user.id, skin_id: skin.id });
      if (skinErr) {
        await supabase.from("profiles").update({ credits: updated.credits + effectivePrice }).eq("id", user.id);
        throw skinErr;
      }

      setCredits(updated.credits);
      setOwnedSkinCounts((prev) => ({ ...prev, [skin.id]: (prev[skin.id] || 0) + 1 }));
      setSelectedSkinForPurchase(null);
      setSuccessType("skin");
      setSuccessItemName(skin.name);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setPurchasing(false);
    }
  };

  const handleAvatarPurchase = async (avatar: any) => {
    if (!user || purchasing) return;
    const effectivePrice = getEffectivePrice(avatar.price);
    if (credits < effectivePrice) {
      toast({ title: "Not enough credits", description: `You need ${effectivePrice} credits.`, variant: "destructive" });
      return;
    }

    setPurchasing(true);
    try {
      const { data: updated, error: creditErr } = await supabase
        .from("profiles")
        .update({ credits: credits - effectivePrice })
        .eq("id", user.id)
        .gte("credits", effectivePrice)
        .select("credits")
        .single();
      if (creditErr || !updated) {
        toast({ title: "Not enough credits", description: "Your balance has changed. Please try again.", variant: "destructive" });
        return;
      }

      const { error: avatarErr } = await supabase
        .from("player_avatars")
        .insert({ user_id: user.id, avatar_id: avatar.id } as any);
      if (avatarErr) {
        await supabase.from("profiles").update({ credits: updated.credits + effectivePrice }).eq("id", user.id);
        throw avatarErr;
      }

      setCredits(updated.credits);
      setOwnedAvatarIds((prev) => new Set([...prev, avatar.id]));
      setSelectedAvatarForPurchase(null);
      setSuccessType("avatar");
      setSuccessItemName(avatar.name);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setPurchasing(false);
    }
  };

  const handleEmotePurchase = async (emote: any) => {
    if (!user || purchasing) return;
    const effectivePrice = getEffectivePrice(emote.price);
    if (credits < effectivePrice) {
      toast({ title: "Not enough credits", description: `You need ${effectivePrice} credits.`, variant: "destructive" });
      return;
    }

    setPurchasing(true);
    try {
      const { data: updated, error: creditErr } = await supabase
        .from("profiles")
        .update({ credits: credits - effectivePrice })
        .eq("id", user.id)
        .gte("credits", effectivePrice)
        .select("credits")
        .single();
      if (creditErr || !updated) {
        toast({ title: "Not enough credits", description: "Your balance has changed. Please try again.", variant: "destructive" });
        return;
      }

      const { error: emoteErr } = await supabase
        .from("player_emotes")
        .insert({ user_id: user.id, emote_id: emote.id });
      if (emoteErr) {
        await supabase.from("profiles").update({ credits: updated.credits + effectivePrice }).eq("id", user.id);
        throw emoteErr;
      }

      setCredits(updated.credits);
      setOwnedEmoteIds((prev) => new Set([...prev, emote.id]));
      setSelectedEmoteForPurchase(null);
      setSuccessType("emote");
      setSuccessItemName(emote.name);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setPurchasing(false);
    }
  };

  const statBar = (label: string, value: number, max: number, colorClass: string) => (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px] font-body">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${colorClass} transition-all`} style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  );

  const priceDisplay = (price: number) => {
    const effective = getEffectivePrice(price);
    if (isVip && effective < price) {
      return (
        <>
          <span className="font-display text-[10px] text-muted-foreground line-through">{price}</span>
          <span className="font-display text-[10px] text-yellow-400">{effective}</span>
        </>
      );
    }
    return <span className="font-display text-[10px] text-yellow-400">{price}</span>;
  };

  const purchasableShips = allShips.filter((s) => s.name !== "AX15").sort((a, b) => a.price - b.price);
  const shipSkins = allSkins.filter((s) => s.type === "ship").sort((a, b) => a.price - b.price);
  const jetSkins = allSkins.filter((s) => s.type === "jet").sort((a, b) => a.price - b.price);

  return (
    <div className="px-4 py-4 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-md space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold tracking-wider text-primary glow-text">STORE</h1>
          <div className="flex items-center gap-1.5">
            <Coins className="h-4 w-4 text-yellow-400" />
            <span className="font-display text-sm tracking-wider text-yellow-400">{credits}</span>
          </div>
        </div>

        {/* VIP Button */}
        <div className="mb-2">
          {isVip ? (
            <div className="w-full py-2.5 rounded-lg text-center font-display text-sm tracking-wider text-yellow-400 border-2 border-yellow-500/50 flex items-center justify-center gap-2">
              <Crown className="h-4 w-4" />
              VIP ACTIVE
            </div>
          ) : (
            <button
              onClick={() => setVipOpen(true)}
              className="gold-sweep-btn w-full py-2.5 rounded-lg font-display text-sm tracking-wider text-yellow-950 flex items-center justify-center gap-2"
            >
              <Crown className="h-4 w-4" />
              BECOME A VIP: £2.49
            </button>
          )}
        </div>

        <Tabs defaultValue="ships" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-card/50 border border-border/30">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="font-display text-[10px] tracking-wider data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                <tab.icon className="h-3.5 w-3.5 mr-1" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="ships">
            <div className="grid grid-cols-3 gap-3">
              {purchasableShips.map((ship) => {
                const owned = ownedShipIds.has(ship.id);
                const gradient = SHIP_GRADIENTS[ship.name] || "from-primary/20 to-accent/10";
                return (
                  <button
                    key={ship.id}
                    onClick={() => setSelectedShip(ship)}
                    className="glass-panel p-2 space-y-1 text-center transition-all hover:border-primary/50 hover:shadow-[0_0_15px_hsl(var(--primary)/0.15)] cursor-pointer"
                  >
                    <div className={`relative rounded-lg bg-gradient-to-br ${gradient} p-2 flex items-center justify-center aspect-square`}>
                      <ShipDisplay shipName={ship.name} className="h-16 w-16" />
                      {owned && (
                        <Badge variant="secondary" className="absolute top-1 right-1 font-display text-[7px] tracking-wider gap-0.5 px-1 py-0.5">
                          <Check className="h-2 w-2" /> OWNED
                        </Badge>
                      )}
                    </div>
                    <span className="font-display text-[10px] tracking-wider text-foreground block">{ship.name}</span>
                    {!owned && (
                      <div className="flex items-center justify-center gap-1">
                        <Coins className="h-2.5 w-2.5 text-yellow-400" />
                        {priceDisplay(ship.price ?? 200)}
                      </div>
                    )}
                  </button>
                );
              })}
              {purchasableShips.length === 0 && (
                <div className="col-span-3 glass-panel p-8 flex flex-col items-center justify-center min-h-[200px] space-y-4">
                  <Rocket className="h-12 w-12 text-muted-foreground/30" />
                  <p className="font-display text-sm tracking-wider text-muted-foreground">NO SHIPS AVAILABLE</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="weapons">
            <div className="grid grid-cols-3 gap-3">
              {WEAPON_STORE_ITEMS.map((item) => {
                const owned = ownedWeaponNames.has(item.name);
                const img = weaponImages[item.name];
                return (
                  <button
                    key={item.name}
                    onClick={() => setSelectedWeapon(item)}
                    className="glass-panel p-2 space-y-1 text-center transition-all hover:border-primary/50 hover:shadow-[0_0_15px_hsl(var(--primary)/0.15)] cursor-pointer"
                  >
                    <div className={`relative rounded-lg bg-gradient-to-br ${item.gradient} overflow-hidden flex items-center justify-center aspect-square`}>
                      {img && <GameImage src={img} alt={item.name} className="w-full h-full object-cover" />}
                      {owned && (
                        <Badge variant="secondary" className="absolute top-1 right-1 font-display text-[7px] tracking-wider gap-0.5 px-1 py-0.5">
                          <Check className="h-2 w-2" /> OWNED
                        </Badge>
                      )}
                    </div>
                    <span className="font-display text-[10px] tracking-wider text-foreground block">{item.name}</span>
                    {!owned && (
                      <div className="flex items-center justify-center gap-1">
                        <Coins className="h-2.5 w-2.5 text-yellow-400" />
                        {priceDisplay(item.price)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="skins">
            <div className="space-y-6">
              {/* Ship Skins */}
              <div className="space-y-3">
                <h2 className="font-display text-sm tracking-wider text-muted-foreground">SHIP SKINS</h2>
                <div className="grid grid-cols-3 gap-3">
                  {shipSkins.map((skin) => {
                    const ownedCount = ownedSkinCounts[skin.id] || 0;
                    return (
                      <button
                        key={skin.id}
                        onClick={() => setSelectedSkinForPurchase(skin)}
                        className="glass-panel p-2 space-y-2 text-center transition-all hover:border-primary/50 cursor-pointer"
                      >
                        <div className="relative rounded-lg bg-card/80 p-2 flex items-center justify-center aspect-square">
                          <ShipDisplay shipName="AX15" className="h-16 w-16" skinColours={skin.colours} />
                          {ownedCount > 0 && (
                            <Badge variant="secondary" className="absolute top-1 right-1 font-display text-[7px] tracking-wider gap-0.5 px-1 py-0.5">
                              x{ownedCount}
                            </Badge>
                          )}
                        </div>
                        <span className="font-display text-[10px] tracking-wider text-foreground block">{skin.name}</span>
                        <div className="flex items-center justify-center gap-1">
                          <Coins className="h-2.5 w-2.5 text-yellow-400" />
                          {priceDisplay(skin.price)}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {shipSkins.length === 0 && (
                  <div className="glass-panel p-6 flex flex-col items-center justify-center min-h-[100px] space-y-2">
                    <Palette className="h-8 w-8 text-muted-foreground/30" />
                    <p className="font-display text-xs tracking-wider text-muted-foreground">NO SHIP SKINS AVAILABLE</p>
                  </div>
                )}
              </div>

              {/* Jet Skins */}
              <div className="space-y-3">
                <h2 className="font-display text-sm tracking-wider text-muted-foreground">JET SKINS</h2>
                {jetSkins.length === 0 ? (
                  <div className="glass-panel p-6 flex flex-col items-center justify-center min-h-[100px] space-y-2">
                    <Palette className="h-8 w-8 text-muted-foreground/30" />
                    <p className="font-display text-xs tracking-wider text-muted-foreground">COMING SOON</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {jetSkins.map((skin) => {
                      const ownedCount = ownedSkinCounts[skin.id] || 0;
                      return (
                        <button
                          key={skin.id}
                          onClick={() => setSelectedSkinForPurchase(skin)}
                          className="glass-panel p-2 space-y-2 text-center transition-all hover:border-primary/50 cursor-pointer"
                        >
                          <div className="relative rounded-lg bg-card/80 p-2 flex items-center justify-center aspect-square">
                            <ThrusterDisplay className="h-16 w-16" skinColours={skin.colours} />
                            {ownedCount > 0 && (
                              <Badge variant="secondary" className="absolute top-1 right-1 font-display text-[7px] tracking-wider gap-0.5 px-1 py-0.5">
                                x{ownedCount}
                              </Badge>
                            )}
                          </div>
                          <span className="font-display text-[10px] tracking-wider text-foreground block">{skin.name}</span>
                          <div className="flex items-center justify-center gap-1">
                            <Coins className="h-2.5 w-2.5 text-yellow-400" />
                            {priceDisplay(skin.price)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Emotes */}
              <div className="space-y-3">
                <h2 className="font-display text-sm tracking-wider text-muted-foreground">EMOTES</h2>
                {storeEmotes.length === 0 ? (
                  <div className="glass-panel p-6 flex flex-col items-center justify-center min-h-[100px] space-y-2">
                    <MessageSquareMore className="h-8 w-8 text-muted-foreground/30" />
                    <p className="font-display text-xs tracking-wider text-muted-foreground">COMING SOON</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {storeEmotes.map((emote: any) => {
                      const owned = ownedEmoteIds.has(emote.id);
                      return (
                        <button
                          key={emote.id}
                          onClick={() => !owned ? setSelectedEmoteForPurchase(emote) : null}
                          className="glass-panel p-2 space-y-2 text-center transition-all hover:border-primary/50 cursor-pointer"
                        >
                          <div className="relative rounded-lg bg-card/80 overflow-hidden aspect-[3/4]">
                            <GameImage src={emote.image_url} alt={emote.name} className="w-full h-full object-contain" />
                            {owned && (
                              <Badge variant="secondary" className="absolute top-1 right-1 font-display text-[7px] tracking-wider gap-0.5 px-1 py-0.5">
                                <Check className="h-2 w-2" />
                              </Badge>
                            )}
                          </div>
                          <span className="font-display text-[10px] tracking-wider text-foreground block">{emote.name}</span>
                          {!owned && (
                            <div className="flex items-center justify-center gap-1">
                              <Coins className="h-2.5 w-2.5 text-yellow-400" />
                              {priceDisplay(emote.price)}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="avatars">
            <div className="grid grid-cols-3 gap-3">
              {allAvatars.filter((a: any) => a.price > 0).sort((a: any, b: any) => a.price - b.price).map((avatar: any) => {
                const owned = ownedAvatarIds.has(avatar.id);
                const img = getAvatarImageUrl(avatar);
                return (
                  <button
                    key={avatar.id}
                    onClick={() => !owned ? setSelectedAvatarForPurchase(avatar) : null}
                    className="glass-panel p-2 space-y-2 text-center transition-all hover:border-primary/50 cursor-pointer"
                  >
                    <div className="relative rounded-lg bg-card/80 overflow-hidden aspect-square">
                      {img && <GameImage src={img} alt={avatar.name} className="w-full h-full object-cover" />}
                      {owned && (
                        <Badge variant="secondary" className="absolute top-1 right-1 font-display text-[7px] tracking-wider gap-0.5 px-1 py-0.5">
                          <Check className="h-2 w-2" />
                        </Badge>
                      )}
                    </div>
                    <span className="font-display text-[10px] tracking-wider text-foreground block">{avatar.name}</span>
                    {!owned && (
                      <div className="flex items-center justify-center gap-1">
                        <Coins className="h-2.5 w-2.5 text-yellow-400" />
                        {priceDisplay(avatar.price)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {allAvatars.length === 0 && (
              <div className="glass-panel p-8 flex flex-col items-center justify-center min-h-[300px] space-y-4">
                <UserCircle className="h-12 w-12 text-muted-foreground/30" />
                <p className="font-display text-sm tracking-wider text-muted-foreground">NO AVATARS AVAILABLE</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Ship Detail Dialog */}
      <Dialog open={!!selectedShip} onOpenChange={(open) => !open && setSelectedShip(null)}>
        <DialogContent className="glass-panel border-border/50 max-w-sm">
          {selectedShip && (() => {
            const owned = ownedShipIds.has(selectedShip.id);
            const gradient = SHIP_GRADIENTS[selectedShip.name] || "from-primary/20 to-accent/10";
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="font-display text-xl tracking-wider text-primary">{selectedShip.name}</DialogTitle>
                </DialogHeader>
                <div className={`rounded-lg bg-gradient-to-br ${gradient} p-6 flex items-center justify-center`}>
                  <ShipDisplay shipName={selectedShip.name} className="h-32 w-32" />
                </div>
                <div className="space-y-2">
                  {statBar("HP", selectedShip.hp, 150, "bg-game-hp")}
                  {statBar("SPEED", selectedShip.speed, 120, "bg-primary")}
                  {statBar("FUEL", selectedShip.fuel, 120, "bg-game-fuel")}
                  {statBar("HEAT CAP", selectedShip.heat_cap, 150, "bg-game-heat")}
                </div>
                {owned ? (
                  <Badge variant="secondary" className="w-full justify-center font-display tracking-wider gap-1 py-2">
                    <Check className="h-3.5 w-3.5" /> OWNED
                  </Badge>
                ) : (
                  <Button
                    onClick={() => handlePurchase(selectedShip)}
                    disabled={purchasing || credits < getEffectivePrice(selectedShip.price ?? 200)}
                    className="w-full font-display tracking-wider text-xs gap-2"
                  >
                    <Coins className="h-4 w-4" />
                    {credits < getEffectivePrice(selectedShip.price ?? 200) ? "NOT ENOUGH CREDITS" : `PURCHASE — ${getEffectivePrice(selectedShip.price ?? 200)} CREDITS`}
                  </Button>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Weapon Detail Dialog */}
      <Dialog open={!!selectedWeapon} onOpenChange={(open) => !open && setSelectedWeapon(null)}>
        <DialogContent className="glass-panel border-border/50 max-w-sm">
          {selectedWeapon && (() => {
            const owned = ownedWeaponNames.has(selectedWeapon.name);
            const img = weaponImages[selectedWeapon.name];
            const weaponRecord = allWeapons.find((w: any) => w.name === selectedWeapon.name);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="font-display text-xl tracking-wider text-primary">{selectedWeapon.name}</DialogTitle>
                </DialogHeader>
                <div className={`rounded-lg bg-gradient-to-br ${selectedWeapon.gradient} overflow-hidden flex items-center justify-center`}>
                  {img && <GameImage src={img} alt={selectedWeapon.name} className="w-full h-auto object-cover rounded-lg" />}
                </div>
                {WEAPON_DESCRIPTIONS[selectedWeapon.name] && (
                  <p className="font-body text-xs text-muted-foreground">{WEAPON_DESCRIPTIONS[selectedWeapon.name]}</p>
                )}
                {weaponRecord && (
                  <div className="space-y-2">
                    {weaponRecord.dmg > 0 && statBar("DMG", weaponRecord.dmg, 50, "bg-destructive")}
                    {["Shield", "Ricochet", "IsoSphere", "RegenX"].includes(weaponRecord.name) ? (
                      <div className="flex justify-between text-[10px] font-body">
                        <span className="text-muted-foreground">HEAT</span>
                        <span className="text-foreground">{weaponRecord.name === "RegenX" ? "-" : ""}{weaponRecord.heat}%</span>
                      </div>
                    ) : (
                      statBar("HEAT", weaponRecord.heat, 80, "bg-game-heat")
                    )}
                    {weaponRecord.spd > 0 && statBar("SPD", weaponRecord.spd, 200, "bg-primary")}
                    {weaponRecord.fire_rate > 0 && (
                      <div className="flex justify-between text-[10px] font-body">
                        <span className="text-muted-foreground">RATE</span>
                        <span className="text-foreground">{weaponRecord.fire_rate}/s</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[10px] font-body">
                      <span className="text-muted-foreground">MODE</span>
                      <span className="text-foreground uppercase">{weaponRecord.fire_mode}</span>
                    </div>
                  </div>
                )}
                {owned ? (
                  <Badge variant="secondary" className="w-full justify-center font-display tracking-wider gap-1 py-2">
                    <Check className="h-3.5 w-3.5" /> OWNED
                  </Badge>
                ) : (
                  <Button
                    onClick={() => handleWeaponPurchase(selectedWeapon)}
                    disabled={purchasing || credits < getEffectivePrice(selectedWeapon.price)}
                    className="w-full font-display tracking-wider text-xs gap-2"
                  >
                    <Coins className="h-4 w-4" />
                    {credits < getEffectivePrice(selectedWeapon.price) ? "NOT ENOUGH CREDITS" : `PURCHASE — ${getEffectivePrice(selectedWeapon.price)} CREDITS`}
                  </Button>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Skin Confirmation Dialog */}
      <Dialog open={!!selectedSkinForPurchase} onOpenChange={(open) => !open && setSelectedSkinForPurchase(null)}>
        <DialogContent className="glass-panel border-border/50 max-w-sm">
          {selectedSkinForPurchase && (() => {
            const skin = selectedSkinForPurchase;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="font-display text-xl tracking-wider text-primary">{skin.name}</DialogTitle>
                </DialogHeader>
                <div className="rounded-lg bg-card/80 p-6 flex items-center justify-center">
                  {skin.type === "ship" ? (
                    <ShipDisplay shipName="AX15" className="h-32 w-32" skinColours={skin.colours} />
                  ) : (
                    <ThrusterDisplay className="h-32 w-32" skinColours={skin.colours} />
                  )}
                </div>
                <p className="text-center font-body text-sm text-muted-foreground uppercase tracking-wider">
                  {skin.type} skin
                </p>
                <Button
                  onClick={() => {
                    handleSkinPurchase(skin);
                    setSelectedSkinForPurchase(null);
                  }}
                  disabled={purchasing || credits < getEffectivePrice(skin.price)}
                  className="w-full font-display tracking-wider text-xs gap-2"
                >
                  <Coins className="h-4 w-4" />
                  {credits < getEffectivePrice(skin.price) ? "NOT ENOUGH CREDITS" : `PURCHASE — ${getEffectivePrice(skin.price)} CREDITS`}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedSkinForPurchase(null)}
                  className="w-full font-display tracking-wider text-xs"
                >
                  CANCEL
                </Button>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Avatar Confirmation Dialog */}
      <Dialog open={!!selectedAvatarForPurchase} onOpenChange={(open) => !open && setSelectedAvatarForPurchase(null)}>
        <DialogContent className="glass-panel border-border/50 max-w-sm">
          {selectedAvatarForPurchase && (() => {
            const avatar = selectedAvatarForPurchase;
            const img = getAvatarImageUrl(avatar);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="font-display text-xl tracking-wider text-primary">{avatar.name}</DialogTitle>
                </DialogHeader>
                <div className="rounded-lg bg-card/80 overflow-hidden flex items-center justify-center mx-auto w-40 h-40">
                  {img && <GameImage src={img} alt={avatar.name} className="w-full h-full object-cover rounded-lg" />}
                </div>
                <Button
                  onClick={() => {
                    handleAvatarPurchase(avatar);
                    setSelectedAvatarForPurchase(null);
                  }}
                  disabled={purchasing || credits < getEffectivePrice(avatar.price)}
                  className="w-full font-display tracking-wider text-xs gap-2"
                >
                  <Coins className="h-4 w-4" />
                  {credits < getEffectivePrice(avatar.price) ? "NOT ENOUGH CREDITS" : `PURCHASE — ${getEffectivePrice(avatar.price)} CREDITS`}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedAvatarForPurchase(null)}
                  className="w-full font-display tracking-wider text-xs"
                >
                  CANCEL
                </Button>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Emote Confirmation Dialog */}
      <Dialog open={!!selectedEmoteForPurchase} onOpenChange={(open) => !open && setSelectedEmoteForPurchase(null)}>
        <DialogContent className="glass-panel border-border/50 max-w-sm">
          {selectedEmoteForPurchase && (() => {
            const emote = selectedEmoteForPurchase;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="font-display text-xl tracking-wider text-primary">{emote.name}</DialogTitle>
                </DialogHeader>
                <div className="rounded-lg bg-card/80 overflow-hidden flex items-center justify-center mx-auto w-32 aspect-[3/4]">
                  <GameImage src={emote.image_url} alt={emote.name} className="w-full h-full object-contain" />
                </div>
                <Button
                  onClick={() => handleEmotePurchase(emote)}
                  disabled={purchasing || credits < getEffectivePrice(emote.price)}
                  className="w-full font-display tracking-wider text-xs gap-2"
                >
                  <Coins className="h-4 w-4" />
                  {credits < getEffectivePrice(emote.price) ? "NOT ENOUGH CREDITS" : `PURCHASE — ${getEffectivePrice(emote.price)} CREDITS`}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedEmoteForPurchase(null)}
                  className="w-full font-display tracking-wider text-xs"
                >
                  CANCEL
                </Button>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
      <PurchaseSuccessDialog
        open={!!successType}
        onOpenChange={(open) => { if (!open) { setSuccessType(null); setSuccessItemName(""); } }}
        type={successType || "ship"}
        itemName={successItemName}
      />
      <VipDialog open={vipOpen} onOpenChange={setVipOpen} />
    </div>
  );
};

export default Store;
