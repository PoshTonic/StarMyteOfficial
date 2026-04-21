import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getAvatarImageUrl } from "@/game/avatarImageUrl";
import GameImage from "@/components/GameImage";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Infinity, ChevronLeft, ChevronRight } from "lucide-react";
import { useVipStatus } from "@/hooks/useVipStatus";
import seasonHeaderImg from "@/assets/Season-1-Header.jpg";

interface PvpEntry {
  id: string;
  display_name: string | null;
  trophies: number;
  active_avatar_id: string | null;
  avatarImg?: string;
}

interface InfinityEntry {
  user_id: string;
  best_score: number;
  display_name?: string | null;
  avatarImg?: string;
}

type Tab = "pvp" | "infinity";

const Ladder = () => {
  const { user } = useAuth();
  const { isVip } = useVipStatus();
  const [activeTab, setActiveTab] = useState<Tab>("pvp");
  const [pvpEntries, setPvpEntries] = useState<PvpEntry[]>([]);
  const [infinityEntries, setInfinityEntries] = useState<InfinityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [seasonName, setSeasonName] = useState("SEASON 1");
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [slideDirection, setSlideDirection] = useState<"left" | "right" | null>(null);

  // Touch/swipe handling
  const touchStartX = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const switchTab = useCallback((tab: Tab) => {
    if (tab === activeTab) return;
    setSlideDirection(tab === "infinity" ? "left" : "right");
    setTimeout(() => {
      setActiveTab(tab);
      setSlideDirection(null);
    }, 250);
  }, [activeTab]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(diff) < 50) return;
    if (diff < 0 && activeTab === "pvp") switchTab("infinity");
    else if (diff > 0 && activeTab === "infinity") switchTab("pvp");
  }, [activeTab, switchTab]);

  useEffect(() => {
    const fetchAll = async () => {
      // Season info
      const { data: seasons } = await supabase
        .from("seasons")
        .select("*")
        .eq("active", true)
        .limit(1);
      if (seasons && seasons.length > 0) {
        const s = seasons[0] as any;
        setSeasonName(s.name || "SEASON 1");
        const start = new Date(s.start_date);
        const end = new Date(start.getTime() + s.duration_days * 24 * 60 * 60 * 1000);
        setDaysRemaining(Math.max(0, Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24))));
      }

      // PVP ladder
      const { data: pvpData } = await supabase
        .from("profiles")
        .select("id, display_name, trophies, active_avatar_id")
        .order("trophies", { ascending: false })
        .limit(100);

      // Infinity ladder
      const { data: infData } = await supabase
        .from("infinity_scores" as any)
        .select("user_id, best_score")
        .order("best_score", { ascending: false })
        .limit(100);

      // Collect all avatar IDs from both ladders
      const allAvatarIds = new Set<string>();
      const allUserIds = new Set<string>();

      if (pvpData) {
        (pvpData as any[]).forEach((e: any) => {
          if (e.active_avatar_id) allAvatarIds.add(e.active_avatar_id);
        });
      }

      if (infData && (infData as any[]).length > 0) {
        (infData as any[]).forEach((d: any) => allUserIds.add(d.user_id));
      }

      // Fetch profiles for infinity users
      let infProfileMap: Record<string, any> = {};
      if (allUserIds.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, active_avatar_id")
          .in("id", Array.from(allUserIds));
        if (profiles) {
          (profiles as any[]).forEach((p: any) => {
            infProfileMap[p.id] = p;
            if (p.active_avatar_id) allAvatarIds.add(p.active_avatar_id);
          });
        }
      }

      // Fetch all avatars once
      let avatarMap: Record<string, string> = {};
      if (allAvatarIds.size > 0) {
        const { data: avatarData } = await supabase
          .from("avatars")
          .select("id, image_path, image_url")
          .in("id", Array.from(allAvatarIds));
        if (avatarData) {
          avatarData.forEach((a: any) => {
            avatarMap[a.id] = getAvatarImageUrl(a);
          });
        }
      }

      // Map PVP entries
      if (pvpData) {
        setPvpEntries(
          (pvpData as any[]).map((e: any) => ({
            ...e,
            avatarImg: e.active_avatar_id ? avatarMap[e.active_avatar_id] : undefined,
          }))
        );
      }

      // Map Infinity entries
      if (infData) {
        setInfinityEntries(
          (infData as any[]).map((d: any) => ({
            user_id: d.user_id,
            best_score: d.best_score || 0,
            display_name: infProfileMap[d.user_id]?.display_name,
            avatarImg: infProfileMap[d.user_id]?.active_avatar_id
              ? avatarMap[infProfileMap[d.user_id].active_avatar_id]
              : undefined,
          }))
        );
      }

      setLoading(false);
    };
    fetchAll();
  }, []);

  const isPvp = activeTab === "pvp";

  return (
    <div
      className="px-4 py-4 flex-1 overflow-y-auto"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      ref={containerRef}
    >
      <div className="mx-auto max-w-md space-y-6">
        {/* Season Hero Card */}
        <div className="relative rounded-xl overflow-hidden h-40">
          <img src={seasonHeaderImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative h-full flex flex-col items-center justify-center text-center">
            <h1 className="font-display text-2xl tracking-wider text-white">{seasonName.toUpperCase()}</h1>
            <p className="font-display text-xs tracking-wider text-white/70">{daysRemaining} DAYS REMAINING</p>
          </div>
        </div>

        {/* Tab header with arrows */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => switchTab(isPvp ? "infinity" : "pvp")}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            {isPvp ? (
              <Trophy className="h-6 w-6 text-amber-400" />
            ) : (
              <Infinity className="h-6 w-6 text-purple-400" />
            )}
            <h2
              className={`font-display text-2xl font-bold tracking-wider ${
                isPvp ? "text-primary glow-text" : "text-purple-400"
              }`}
              style={!isPvp ? { filter: "drop-shadow(0 0 8px hsl(270, 80%, 60%))" } : undefined}
            >
              {isPvp ? "PVP LADDER" : "INFINITY LADDER"}
            </h2>
          </div>
          <button
            onClick={() => switchTab(isPvp ? "infinity" : "pvp")}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Tab indicator dots */}
        <div className="flex justify-center gap-2">
          <div className={`h-1.5 w-1.5 rounded-full transition-colors ${isPvp ? "bg-primary" : "bg-muted-foreground/30"}`} />
          <div className={`h-1.5 w-1.5 rounded-full transition-colors ${!isPvp ? "bg-purple-400" : "bg-muted-foreground/30"}`} />
        </div>

        {/* Ladder content with slide animation */}
        <div className="overflow-hidden">
          <div
            className={`transition-transform duration-250 ease-out ${
              slideDirection === "left"
                ? "-translate-x-full opacity-0"
                : slideDirection === "right"
                  ? "translate-x-full opacity-0"
                  : "translate-x-0 opacity-100"
            }`}
            style={{ transition: "transform 0.25s ease-out, opacity 0.25s ease-out" }}
          >
            {loading ? (
              <p className={`font-display animate-pulse text-center py-12 ${isPvp ? "text-primary" : "text-purple-400"}`}>
                LOADING...
              </p>
            ) : isPvp ? (
              <PvpList entries={pvpEntries} userId={user?.id} isVip={isVip} />
            ) : (
              <InfinityList entries={infinityEntries} userId={user?.id} isVip={isVip} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── PVP Ladder List ── */
const PvpList = ({ entries, userId, isVip }: { entries: PvpEntry[]; userId?: string; isVip: boolean }) => {
  if (entries.length === 0) return <p className="font-body text-muted-foreground text-center py-12">No players yet.</p>;
  return (
    <div className="space-y-2">
      {entries.map((entry, index) => {
        const rank = index + 1;
        const isMe = entry.id === userId;
        const isVipMe = isMe && isVip;
        const rankColors = isVipMe
          ? "gold-sweep-btn"
          : rank === 1 ? "border-amber-400/50 bg-amber-400/10"
          : rank === 2 ? "border-gray-300/40 bg-gray-300/5"
          : rank === 3 ? "border-amber-700/40 bg-amber-700/5"
          : "border-border/30 bg-card/50";

        return (
          <div key={entry.id} className={`flex items-center gap-3 rounded-lg border p-3 transition-all ${rankColors} ${isMe && !isVipMe ? "ring-1 ring-primary/50" : ""}`}>
            <span className={`font-display text-sm w-8 text-center ${isVipMe ? "text-yellow-950" : rank <= 3 ? "text-amber-400" : "text-muted-foreground"}`}>#{rank}</span>
            <div className="h-10 w-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 overflow-hidden">
              {entry.avatarImg ? (
                <GameImage src={entry.avatarImg} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="font-display text-sm text-primary">{(entry.display_name || "P")[0].toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-display text-sm tracking-wider truncate ${isVipMe ? "text-yellow-950" : isMe ? "text-primary" : "text-foreground"}`}>
                {entry.display_name || "Pilot"}
                {isMe && <span className={`text-[10px] ml-1 ${isVipMe ? "text-yellow-950/70" : "text-muted-foreground"}`}>(you)</span>}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Trophy className={`h-4 w-4 ${isVipMe ? "text-yellow-950" : "text-amber-400"}`} />
              <span className={`font-display text-sm ${isVipMe ? "text-yellow-950" : "text-amber-400"}`}>{entry.trophies}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ── Infinity Ladder List ── */
const InfinityList = ({ entries, userId, isVip }: { entries: InfinityEntry[]; userId?: string; isVip: boolean }) => {
  if (entries.length === 0) return <p className="font-body text-muted-foreground text-center py-12">No scores yet. Be the first!</p>;
  return (
    <div className="space-y-2">
      {entries.map((entry, index) => {
        const rank = index + 1;
        const isMe = entry.user_id === userId;
        const isVipMe = isMe && isVip;
        const rankColors = isVipMe
          ? "gold-sweep-btn"
          : rank === 1 ? "border-purple-400/50 bg-purple-400/10"
          : rank === 2 ? "border-purple-300/40 bg-purple-300/5"
          : rank === 3 ? "border-purple-700/40 bg-purple-700/5"
          : "border-border/30 bg-card/50";

        return (
          <div key={entry.user_id} className={`flex items-center gap-3 rounded-lg border p-3 transition-all ${rankColors} ${isMe && !isVipMe ? "ring-1 ring-purple-400/50" : ""}`}>
            <span className={`font-display text-sm w-8 text-center ${isVipMe ? "text-yellow-950" : rank <= 3 ? "text-purple-400" : "text-muted-foreground"}`}>#{rank}</span>
            <div className="h-10 w-10 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0 overflow-hidden">
              {entry.avatarImg ? (
                <GameImage src={entry.avatarImg} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="font-display text-sm text-purple-400">{(entry.display_name || "P")[0].toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-display text-sm tracking-wider truncate ${isVipMe ? "text-yellow-950" : isMe ? "text-purple-400" : "text-foreground"}`}>
                {entry.display_name || "Pilot"}
                {isMe && <span className={`text-[10px] ml-1 ${isVipMe ? "text-yellow-950/70" : "text-muted-foreground"}`}>(you)</span>}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Infinity className={`h-4 w-4 ${isVipMe ? "text-yellow-950" : "text-purple-400"}`} />
              <span className={`font-display text-sm ${isVipMe ? "text-yellow-950" : "text-purple-400"}`}>{entry.best_score.toLocaleString()}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Ladder;
