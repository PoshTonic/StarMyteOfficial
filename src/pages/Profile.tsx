import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Save, Coins, Swords, Trophy, Skull, Clock, Gamepad2, Music, Crown, MessageSquareMore } from "lucide-react";
import { useVipStatus } from "@/hooks/useVipStatus";
import StarOrb from "@/components/StarOrb";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import StarSlotGrid from "@/components/StarSlotGrid";
import { fetchUserStars, StarRecord } from "@/game/starUtils";
import { xpForLevel, formatNumber } from "@/game/xpHelper";
import { getAvatarImageUrl } from "@/game/avatarImageUrl";
import GameImage from "@/components/GameImage";
import MusicControls from "@/components/MusicControls";
import EmailVerificationOverlay from "@/components/EmailVerificationOverlay";

type ControlMode = 'default' | 'pro' | 'pro_loose';

const controlOptions: { value: ControlMode; label: string; desc: string }[] = [
  { value: 'default', label: 'Default', desc: 'Tap trigger button to fire' },
  { value: 'pro', label: 'Pro', desc: 'Trigger integrated into ship — tap your ship to fire' },
  { value: 'pro_loose', label: 'Pro Loose', desc: 'Lower half of battle area controls ship movement and fires weapons' },
];

const Profile = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { isVip } = useVipStatus();
  const [profile, setProfile] = useState<any>(null);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [controlMode, setControlMode] = useState<ControlMode>('default');
  const [battleStats, setBattleStats] = useState({ total: 0, wins: 0, losses: 0, avgTime: 0 });
  const [stars, setStars] = useState<StarRecord[]>([]);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [ownedAvatars, setOwnedAvatars] = useState<any[]>([]);
  const [activeAvatar, setActiveAvatar] = useState<any>(null);
  const [emoteLoadout, setEmoteLoadout] = useState<any[]>([]);
  const [allOwnedEmotes, setAllOwnedEmotes] = useState<any[]>([]);
  const [emoteDialogOpen, setEmoteDialogOpen] = useState(false);
  const [emoteSlotToReplace, setEmoteSlotToReplace] = useState<number | null>(null);

  const loadStars = useCallback(async () => {
    if (!user) return;
    const data = await fetchUserStars(user.id);
    setStars(data);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) {
        setProfile(data);
        setDisplayName(data.display_name || "");
        setControlMode((data as any).control_mode || 'default');

        if ((data as any).active_avatar_id) {
          const { data: av } = await supabase.from("avatars").select("*").eq("id", (data as any).active_avatar_id).single();
          if (av) setActiveAvatar(av);
        }
      }
    };

    loadProfile();

    supabase.from("battle_results").select("*").eq("user_id", user.id).then(({ data }) => {
      const results = data || [];
      const wins = results.filter((r: any) => r.result === "victory").length;
      const losses = results.filter((r: any) => r.result === "defeat").length;
      const totalDuration = results.reduce((sum: number, r: any) => sum + Number(r.battle_duration || 0), 0);
      setBattleStats({
        total: results.length, wins, losses,
        avgTime: results.length > 0 ? Math.round(totalDuration / results.length) : 0,
      });
    });

    loadStars();

    // Load emote loadout
    const loadEmoteLoadout = async () => {
      const { data: loadoutRows } = await supabase
        .from("player_emote_loadout")
        .select("slot, emote_id, emotes(id, name, image_url)")
        .eq("user_id", user.id)
        .order("slot") as any;

      if (loadoutRows && loadoutRows.length > 0) {
        setEmoteLoadout(loadoutRows.map((r: any) => r.emotes));
      } else {
        const { data: defaults } = await supabase
          .from("emotes")
          .select("id, name, image_url")
          .eq("is_default", true)
          .order("created_at");
        if (defaults) setEmoteLoadout(defaults);
      }
    };
    loadEmoteLoadout();
  }, [user, loadStars]);

  const loadOwnedAvatars = useCallback(async () => {
    if (!user) return;
    const { data: playerAvatars } = await supabase
      .from("player_avatars")
      .select("avatar_id")
      .eq("user_id", user.id);

    const avatarIds = (playerAvatars || []).map((pa: any) => pa.avatar_id);

    // Fetch owned avatars
    let ownedList: any[] = [];
    if (avatarIds.length > 0) {
      const { data: avatars } = await supabase
        .from("avatars")
        .select("*")
        .in("id", avatarIds);
      ownedList = avatars || [];
    }

    // If VIP, also include VIP-exclusive avatars not already in the list
    if (isVip) {
      const { data: vipAvatars } = await supabase
        .from("avatars")
        .select("*")
        .eq("availability", "vip");
      if (vipAvatars) {
        const existingIds = new Set(ownedList.map((a: any) => a.id));
        for (const va of vipAvatars) {
          if (!existingIds.has(va.id)) ownedList.push(va);
        }
      }
    }

    setOwnedAvatars(ownedList);
  }, [user, isVip]);

  const handleAvatarClick = async () => {
    await loadOwnedAvatars();
    setAvatarDialogOpen(true);
  };

  const handleEquipAvatar = async (avatar: any) => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ active_avatar_id: avatar.id } as any)
      .eq("id", user.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setActiveAvatar(avatar);
      setProfile((p: any) => ({ ...p, active_avatar_id: avatar.id }));
      toast({ title: `${avatar.name} equipped!` });
      setAvatarDialogOpen(false);
    }
  };

  const xpProgress = profile ? (profile.xp / xpForLevel(profile.level)) * 100 : 0;
  const winRate = battleStats.total > 0 ? Math.round((battleStats.wins / battleStats.total) * 100) : 0;

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved!" });
      setProfile((p: any) => ({ ...p, display_name: displayName }));
    }
  };

  const handleControlModeChange = async (mode: ControlMode) => {
    setControlMode(mode);
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ control_mode: mode } as any).eq("id", user.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Controls updated!" });
    }
  };

  const handleCreditsSpent = async (amount: number) => {
    if (!user || !profile) return;
    const newCredits = Math.max(0, (profile.credits || 0) - amount);
    await supabase.from("profiles").update({ credits: newCredits }).eq("id", user.id);
    setProfile((p: any) => ({ ...p, credits: newCredits }));
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const profileStars = stars.filter(s => s.assigned_to_type === "profile");
  const unassignedStars = stars.filter(s => !s.assigned_to_type);

  const avatarImgSrc = activeAvatar ? getAvatarImageUrl(activeAvatar) : null;

  const handleEmoteSlotClick = async (slotIndex: number) => {
    setEmoteSlotToReplace(slotIndex);
    // Load all owned emotes (defaults + purchased)
    if (!user) return;
    const { data: defaults } = await supabase
      .from("emotes")
      .select("id, name, image_url")
      .eq("is_default", true);
    const { data: playerEmoteRows } = await supabase
      .from("player_emotes")
      .select("emote_id, emotes(id, name, image_url)")
      .eq("user_id", user.id) as any;
    const purchased = (playerEmoteRows || []).map((r: any) => r.emotes);
    const defaultIds = new Set((defaults || []).map((d: any) => d.id));
    const combined = [...(defaults || []), ...purchased.filter((p: any) => !defaultIds.has(p.id))];
    setAllOwnedEmotes(combined);
    setEmoteDialogOpen(true);
  };

  const handleSelectEmoteForSlot = async (emote: any) => {
    if (!user || emoteSlotToReplace === null) return;
    const slot = emoteSlotToReplace + 1; // 1-indexed
    // Upsert — delete existing then insert
    await supabase.from("player_emote_loadout").delete().eq("user_id", user.id).eq("slot", slot);
    await supabase.from("player_emote_loadout").insert({
      user_id: user.id,
      slot,
      emote_id: emote.id,
    } as any);
    // Update local state
    const newLoadout = [...emoteLoadout];
    newLoadout[emoteSlotToReplace] = emote;
    setEmoteLoadout(newLoadout);
    setEmoteDialogOpen(false);
    toast({ title: `${emote.name} equipped!` });
  };

  return (
    <div className="px-4 py-4 flex-1 overflow-y-auto">
      <EmailVerificationOverlay />
      <div className="mx-auto max-w-md space-y-6">
        <h1 className="font-display text-2xl font-bold tracking-wider text-primary glow-text">PILOT PROFILE</h1>

        {profile && (
          <>
            <div className="glass-panel space-y-6 p-6 relative">
              {isVip && (
                <div className="absolute top-3 right-3 gold-sweep-btn px-2.5 py-1 rounded-md flex items-center gap-1.5">
                  <Crown className="h-3.5 w-3.5 text-yellow-950" />
                  <span className="font-display text-[10px] tracking-wider text-yellow-950">VIP</span>
                </div>
              )}
              <div className="flex items-center gap-4">
                <button
                  onClick={handleAvatarClick}
                  className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 border border-primary/30 overflow-hidden hover:border-primary/60 transition-all cursor-pointer"
                >
                  {avatarImgSrc ? (
                    <GameImage src={avatarImgSrc} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-display text-xl text-primary">{(profile.display_name || "P")[0].toUpperCase()}</span>
                  )}
                </button>
                <div>
                  <p className="font-display text-lg text-foreground">{profile.display_name || "Pilot"}</p>
                  <p className="text-sm text-muted-foreground font-body">Level {profile.level}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm font-body">
                  <span className="text-muted-foreground">XP</span>
                  <span className="text-primary">{formatNumber(profile.xp)} / {formatNumber(xpForLevel(profile.level))}</span>
                </div>
                <Progress value={xpProgress} className="h-2 bg-muted" />
              </div>

              <div className="flex items-center gap-2 font-body text-sm">
                <Coins className="h-4 w-4 text-yellow-400" />
                <span className="text-muted-foreground">Credits:</span>
                <span className="font-display text-yellow-400">{profile.credits ?? 0}</span>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground font-body">Callsign</label>
                <div className="flex gap-2">
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="bg-muted/50 border-border/50" />
                  <Button onClick={handleSave} disabled={saving} size="icon" variant="outline">
                    <Save className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Pilot Attributes — Star Slots */}
            <div className="glass-panel space-y-4 p-6">
              <div className="flex items-center gap-2">
                <StarOrb rarity="yellow" size={16} />
                <h2 className="font-display text-sm tracking-wider text-muted-foreground">PILOT ATTRIBUTES</h2>
              </div>
              <p className="font-body text-xs text-muted-foreground">
                Stars applied here boost stats across all ships. Earn stars from campaign battles (4+ stars).
              </p>
              <StarSlotGrid
                assignedStars={profileStars}
                unassignedStars={unassignedStars}
                assignedToType="profile"
                assignedToId={null}
                credits={profile.credits || 0}
                onStarChanged={loadStars}
                onCreditsSpent={handleCreditsSpent}
              />
            </div>

            {/* Emotes */}
            <div className="glass-panel space-y-4 p-6">
              <div className="flex items-center gap-2">
                <MessageSquareMore className="h-4 w-4 text-primary" />
                <h2 className="font-display text-sm tracking-wider text-muted-foreground">EMOTES</h2>
              </div>
              <p className="font-body text-xs text-muted-foreground">
                Tap an emote to swap it out. Buy more from the Store.
              </p>
              <div className="grid grid-cols-4 gap-2">
                {emoteLoadout.slice(0, 4).map((emote, i) => (
                  <button
                    key={emote?.id || i}
                    onClick={() => handleEmoteSlotClick(i)}
                    className="rounded-lg border border-border/30 bg-muted/20 overflow-hidden hover:border-primary/50 transition-all"
                  >
                    <div className="aspect-square overflow-hidden">
                      {emote?.image_url && <img src={emote.image_url} alt={emote.name} className="w-full h-full object-cover" />}
                    </div>
                    <p className="font-display text-[8px] tracking-wider text-center py-1 text-muted-foreground truncate px-0.5">{emote?.name || "Empty"}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Combat Record */}
            <div className="glass-panel space-y-4 p-6">
              <h2 className="font-display text-sm tracking-wider text-muted-foreground">COMBAT RECORD</h2>
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <p className="font-display text-4xl tracking-wider text-primary">{winRate}%</p>
                  <p className="font-body text-xs text-muted-foreground">Win Rate</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
                  <Swords className="h-4 w-4 text-primary" />
                  <div>
                    <p className="font-display text-sm text-foreground">{battleStats.total}</p>
                    <p className="font-body text-[10px] text-muted-foreground">Total Battles</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
                  <Trophy className="h-4 w-4 text-green-400" />
                  <div>
                    <p className="font-display text-sm text-foreground">{battleStats.wins}</p>
                    <p className="font-body text-[10px] text-muted-foreground">Victories</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
                  <Skull className="h-4 w-4 text-game-hp" />
                  <div>
                    <p className="font-display text-sm text-foreground">{battleStats.losses}</p>
                    <p className="font-body text-[10px] text-muted-foreground">Defeats</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
                  <Clock className="h-4 w-4 text-game-fuel" />
                  <div>
                    <p className="font-display text-sm text-foreground">{battleStats.avgTime}s</p>
                    <p className="font-body text-[10px] text-muted-foreground">Avg Time</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Combat Controls — Mobile Only */}
            {isMobile && (
              <div className="glass-panel space-y-4 p-6">
                <div className="flex items-center gap-2">
                  <Gamepad2 className="h-4 w-4 text-primary" />
                  <h2 className="font-display text-sm tracking-wider text-muted-foreground">COMBAT CONTROLS</h2>
                </div>
                <div className="flex flex-col gap-2">
                  {controlOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleControlModeChange(opt.value)}
                      className={`rounded-lg border px-4 py-3 text-left transition-all ${
                        controlMode === opt.value ? 'border-primary bg-primary/10' : 'border-border/30 bg-muted/20'
                      }`}
                    >
                      <span className={`font-display text-xs tracking-wider ${controlMode === opt.value ? 'text-primary' : 'text-foreground'}`}>
                        {opt.label}
                      </span>
                      <p className="font-body text-[11px] text-muted-foreground mt-1">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Music Controls */}
            <div className="glass-panel space-y-4 p-6">
              <div className="flex items-center gap-2">
                <Music className="h-4 w-4 text-primary" />
                <h2 className="font-display text-sm tracking-wider text-muted-foreground">MUSIC</h2>
              </div>
              <MusicControls />
            </div>

            <Button onClick={handleLogout} variant="outline" className="w-full gap-2 text-destructive hover:text-destructive">
              <LogOut className="h-4 w-4" /> Sign Out
            </Button>
          </>
        )}
      </div>

      {/* Avatar Selection Dialog */}
      <Dialog open={avatarDialogOpen} onOpenChange={setAvatarDialogOpen}>
        <DialogContent className="glass-panel border-border/50 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-lg tracking-wider text-primary">SELECT AVATAR</DialogTitle>
          </DialogHeader>
          {ownedAvatars.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <p className="font-body text-sm text-muted-foreground">No avatars owned yet.</p>
              <Button variant="outline" onClick={() => { setAvatarDialogOpen(false); navigate("/store"); }} className="font-display text-xs tracking-wider">
                VISIT STORE
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {ownedAvatars.map((avatar: any) => {
                const img = getAvatarImageUrl(avatar);
                const isActive = activeAvatar?.id === avatar.id;
                return (
                  <button
                    key={avatar.id}
                    onClick={() => handleEquipAvatar(avatar)}
                    className={`rounded-lg border overflow-hidden transition-all ${
                      isActive ? 'border-primary ring-2 ring-primary/30' : 'border-border/30 hover:border-primary/50'
                    }`}
                  >
                    <div className="aspect-square overflow-hidden">
                      {img && <GameImage src={img} alt={avatar.name} className="w-full h-full object-cover" />}
                    </div>
                    <p className="font-display text-[9px] tracking-wider text-center py-1 text-foreground">{avatar.name}</p>
                  </button>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Emote Selection Dialog */}
      <Dialog open={emoteDialogOpen} onOpenChange={setEmoteDialogOpen}>
        <DialogContent className="glass-panel border-border/50 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-lg tracking-wider text-primary">SELECT EMOTE</DialogTitle>
          </DialogHeader>
          {allOwnedEmotes.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <p className="font-body text-sm text-muted-foreground">No emotes available.</p>
              <Button variant="outline" onClick={() => { setEmoteDialogOpen(false); navigate("/store"); }} className="font-display text-xs tracking-wider">
                VISIT STORE
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {allOwnedEmotes.map((emote: any) => {
                const isEquipped = emoteLoadout.some((e: any) => e?.id === emote.id);
                return (
                  <button
                    key={emote.id}
                    onClick={() => handleSelectEmoteForSlot(emote)}
                    className={`rounded-lg border overflow-hidden transition-all ${
                      isEquipped ? 'border-primary ring-2 ring-primary/30' : 'border-border/30 hover:border-primary/50'
                    }`}
                  >
                    <div className="aspect-square overflow-hidden">
                      <img src={emote.image_url} alt={emote.name} className="w-full h-full object-cover" />
                    </div>
                    <p className="font-display text-[9px] tracking-wider text-center py-1 text-foreground">{emote.name}</p>
                  </button>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;
