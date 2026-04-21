import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Coins, Star, Zap, Rocket, Palette, Flame, UserCircle, MessageSquareMore } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { xpForLevel, formatNumber } from "@/game/xpHelper";

const STAR_RARITIES = [
  { value: "yellow", label: "Common (Yellow)" },
  { value: "blue", label: "Uncommon (Blue)" },
  { value: "orange", label: "Rare (Orange)" },
  { value: "red", label: "Epic (Red)" },
  { value: "purple", label: "Legendary (Purple)" },
];

const PilotDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [profile, setProfile] = useState<any>(null);
  const [battleStats, setBattleStats] = useState({ wins: 0, losses: 0, total: 0 });
  const [ships, setShips] = useState<any[]>([]);
  const [skins, setSkins] = useState<any[]>([]);
  const [avatars, setAvatars] = useState<any[]>([]);
  const [emotes, setEmotes] = useState<any[]>([]);
  const [granting, setGranting] = useState(false);

  // Grant form state
  const [creditAmount, setCreditAmount] = useState("");
  const [xpAmount, setXpAmount] = useState("");
  const [starRarity, setStarRarity] = useState("yellow");
  const [selectedShip, setSelectedShip] = useState("");
  const [selectedShipSkin, setSelectedShipSkin] = useState("");
  const [selectedJetSkin, setSelectedJetSkin] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [selectedEmote, setSelectedEmote] = useState("");

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const [
        { data: prof },
        { data: battles },
        { data: allShips },
        { data: allSkins },
        { data: allAvatars },
        { data: allEmotes },
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).single(),
        supabase.from("battle_results").select("result").eq("user_id", id),
        supabase.from("ships").select("id, name").order("name"),
        supabase.from("skins").select("id, name, type").order("name"),
        supabase.from("avatars").select("id, name").order("name"),
        supabase.from("emotes").select("id, name").order("name"),
      ]);
      setProfile(prof);
      setShips(allShips || []);
      setSkins(allSkins || []);
      setAvatars(allAvatars || []);
      setEmotes(allEmotes || []);

      let w = 0, l = 0;
      (battles || []).forEach((b: any) => { if (b.result === "victory") w++; else l++; });
      setBattleStats({ wins: w, losses: l, total: w + l });
    };
    load();
  }, [id]);

  const grantPrize = async (prizes: any[]) => {
    setGranting(true);
    try {
      const { data, error } = await supabase.functions.invoke("fulfill-prizes", {
        body: { prizes, targetUserId: id },
      });
      if (error) throw error;
      toast({ title: "Prize granted successfully" });
      // Refresh profile
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", id).single();
      if (prof) setProfile(prof);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setGranting(false);
    }
  };

  if (!profile) return <AdminLayout><div className="text-muted-foreground">Loading...</div></AdminLayout>;

  const xpNeeded = xpForLevel(profile.level);

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/pilots")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-display text-2xl tracking-wider text-primary glow-text">
            {profile.display_name || "Pilot"}
          </h1>
        </div>

        {/* Profile Info */}
        <div className="glass-panel p-4 space-y-3">
          <h2 className="font-display tracking-wider text-xs text-muted-foreground">PILOT PROFILE</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Level</span>
              <div className="font-display text-lg">{profile.level}</div>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">XP</span>
              <div className="font-display text-lg">{formatNumber(profile.xp)} <span className="text-xs text-muted-foreground">/ {formatNumber(xpNeeded)}</span></div>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Credits</span>
              <div className="font-display text-lg text-yellow-400">{profile.credits}</div>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Trophies</span>
              <div className="font-display text-lg">{profile.trophies}</div>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">W / L</span>
              <div>
                <span className="text-green-400 font-display">{battleStats.wins}</span>
                <span className="text-muted-foreground"> / </span>
                <span className="text-red-400 font-display">{battleStats.losses}</span>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Win Rate</span>
              <div className="font-display">{battleStats.total > 0 ? Math.round((battleStats.wins / battleStats.total) * 100) : 0}%</div>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Win Streak</span>
              <div className="font-display">{profile.win_streak}</div>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Joined</span>
              <div className="text-xs">{format(new Date(profile.created_at), "MMM d, yyyy")}</div>
            </div>
          </div>
        </div>

        {/* Grant Prizes */}
        <div className="glass-panel p-4 space-y-4">
          <h2 className="font-display tracking-wider text-xs text-muted-foreground">GRANT PRIZES</h2>

          {/* Credits */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1"><Coins className="w-3 h-3" /> Credits</label>
              <Input type="number" min="1" value={creditAmount} onChange={e => setCreditAmount(e.target.value)} placeholder="Amount" className="mt-1" />
            </div>
            <Button size="sm" disabled={granting || !creditAmount} onClick={() => { grantPrize([{ type: "credits", amount: parseInt(creditAmount) }]); setCreditAmount(""); }}>Grant</Button>
          </div>

          {/* XP */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1"><Zap className="w-3 h-3" /> XP</label>
              <Input type="number" min="1" value={xpAmount} onChange={e => setXpAmount(e.target.value)} placeholder="Amount" className="mt-1" />
            </div>
            <Button size="sm" disabled={granting || !xpAmount} onClick={() => { grantPrize([{ type: "xp", amount: parseInt(xpAmount) }]); setXpAmount(""); }}>Grant</Button>
          </div>

          {/* Star Orb */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1"><Star className="w-3 h-3" /> Star Orb</label>
              <Select value={starRarity} onValueChange={setStarRarity}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{STAR_RARITIES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button size="sm" disabled={granting} onClick={() => grantPrize([{ type: "star_orb", rarity: starRarity }])}>Grant</Button>
          </div>

          {/* Ship */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1"><Rocket className="w-3 h-3" /> Ship</label>
              <Select value={selectedShip} onValueChange={setSelectedShip}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select ship" /></SelectTrigger>
                <SelectContent>{ships.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button size="sm" disabled={granting || !selectedShip} onClick={() => { grantPrize([{ type: "ship", item_id: selectedShip }]); setSelectedShip(""); }}>Grant</Button>
          </div>

          {/* Ship Skin */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1"><Palette className="w-3 h-3" /> Ship Skin</label>
              <Select value={selectedShipSkin} onValueChange={setSelectedShipSkin}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select skin" /></SelectTrigger>
                <SelectContent>{skins.filter(s => s.type === "ship").map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button size="sm" disabled={granting || !selectedShipSkin} onClick={() => { grantPrize([{ type: "ship_skin", item_id: selectedShipSkin }]); setSelectedShipSkin(""); }}>Grant</Button>
          </div>

          {/* Jet Skin */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1"><Flame className="w-3 h-3" /> Jet Skin</label>
              <Select value={selectedJetSkin} onValueChange={setSelectedJetSkin}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select skin" /></SelectTrigger>
                <SelectContent>{skins.filter(s => s.type === "jet").map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button size="sm" disabled={granting || !selectedJetSkin} onClick={() => { grantPrize([{ type: "jet_skin", item_id: selectedJetSkin }]); setSelectedJetSkin(""); }}>Grant</Button>
          </div>

          {/* Avatar */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1"><UserCircle className="w-3 h-3" /> Avatar</label>
              <Select value={selectedAvatar} onValueChange={setSelectedAvatar}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select avatar" /></SelectTrigger>
                <SelectContent>{avatars.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button size="sm" disabled={granting || !selectedAvatar} onClick={() => { grantPrize([{ type: "avatar", item_id: selectedAvatar }]); setSelectedAvatar(""); }}>Grant</Button>
          </div>

          {/* Emote */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1"><MessageSquareMore className="w-3 h-3" /> Emote</label>
              <Select value={selectedEmote} onValueChange={setSelectedEmote}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select emote" /></SelectTrigger>
                <SelectContent>{emotes.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button size="sm" disabled={granting || !selectedEmote} onClick={() => { grantPrize([{ type: "emote", item_id: selectedEmote }]); setSelectedEmote(""); }}>Grant</Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default PilotDetail;
