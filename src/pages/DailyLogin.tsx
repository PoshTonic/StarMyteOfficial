import { useEffect, useState, useCallback } from "react";
import { CalendarDays, Crown, Flame, Check, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useVipStatus } from "@/hooks/useVipStatus";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import StarOrb from "@/components/StarOrb";
import { VipDialog } from "@/components/VipDialog";
import LevelUpScreen from "@/components/LevelUpScreen";
import type { StarRarity } from "@/game/constants";

interface Prize {
  type: string;
  amount?: number;
  rarity?: string;
  item_id?: string;
}

interface DailyReward {
  id: string;
  day_number: number;
  standard_prizes: Prize[];
  vip_prizes: Prize[];
}

interface LoginData {
  id: string;
  last_login_date: string;
  streak: number;
  last_claimed_day: number;
}

function PrizeDisplay({ prizes, showDouble }: { prizes: Prize[]; showDouble?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center justify-center gap-1 flex-wrap">
        {prizes.map((p, i) => {
          if (p.type === "credits") {
            return (
              <span key={i} className="flex items-center gap-0.5 text-yellow-400 text-[20px] font-display">
                {p.amount}<Coins className="h-5 w-5" />
              </span>
            );
          }
          if (p.type === "star_orb") {
            return <StarOrb key={i} rarity={(p.rarity || "yellow") as StarRarity} size={32} />;
          }
          return <span key={i} className="text-[10px]">{p.type}</span>;
        })}
      </div>
      {showDouble && (
        <span className="text-[9px] font-display tracking-wider text-yellow-400">(x2)</span>
      )}
    </div>
  );
}

const DailyLogin = () => {
  const { user } = useAuth();
  const { isVip } = useVipStatus();
  const { toast } = useToast();
  const [rewards, setRewards] = useState<DailyReward[]>([]);
  const [loginData, setLoginData] = useState<LoginData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [vipOpen, setVipOpen] = useState(false);
  const [levelUpInfo, setLevelUpInfo] = useState<{ oldLevel: number; newLevel: number; oldXp: number; newXp: number; bonusStar: StarRarity } | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [{ data: rewardData }, { data: loginRows }] = await Promise.all([
      supabase.from("daily_login_rewards").select("*").order("day_number"),
      supabase.from("player_daily_logins").select("*").eq("user_id", user.id).limit(1),
    ]);
    setRewards((rewardData || []) as unknown as DailyReward[]);
    setLoginData(loginRows && loginRows.length > 0 ? (loginRows[0] as unknown as LoginData) : null);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const today = new Date().toISOString().split("T")[0];
  const alreadyClaimedToday = loginData?.last_login_date === today;

  const isStreakBroken = (() => {
    if (!loginData) return false;
    const lastDate = new Date(loginData.last_login_date);
    const now = new Date();
    const diffMs = now.getTime() - lastDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return diffDays > 1;
  })();

  const currentClaimedDay = isStreakBroken ? 0 : (loginData?.last_claimed_day || 0);
  const nextClaimDay = ((isStreakBroken ? 0 : currentClaimedDay) % 30) + 1;

  const claimDaily = async () => {
    if (!user || alreadyClaimedToday || claiming) return;
    setClaiming(true);

    try {
      const { data: response, error } = await supabase.functions.invoke("claim-daily-login", {
        body: { isVip },
      });
      if (error) throw error;
      if (response?.error) throw new Error(response.error);

      if (response?.levelUp) {
        const lu = response.levelUp;
        setLevelUpInfo({ oldLevel: lu.oldLevel, newLevel: lu.newLevel, oldXp: lu.oldXp, newXp: lu.newXp, bonusStar: lu.bonusStar as StarRarity });
      }

      toast({ title: `Day ${response?.claimedDay || nextClaimDay} claimed! 🎉` });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setClaiming(false);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="font-display text-sm text-muted-foreground animate-pulse tracking-wider">LOADING...</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 flex-1 overflow-y-auto">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center space-y-2 mb-4">
          <CalendarDays className="h-8 w-8 mx-auto text-green-400" />
          <h1 className="font-display text-2xl tracking-wider text-foreground">DAILY LOGIN</h1>
          <div className="flex items-center justify-center gap-2">
            <Flame className="h-4 w-4 text-orange-400" />
            <p className="font-display text-sm tracking-wider text-orange-400">
              {isStreakBroken ? 0 : (loginData?.streak || 0)} DAY STREAK
            </p>
          </div>
        </div>

        {/* VIP Button */}
        <div className="mb-4">
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

        {/* Already claimed message */}
        {alreadyClaimedToday && (
          <div className="mb-4 text-center">
            <p className="font-display text-sm tracking-wider text-green-400">✓ TODAY'S REWARD CLAIMED</p>
            <p className="text-xs text-muted-foreground mt-1">Come back tomorrow!</p>
          </div>
        )}

        {/* 30-Day Grid */}
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
          {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => {
            const reward = rewards.find((r) => r.day_number === day);
            const isClaimed = day <= currentClaimedDay;
            const isNext = day === nextClaimDay && !alreadyClaimedToday;
            const canClaim = isNext && !claiming;

            return (
              <Card
                key={day}
                onClick={canClaim ? claimDaily : undefined}
                className={`p-2 text-center transition-all ${
                  canClaim ? "cursor-pointer" : ""
                } ${
                  isClaimed
                    ? "border-green-500/40 bg-green-500/10"
                    : isNext
                    ? isVip
                      ? "gold-sweep-border bg-yellow-500/10 animate-pulse-glow"
                      : "border-primary/50 bg-primary/10 ring-1 ring-primary/30 animate-pulse-glow"
                    : "border-border/20 bg-card/30 opacity-60"
                }`}
              >
                <p className="font-display text-[10px] tracking-wider text-muted-foreground">
                  DAY {day}
                </p>
                <div className="mt-1 min-h-[20px] flex items-center justify-center">
                  {reward ? (
                    <PrizeDisplay prizes={reward.standard_prizes} showDouble={isVip} />
                  ) : (
                    <span className="text-muted-foreground text-[10px]">—</span>
                  )}
                </div>
                {isClaimed && <Check className="h-3 w-3 mx-auto mt-1 text-green-400" />}
                {isNext && !alreadyClaimedToday && (
                  <p className="text-[8px] font-display tracking-wider text-primary mt-1">TAP TO CLAIM</p>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      <VipDialog open={vipOpen} onOpenChange={setVipOpen} />

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
};

export default DailyLogin;
