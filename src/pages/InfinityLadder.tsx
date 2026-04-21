import { useEffect, useState } from "react";
import { Infinity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import GameImage from "@/components/GameImage";
import { useAuth } from "@/contexts/AuthContext";
import { getAvatarImageUrl } from "@/game/avatarImageUrl";
import { useVipStatus } from "@/hooks/useVipStatus";
import seasonHeaderImg from "@/assets/Season-1-Header.jpg";

interface InfinityEntry {
  user_id: string;
  best_score: number;
  display_name?: string | null;
  avatarImg?: string;
}

const InfinityLadder = () => {
  const { user } = useAuth();
  const { isVip } = useVipStatus();
  const [entries, setEntries] = useState<InfinityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [seasonName, setSeasonName] = useState("SEASON 1");
  const [daysRemaining, setDaysRemaining] = useState(0);

  useEffect(() => {
    const fetchLadder = async () => {
      // Fetch season info
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

      const { data } = await supabase
        .from("infinity_scores" as any)
        .select("user_id, best_score")
        .order("best_score", { ascending: false })
        .limit(100);

      if (!data || (data as any[]).length === 0) {
        setLoading(false);
        return;
      }

      const userIds = (data as any[]).map((d: any) => d.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, active_avatar_id")
        .in("id", userIds);

      const avatarIds = (profiles || []).map((p: any) => p.active_avatar_id).filter(Boolean);
      let avatarMap: Record<string, string> = {};
      if (avatarIds.length > 0) {
        const { data: avatarData } = await supabase
          .from("avatars")
          .select("id, image_path, image_url")
          .in("id", avatarIds);
        if (avatarData) {
          avatarData.forEach((a: any) => {
            avatarMap[a.id] = getAvatarImageUrl(a);
          });
        }
      }

      const profileMap: Record<string, any> = {};
      (profiles || []).forEach((p: any) => {
        profileMap[p.id] = p;
      });

      setEntries(
        (data as any[]).map((d: any) => ({
          user_id: d.user_id,
          best_score: d.best_score || 0,
          display_name: profileMap[d.user_id]?.display_name,
          avatarImg: profileMap[d.user_id]?.active_avatar_id
            ? avatarMap[profileMap[d.user_id].active_avatar_id]
            : undefined,
        }))
      );
      setLoading(false);
    };
    fetchLadder();
  }, []);

  return (
    <div className="px-4 py-4 flex-1 overflow-y-auto">
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

        <div className="flex items-center justify-center gap-3">
          <Infinity className="h-6 w-6 text-purple-400" />
          <h2 className="font-display text-2xl font-bold tracking-wider text-purple-400" style={{ filter: "drop-shadow(0 0 8px hsl(270, 80%, 60%))" }}>
            INFINITY LADDER
          </h2>
        </div>

        {loading ? (
          <p className="font-display text-purple-400 animate-pulse text-center py-12">LOADING...</p>
        ) : entries.length === 0 ? (
          <p className="font-body text-muted-foreground text-center py-12">No scores yet. Be the first!</p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, index) => {
              const rank = index + 1;
              const isMe = entry.user_id === user?.id;
              const isVipMe = isMe && isVip;

              const rankColors = isVipMe
                ? "gold-sweep-btn"
                : rank === 1
                  ? "border-purple-400/50 bg-purple-400/10"
                  : rank === 2
                    ? "border-purple-300/40 bg-purple-300/5"
                    : rank === 3
                      ? "border-purple-700/40 bg-purple-700/5"
                      : "border-border/30 bg-card/50";

              return (
                <div
                  key={entry.user_id}
                  className={`flex items-center gap-3 rounded-lg border p-3 transition-all ${rankColors} ${
                    isMe && !isVipMe ? "ring-1 ring-purple-400/50" : ""
                  }`}
                >
                  <span
                    className={`font-display text-sm w-8 text-center ${
                      isVipMe ? "text-yellow-950" : rank <= 3 ? "text-purple-400" : "text-muted-foreground"
                    }`}
                  >
                    #{rank}
                  </span>

                  <div className="h-10 w-10 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0 overflow-hidden">
                    {entry.avatarImg ? (
                      <GameImage src={entry.avatarImg} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-display text-sm text-purple-400">
                        {(entry.display_name || "P")[0].toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`font-display text-sm tracking-wider truncate ${
                      isVipMe ? "text-yellow-950" : isMe ? "text-purple-400" : "text-foreground"
                    }`}>
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
        )}
      </div>
    </div>
  );
};

export default InfinityLadder;
