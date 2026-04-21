import { useEffect, useState } from "react";
import { Plus, Trash2, Edit2, Infinity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/AdminLayout";
import StarOrb from "@/components/StarOrb";
import { StarRarity } from "@/game/constants";

interface RewardTier {
  id: string;
  score_threshold: number;
  xp: number;
  credits: number;
  stars: string[];
}

const STAR_OPTIONS: StarRarity[] = ["yellow", "blue", "orange", "red", "purple"];

const InfinityRewards = () => {
  const { toast } = useToast();
  const [tiers, setTiers] = useState<RewardTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTier, setEditTier] = useState<RewardTier | null>(null);
  const [isNew, setIsNew] = useState(false);

  // Form state
  const [formThreshold, setFormThreshold] = useState(0);
  const [formXp, setFormXp] = useState(0);
  const [formCredits, setFormCredits] = useState(0);
  const [formStars, setFormStars] = useState<string[]>([]);

  const fetchTiers = async () => {
    const { data } = await supabase
      .from("infinity_rewards" as any)
      .select("*")
      .order("score_threshold", { ascending: true });
    if (data) {
      setTiers((data as any[]).map((d: any) => ({
        id: d.id,
        score_threshold: d.score_threshold,
        xp: d.xp,
        credits: d.credits,
        stars: Array.isArray(d.stars) ? d.stars : [],
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchTiers(); }, []);

  const openEdit = (tier: RewardTier) => {
    setEditTier(tier);
    setIsNew(false);
    setFormThreshold(tier.score_threshold);
    setFormXp(tier.xp);
    setFormCredits(tier.credits);
    setFormStars([...tier.stars]);
  };

  const openNew = () => {
    setEditTier({ id: "", score_threshold: 0, xp: 0, credits: 0, stars: [] });
    setIsNew(true);
    setFormThreshold(0);
    setFormXp(0);
    setFormCredits(0);
    setFormStars([]);
  };

  const handleSave = async () => {
    const payload = {
      score_threshold: formThreshold,
      xp: formXp,
      credits: formCredits,
      stars: formStars,
    };

    if (isNew) {
      const { error } = await supabase.from("infinity_rewards" as any).insert(payload as any);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Tier added" });
    } else {
      const { error } = await supabase.from("infinity_rewards" as any).update(payload as any).eq("id", editTier!.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Tier updated" });
    }
    setEditTier(null);
    fetchTiers();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("infinity_rewards" as any).delete().eq("id", id);
    toast({ title: "Tier deleted" });
    fetchTiers();
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Infinity className="h-6 w-6 text-purple-400" />
            <h1 className="font-display text-xl tracking-wider text-foreground">INFINITY REWARDS</h1>
          </div>
          <Button onClick={openNew} size="sm" className="font-display text-xs tracking-wider gap-1">
            <Plus className="h-3.5 w-3.5" /> ADD TIER
          </Button>
        </div>

        <p className="font-body text-sm text-muted-foreground">
          Manage reward tiers for Infinity Mode. Players earn rewards based on their score (accumulated asteroid HP destroyed).
        </p>

        {loading ? (
          <p className="font-display text-sm text-muted-foreground animate-pulse">Loading...</p>
        ) : (
          <div className="rounded-lg border border-border/30 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-display text-xs tracking-wider">SCORE</TableHead>
                  <TableHead className="font-display text-xs tracking-wider">XP</TableHead>
                  <TableHead className="font-display text-xs tracking-wider">CREDITS</TableHead>
                  <TableHead className="font-display text-xs tracking-wider">STARS</TableHead>
                  <TableHead className="font-display text-xs tracking-wider w-24">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiers.map((tier) => (
                  <TableRow key={tier.id}>
                    <TableCell className="font-display text-sm text-purple-400">{tier.score_threshold.toLocaleString()}</TableCell>
                    <TableCell className="font-body text-sm">{tier.xp}</TableCell>
                    <TableCell className="font-body text-sm text-yellow-400">{tier.credits}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {tier.stars.length === 0 && <span className="text-muted-foreground text-xs">—</span>}
                        {tier.stars.map((s, i) => (
                          <StarOrb key={i} rarity={s as StarRarity} size={16} />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(tier)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(tier.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Edit/Add Dialog */}
      <Dialog open={!!editTier} onOpenChange={(open) => !open && setEditTier(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display tracking-wider">{isNew ? "ADD TIER" : "EDIT TIER"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="font-display text-xs tracking-wider">Score Threshold</Label>
              <Input type="number" value={formThreshold} onChange={(e) => setFormThreshold(parseInt(e.target.value) || 0)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-display text-xs tracking-wider">XP</Label>
                <Input type="number" value={formXp} onChange={(e) => setFormXp(parseInt(e.target.value) || 0)} />
              </div>
              <div className="space-y-1.5">
                <Label className="font-display text-xs tracking-wider">Credits</Label>
                <Input type="number" value={formCredits} onChange={(e) => setFormCredits(parseInt(e.target.value) || 0)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="font-display text-xs tracking-wider">Star Rewards</Label>
              <div className="flex gap-1 flex-wrap items-center min-h-[32px] p-2 rounded-md border border-border/30 bg-card/50">
                {formStars.map((s, i) => (
                  <button key={i} onClick={() => setFormStars(formStars.filter((_, j) => j !== i))} className="hover:opacity-50 transition-opacity">
                    <StarOrb rarity={s as StarRarity} size={20} />
                  </button>
                ))}
                {formStars.length === 0 && <span className="text-muted-foreground text-xs">Click below to add stars</span>}
              </div>
              <div className="flex gap-1">
                {STAR_OPTIONS.map((rarity) => (
                  <button
                    key={rarity}
                    onClick={() => setFormStars([...formStars, rarity])}
                    className="p-1 rounded border border-border/30 hover:border-primary/50 transition-colors"
                  >
                    <StarOrb rarity={rarity} size={18} />
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleSave} className="w-full font-display text-xs tracking-wider">
              {isNew ? "ADD" : "SAVE"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default InfinityRewards;
