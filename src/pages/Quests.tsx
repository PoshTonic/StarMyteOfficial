import { useEffect, useState, useCallback } from "react";
import { Swords, Gift, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

interface Prize {
  type: string;
  amount?: number;
  item_id?: string;
  rarity?: string;
}

interface Quest {
  id: string;
  title: string;
  description: string;
  objective_type: string;
  objective_target: number;
  prizes: Prize[];
  type: string;
}

interface PlayerQuest {
  id: string;
  quest_id: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

function formatPrize(p: Prize): string {
  if (p.type === "credits") return `${p.amount} Credits`;
  if (p.type === "xp") return `${p.amount} XP`;
  if (p.type === "star_orb") return `⭐ Star Orb`;
  if (p.type === "ship_skin") return "🎨 Ship Skin";
  if (p.type === "jet_skin") return "🔥 Jet Skin";
  if (p.type === "ship") return "🚀 Ship";
  if (p.type === "avatar") return "👤 Avatar";
  return p.type;
}

function getWeekStart(): string {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - ((dayOfWeek + 6) % 7));
  return monday.toISOString().split("T")[0];
}

function QuestCard({ quest, pq, onClaim, claiming }: {
  quest: Quest;
  pq?: PlayerQuest;
  onClaim: (quest: Quest) => void;
  claiming: string | null;
}) {
  const progress = pq?.progress || 0;
  const completed = pq?.completed || false;
  const claimed = pq?.claimed || false;
  const progressPct = Math.min(100, (progress / quest.objective_target) * 100);

  return (
    <Card
      className={`transition-all ${
        claimed
          ? "border-green-500/30 bg-green-500/5"
          : completed
          ? "border-primary/50 bg-primary/5"
          : "border-border/30"
      }`}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-display text-sm tracking-wider text-foreground">{quest.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{quest.description}</p>
          </div>
          {claimed && <Check className="h-5 w-5 text-green-400 shrink-0" />}
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{quest.objective_type.replace(/_/g, " ")}</span>
            <span className="font-display tracking-wider">{progress}/{quest.objective_target}</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {quest.prizes.map((p, i) => (
              <span key={i} className="text-xs font-body text-yellow-400/80 bg-yellow-500/10 px-2 py-0.5 rounded">
                {formatPrize(p)}
              </span>
            ))}
          </div>

          {completed && !claimed && (
            <Button
              onClick={() => onClaim(quest)}
              disabled={claiming === quest.id}
              size="sm"
              className="font-display text-xs tracking-wider gap-1"
            >
              <Gift className="h-3.5 w-3.5" />
              {claiming === quest.id ? "..." : "CLAIM"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const Quests = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [playerQuests, setPlayerQuests] = useState<Map<string, PlayerQuest>>(new Map());
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("daily");

  const today = new Date().toISOString().split("T")[0];
  const weekStart = getWeekStart();

  const fetchData = useCallback(async () => {
    if (!user) return;

    // Fetch all active quests
    const { data: questData } = await supabase
      .from("quests")
      .select("*")
      .eq("active", true)
      .order("created_at");
    const activeQuests = (questData || []) as unknown as Quest[];
    setQuests(activeQuests);

    // Fetch player quests for today + this week
    const { data: pqData } = await supabase
      .from("player_quests")
      .select("*")
      .eq("user_id", user.id)
      .or(`assigned_date.eq.${today},assigned_week.eq.${weekStart}`);

    const pqMap = new Map<string, PlayerQuest>();
    (pqData || []).forEach((pq: any) => pqMap.set(pq.quest_id, pq as PlayerQuest));

    // Lazy assignment fallback: if no quests for today/week, call assign-quests for this user
    const dailyQuests = activeQuests.filter(q => q.type === "daily");
    const weeklyQuests = activeQuests.filter(q => q.type === "weekly");
    const hasDailyAssigned = dailyQuests.some(q => pqMap.has(q.id));
    const hasWeeklyAssigned = weeklyQuests.some(q => pqMap.has(q.id));

    if ((!hasDailyAssigned && dailyQuests.length > 0) || (!hasWeeklyAssigned && weeklyQuests.length > 0)) {
      await supabase.functions.invoke("assign-quests", {
        body: { user_id: user.id },
      });
      // Re-fetch player quests after assignment
      const { data: pqData2 } = await supabase
        .from("player_quests")
        .select("*")
        .eq("user_id", user.id)
        .or(`assigned_date.eq.${today},assigned_week.eq.${weekStart}`);
      (pqData2 || []).forEach((pq: any) => pqMap.set(pq.quest_id, pq as PlayerQuest));
    }

    setPlayerQuests(pqMap);
    setLoading(false);
  }, [user, today, weekStart]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const claimQuest = async (quest: Quest) => {
    if (!user) return;
    const pq = playerQuests.get(quest.id);
    if (!pq || !pq.completed || pq.claimed) return;

    setClaiming(quest.id);
    try {
      const { data: response, error } = await supabase.functions.invoke("claim-quest", {
        body: { questId: quest.id },
      });
      if (error) throw error;
      if (response?.error) throw new Error(response.error);

      toast({ title: `Quest complete! 🎉` });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setClaiming(null);
  };

  const dailyQuests = quests.filter(q => q.type === "daily" && playerQuests.has(q.id));
  const weeklyQuests = quests.filter(q => q.type === "weekly" && playerQuests.has(q.id));

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
          <Swords className="h-8 w-8 mx-auto text-orange-400" />
          <h1 className="font-display text-2xl tracking-wider text-foreground">QUESTS</h1>
          <p className="text-xs text-muted-foreground">Complete challenges to earn rewards</p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-2 mb-4">
            <TabsTrigger value="daily" className="font-display text-xs tracking-wider">DAILY</TabsTrigger>
            <TabsTrigger value="weekly" className="font-display text-xs tracking-wider">WEEKLY</TabsTrigger>
          </TabsList>

          <TabsContent value="daily">
            <div className="space-y-3">
              {dailyQuests.length === 0 && (
                <p className="text-center text-muted-foreground text-sm">No daily quests today</p>
              )}
              {dailyQuests.map((quest) => (
                <QuestCard
                  key={quest.id}
                  quest={quest}
                  pq={playerQuests.get(quest.id)}
                  onClaim={claimQuest}
                  claiming={claiming}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="weekly">
            <div className="space-y-3">
              {weeklyQuests.length === 0 && (
                <p className="text-center text-muted-foreground text-sm">No weekly quests this week</p>
              )}
              {weeklyQuests.map((quest) => (
                <QuestCard
                  key={quest.id}
                  quest={quest}
                  pq={playerQuests.get(quest.id)}
                  onClaim={claimQuest}
                  claiming={claiming}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Quests;
