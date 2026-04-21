import { useEffect, useState, useCallback, useRef } from "react";
import seasonHeaderImg from "@/assets/Season-1-Header.jpg";
import { Crown, Lock, Check, Gift, Coins, Trophy, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useVipStatus } from "@/hooks/useVipStatus";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import StarOrb from "@/components/StarOrb";
import { StarRarity } from "@/game/constants";
import LevelUpScreen from "@/components/LevelUpScreen";
import ShipDisplay from "@/components/ShipDisplay";
import ThrusterDisplay from "@/components/ThrusterDisplay";
import GameImage from "@/components/GameImage";
import { getAvatarImageUrl } from "@/game/avatarImageUrl";
import { SkinColourMap } from "@/game/skinUtils";

interface Prize {
  type: string;
  amount?: number;
  item_id?: string;
  rarity?: string;
}

interface Tier {
  id: string;
  unlock_value: number;
  standard_prizes: Prize[];
  vip_prizes: Prize[];
  sort_order: number;
}

interface Season {
  id: string;
  name: string;
  start_date: string;
  duration_days: number;
}

interface ItemInfo {
  id: string;
  name: string;
  kind: "skin" | "avatar" | "ship";
  skinType?: "ship" | "jet";
  colours?: SkinColourMap;
  image_url?: string | null;
  image_path?: string;
}

function PrizeItem({ prize, itemLookup }: { prize: Prize; itemLookup?: Map<string, ItemInfo> }) {
  if (prize.type === "credits") {
    return (
      <div className="flex items-center justify-center gap-1">
        <span className="text-base font-display text-yellow-400">{prize.amount}</span>
        <Coins className="h-4 w-4 text-yellow-400" />
      </div>
    );
  }
  if (prize.type === "star_orb") {
    return <StarOrb rarity={(prize.rarity || "yellow") as StarRarity} size={28} />;
  }
  if (prize.type === "xp") {
    return (
      <span className="text-base font-display text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.8)]">
        {prize.amount} XP
      </span>
    );
  }

  const item = prize.item_id ? itemLookup?.get(prize.item_id) : undefined;

  if (prize.type === "jet_skin") {
    if (item?.colours) {
      return (
        <div className="h-7 w-7 flex items-center justify-center" title={item.name}>
          <ThrusterDisplay className="h-7 w-7" skinColours={item.colours} />
        </div>
      );
    }
    return <span className="text-xs">🔥 Jet</span>;
  }

  if (prize.type === "ship_skin") {
    if (item?.colours) {
      return (
        <div className="h-7 w-7 flex items-center justify-center" title={item.name}>
          <ShipDisplay
            shipName="AX15"
            className="h-7 w-7"
            skinColours={item.colours}
          />
        </div>
      );
    }
    return <span className="text-xs">🎨 Skin</span>;
  }

  if (prize.type === "avatar") {
    if (item && (item.image_url || item.image_path)) {
      return (
        <GameImage
          src={getAvatarImageUrl({ image_url: item.image_url, image_path: item.image_path })}
          alt={item.name}
          className="h-7 w-7 rounded-full object-cover"
        />
      );
    }
    return <span className="text-xs">👤 Avatar</span>;
  }

  if (prize.type === "ship") {
    if (item) {
      return (
        <div className="h-7 w-7 flex items-center justify-center" title={item.name}>
          <ShipDisplay shipName={item.name} className="h-7 w-7" />
        </div>
      );
    }
    return <span className="text-xs">🚀 Ship</span>;
  }

  return <span className="text-xs">{prize.type}</span>;
}

function PrizeColumn({ label, prizes, isVip, itemLookup }: { label: React.ReactNode; prizes: Prize[]; isVip?: boolean; itemLookup?: Map<string, ItemInfo> }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="mb-1">{label}</div>
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        {prizes.map((p, i) => (
          <PrizeItem key={i} prize={p} itemLookup={itemLookup} />
        ))}
        {prizes.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
      </div>
    </div>
  );
}

interface SeasonLadderProps {
  seasonType: "trophy_road" | "battle_pass";
  playerValue: number;
  valueLabel: string;
  accentColor: string;
  onVipClick: () => void;
}

export function SeasonLadder({ seasonType, playerValue, valueLabel, accentColor, onVipClick }: SeasonLadderProps) {
  const { user } = useAuth();
  const { isVip } = useVipStatus();
  const { toast } = useToast();
  const [season, setSeason] = useState<Season | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [claims, setClaims] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [levelUpInfo, setLevelUpInfo] = useState<{ oldLevel: number; newLevel: number; oldXp: number; newXp: number; bonusStar: StarRarity } | null>(null);
  const [itemLookup, setItemLookup] = useState<Map<string, ItemInfo>>(new Map());
  const activeTierRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const { data: seasons } = await supabase
      .from("seasons")
      .select("*")
      .eq("type", seasonType)
      .eq("active", true)
      .limit(1);
    const s = (seasons?.[0] as any) as Season | undefined;
    setSeason(s || null);

    if (s) {
      const { data: tierData } = await supabase
        .from("season_tiers")
        .select("*")
        .eq("season_id", s.id)
        .order("sort_order", { ascending: true });
      const parsedTiers = (tierData || []) as unknown as Tier[];
      setTiers(parsedTiers);

      const { data: claimData } = await supabase
        .from("player_season_claims")
        .select("tier_id")
        .eq("user_id", user.id)
        .eq("season_id", s.id);
      setClaims(new Set((claimData || []).map((c: any) => c.tier_id)));

      // Collect all item_ids from prizes for thumbnail lookups
      const itemIds = new Set<string>();
      parsedTiers.forEach(t => {
        [...t.standard_prizes, ...t.vip_prizes].forEach(p => {
          if (p.item_id) itemIds.add(p.item_id);
        });
      });

      if (itemIds.size > 0) {
        const ids = [...itemIds];
        const [{ data: skinRows }, { data: avatarRows }, { data: shipRows }] = await Promise.all([
          supabase.from("skins").select("id,name,type,colours").in("id", ids),
          supabase.from("avatars").select("id,name,image_url,image_path").in("id", ids),
          supabase.from("ships").select("id,name").in("id", ids),
        ]);

        const map = new Map<string, ItemInfo>();
        (skinRows || []).forEach((s: any) => map.set(s.id, { id: s.id, name: s.name, kind: "skin", skinType: s.type, colours: s.colours as SkinColourMap }));
        (avatarRows || []).forEach((a: any) => map.set(a.id, { id: a.id, name: a.name, kind: "avatar", image_url: a.image_url, image_path: a.image_path }));
        (shipRows || []).forEach((sh: any) => map.set(sh.id, { id: sh.id, name: sh.name, kind: "ship" }));
        setItemLookup(map);
      }
    }
    setLoading(false);
  }, [user, seasonType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-scroll to active tier after 2s
  useEffect(() => {
    if (!loading && tiers.length > 0 && activeTierRef.current) {
      const timer = setTimeout(() => {
        activeTierRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [loading, tiers.length]);

  const claimTier = async (tier: Tier) => {
    if (!user || !season) return;
    setClaiming(tier.id);

    try {
      const { data: response, error } = await supabase.functions.invoke("claim-season-tier", {
        body: { seasonId: season.id, tierId: tier.id, isVip },
      });
      if (error) throw error;
      if (response?.error) throw new Error(response.error);

      if (response?.levelUp) {
        const lu = response.levelUp;
        setLevelUpInfo({ oldLevel: lu.oldLevel, newLevel: lu.newLevel, oldXp: lu.oldXp, newXp: lu.newXp, bonusStar: lu.bonusStar as StarRarity });
      }

      setClaims((prev) => new Set([...prev, tier.id]));
      toast({ title: "Rewards claimed! 🎉" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setClaiming(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="font-display text-sm text-muted-foreground animate-pulse tracking-wider">LOADING...</p>
      </div>
    );
  }

  if (!season || tiers.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="font-display text-sm text-muted-foreground tracking-wider">No season data available</p>
      </div>
    );
  }

  const startDate = new Date(season.start_date);
  const endDate = new Date(startDate.getTime() + season.duration_days * 24 * 60 * 60 * 1000);
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  // Sorted bottom-to-top (highest at top)
  const sortedTiers = [...tiers].sort((a, b) => b.unlock_value - a.unlock_value);

  // Find the "active" tier = the next unclaimed tier the player is working toward
  const ascTiers = [...tiers].sort((a, b) => a.unlock_value - b.unlock_value);
  const activeTierId = ascTiers.find(t => !claims.has(t.id) && playerValue < t.unlock_value)?.id
    || ascTiers.find(t => !claims.has(t.id) && playerValue >= t.unlock_value)?.id;

  return (
    <div className="space-y-4">
      {/* Season Hero Card */}
      <div className="relative rounded-xl overflow-hidden h-40">
        <img src={seasonHeaderImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative h-full flex flex-col items-center justify-center text-center">
          <h1 className="font-display text-2xl tracking-wider text-white">{season.name.toUpperCase()}</h1>
          <p className="font-display text-xs tracking-wider text-white/70">{daysRemaining} DAYS REMAINING</p>
        </div>
      </div>

      {/* Page Title */}
      <div className="flex items-center justify-center gap-3">
        {seasonType === "trophy_road" ? (
          <Trophy className="h-6 w-6 text-amber-400" />
        ) : (
          <Star className="h-6 w-6 text-purple-400" />
        )}
        <h2 className="font-display text-2xl font-bold tracking-wider text-primary glow-text">
          {seasonType === "trophy_road" ? "TROPHY ROAD" : "BATTLE PASS"}
        </h2>
      </div>

      {/* Player stat + VIP on one row */}
      <div className="flex items-center justify-center gap-4">
        <span className="font-display text-sm tracking-wider">
          Your {valueLabel}: <span className={accentColor}>{playerValue}</span>
        </span>
        {isVip ? (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-yellow-500/50 font-display text-xs tracking-wider text-yellow-400">
            <Crown className="h-4 w-4" />
            VIP ACTIVE
          </div>
        ) : (
          <button
            onClick={onVipClick}
            className="gold-sweep-btn px-6 py-2.5 rounded-lg font-display text-xs tracking-wider text-yellow-950 inline-flex items-center gap-2"
          >
            <Crown className="h-4 w-4" />
            BECOME A VIP: £2.49
          </button>
        )}
      </div>

      {/* Ladder */}
      <div className="space-y-3 max-w-lg mx-auto">
        {sortedTiers.map((tier, index) => {
          const unlocked = playerValue >= tier.unlock_value;
          const claimed = claims.has(tier.id);
          const isActive = tier.id === activeTierId;

          // Progress bar calculation for active tier
          const sortedAscIndex = ascTiers.findIndex(t => t.id === tier.id);
          const prevValue = sortedAscIndex > 0 ? ascTiers[sortedAscIndex - 1].unlock_value : 0;
          const progressPct = tier.unlock_value > prevValue
            ? Math.min(100, Math.max(0, ((playerValue - prevValue) / (tier.unlock_value - prevValue)) * 100))
            : 0;

          return (
            <div
              key={tier.id}
              ref={isActive ? activeTierRef : undefined}
            >
              <Card
                className={`transition-all ${
                  unlocked
                    ? "border-border/50 bg-card"
                    : "border-border/20 bg-card/30 opacity-50 grayscale"
                } ${claimed ? "border-green-500/30" : ""} ${isActive ? "ring-1 ring-primary/50" : ""}`}
              >
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-center gap-2">
                    {!unlocked && <Lock className="h-4 w-4 text-muted-foreground" />}
                    {claimed && <Check className="h-4 w-4 text-green-400" />}
                    <span className={`font-display text-base tracking-wider ${unlocked ? accentColor : "text-muted-foreground"}`}>
                      {tier.unlock_value} {valueLabel.toUpperCase()}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="py-2 px-4">
                  <div className="grid grid-cols-2 gap-4">
                    <PrizeColumn
                      label={<p className="font-display text-[10px] tracking-wider text-muted-foreground">STANDARD</p>}
                      prizes={tier.standard_prizes}
                      itemLookup={itemLookup}
                    />
                    <PrizeColumn
                      label={
                        <div className="flex items-center gap-1">
                          <Crown className="h-3 w-3 text-yellow-400" />
                          <p className="font-display text-[10px] tracking-wider text-yellow-400">VIP</p>
                        </div>
                      }
                      prizes={tier.vip_prizes}
                      isVip
                      itemLookup={itemLookup}
                    />
                  </div>
                </CardContent>
                <CardFooter className="py-2 px-4 flex-col gap-2">
                  {isActive && !claimed && (
                    <div className="w-full space-y-1">
                      <Progress value={progressPct} className="h-2" />
                      <p className="font-display text-[10px] tracking-wider text-muted-foreground text-center">
                        {playerValue} / {tier.unlock_value} {valueLabel.toUpperCase()}
                      </p>
                    </div>
                  )}
                  {claimed ? (
                    <p className="font-display text-xs tracking-wider text-green-400 w-full text-center">CLAIMED ✓</p>
                  ) : (
                    <Button
                      onClick={() => claimTier(tier)}
                      disabled={!unlocked || claiming === tier.id}
                      size="sm"
                      className="w-full font-display text-xs tracking-wider gap-1"
                    >
                      <Gift className="h-3.5 w-3.5" />
                      {claiming === tier.id ? "CLAIMING..." : "CLAIM"}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </div>
          );
        })}
      </div>

      {levelUpInfo && (
        <LevelUpScreen
          oldLevel={levelUpInfo.oldLevel}
          oldXp={levelUpInfo.oldXp}
          newLevel={levelUpInfo.newLevel}
          newXp={levelUpInfo.newXp}
          bonusStar={levelUpInfo.bonusStar}
          onContinue={() => setLevelUpInfo(null)}
        />
      )}
    </div>
  );
}
