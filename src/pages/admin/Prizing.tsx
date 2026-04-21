import { useEffect, useState, useCallback, useRef } from "react";
import { Plus, Trash2, Edit2, Trophy, Award, CalendarDays, Swords, Upload, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/AdminLayout";

interface Prize {
  type: string;
  amount?: number;
  item_id?: string;
  rarity?: string;
}

interface SeasonTier {
  id: string;
  season_id: string;
  unlock_value: number;
  standard_prizes: Prize[];
  vip_prizes: Prize[];
  sort_order: number;
}

interface Season {
  id: string;
  name: string;
  type: string;
  start_date: string;
  duration_days: number;
  active: boolean;
}

interface DailyReward {
  id: string;
  day_number: number;
  standard_prizes: Prize[];
  vip_prizes: Prize[];
}

interface Quest {
  id: string;
  title: string;
  description: string;
  type: string;
  objective_type: string;
  objective_target: number;
  prizes: Prize[];
  active: boolean;
}

const PRIZE_TYPES = [
  { value: "credits", label: "Credits" },
  { value: "xp", label: "XP" },
  { value: "star_orb", label: "Star Orb" },
  { value: "ship_skin", label: "Ship Skin" },
  { value: "jet_skin", label: "Jet Skin" },
  { value: "ship", label: "Ship" },
  { value: "avatar", label: "Avatar" },
];

const OBJECTIVE_TYPES = [
  { value: "win_battles", label: "Win Battles" },
  { value: "play_battles", label: "Play Battles" },
  { value: "deal_damage", label: "Deal Damage" },
  { value: "destroy_asteroids", label: "Destroy Asteroids" },
  { value: "earn_credits", label: "Earn Credits" },
  { value: "earn_xp", label: "Earn XP" },
  { value: "fly_distance", label: "Fly Distance" },
];

const STAR_RARITIES = ["yellow", "blue", "orange", "red", "purple"];

// ── Prize Editor Component ──
function PrizeEditor({ prizes, onChange, label }: { prizes: Prize[]; onChange: (p: Prize[]) => void; label: string }) {
  const [ships, setShips] = useState<{ id: string; name: string }[]>([]);
  const [skins, setSkins] = useState<{ id: string; name: string; type: string }[]>([]);
  const [avatars, setAvatars] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    supabase.from("ships").select("id, name").then(({ data }) => data && setShips(data));
    supabase.from("skins").select("id, name, type").then(({ data }) => data && setSkins(data));
    supabase.from("avatars").select("id, name").then(({ data }) => data && setAvatars(data));
  }, []);

  const addPrize = () => onChange([...prizes, { type: "credits", amount: 100 }]);
  const removePrize = (i: number) => onChange(prizes.filter((_, j) => j !== i));
  const updatePrize = (i: number, updates: Partial<Prize>) => {
    const next = [...prizes];
    next[i] = { ...next[i], ...updates };
    // Reset fields when type changes
    if (updates.type) {
      if (["credits", "xp"].includes(updates.type)) {
        next[i] = { type: updates.type, amount: next[i].amount || 100 };
      } else if (updates.type === "star_orb") {
        next[i] = { type: "star_orb", rarity: "yellow" };
      } else {
        next[i] = { type: updates.type, item_id: "" };
      }
    }
    onChange(next);
  };

  const getItemOptions = (type: string) => {
    if (type === "ship") return ships.map((s) => ({ value: s.id, label: s.name }));
    if (type === "ship_skin") return skins.filter((s) => s.type === "ship").map((s) => ({ value: s.id, label: s.name }));
    if (type === "jet_skin") return skins.filter((s) => s.type === "jet").map((s) => ({ value: s.id, label: s.name }));
    if (type === "avatar") return avatars.map((a) => ({ value: a.id, label: a.name }));
    return [];
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="font-display text-xs tracking-wider">{label}</Label>
        <Button type="button" variant="ghost" size="sm" onClick={addPrize} className="h-6 text-xs gap-1">
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
      {prizes.map((prize, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Select value={prize.type} onValueChange={(v) => updatePrize(i, { type: v })}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIZE_TYPES.map((pt) => (
                <SelectItem key={pt.value} value={pt.value}>
                  {pt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {["credits", "xp"].includes(prize.type) && (
            <Input
              type="number"
              value={prize.amount || 0}
              onChange={(e) => updatePrize(i, { amount: parseInt(e.target.value) || 0 })}
              className="w-20 h-8 text-xs"
            />
          )}
          {prize.type === "star_orb" && (
            <Select value={prize.rarity || "yellow"} onValueChange={(v) => updatePrize(i, { rarity: v })}>
              <SelectTrigger className="w-24 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAR_RARITIES.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {["ship_skin", "jet_skin", "ship", "avatar"].includes(prize.type) && (
            <Select value={prize.item_id || ""} onValueChange={(v) => updatePrize(i, { item_id: v })}>
              <SelectTrigger className="flex-1 h-8 text-xs">
                <SelectValue placeholder="Select item..." />
              </SelectTrigger>
              <SelectContent>
                {getItemOptions(prize.type).map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => removePrize(i)} className="h-8 w-8 p-0 text-destructive">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      {prizes.length === 0 && <p className="text-xs text-muted-foreground">No prizes yet</p>}
    </div>
  );
}

// Format prizes for display
function prizeSummary(prizes: Prize[]): string {
  if (!prizes || prizes.length === 0) return "—";
  return prizes
    .map((p) => {
      if (p.type === "credits") return `${p.amount} Credits`;
      if (p.type === "xp") return `${p.amount} XP`;
      if (p.type === "star_orb") return `⭐ ${p.rarity || "random"}`;
      return p.type.replace("_", " ");
    })
    .join(", ");
}

// ── XLSX Import helpers ──
function parsePrizeCell(
  raw: string,
  skins: { id: string; name: string; type: string }[],
  avatars: { id: string; name: string }[],
  ships: { id: string; name: string }[]
): { prize: Prize | null; warning: string | null } {
  if (!raw || !raw.trim()) return { prize: null, warning: null };
  const val = raw.trim();
  const [prefix, ...rest] = val.split(":");
  const body = rest.join(":").trim();
  const p = prefix.trim().toUpperCase();

  if (p === "CR") return { prize: { type: "credits", amount: parseInt(body) || 0 }, warning: null };
  if (p === "XP") return { prize: { type: "xp", amount: parseInt(body) || 0 }, warning: null };
  if (p === "SO") return { prize: { type: "star_orb", rarity: body.toLowerCase() }, warning: null };
  if (p === "SS") {
    const skin = skins.find((s) => s.type === "ship" && s.name.toLowerCase() === body.toLowerCase());
    if (!skin) return { prize: { type: "ship_skin" }, warning: `Ship skin "${body}" not found` };
    return { prize: { type: "ship_skin", item_id: skin.id }, warning: null };
  }
  if (p === "JS") {
    const skin = skins.find((s) => s.type === "jet" && s.name.toLowerCase() === body.toLowerCase());
    if (!skin) return { prize: { type: "jet_skin" }, warning: `Jet skin "${body}" not found` };
    return { prize: { type: "jet_skin", item_id: skin.id }, warning: null };
  }
  if (p === "A") {
    const normalized = body.replace(/-/g, " ");
    const avatar = avatars.find((a) => a.name.toLowerCase() === normalized.toLowerCase());
    if (!avatar) return { prize: { type: "avatar" }, warning: `Avatar "${body}" not found` };
    return { prize: { type: "avatar", item_id: avatar.id }, warning: null };
  }
  if (p === "S") {
    const ship = ships.find((s) => s.name.toLowerCase() === body.toLowerCase());
    if (!ship) return { prize: { type: "ship" }, warning: `Ship "${body}" not found` };
    return { prize: { type: "ship", item_id: ship.id }, warning: null };
  }
  return { prize: null, warning: `Unknown prefix "${p}" in "${val}"` };
}

interface ParsedTier {
  unlock_value: number;
  standard_prizes: Prize[];
  vip_prizes: Prize[];
  warnings: string[];
}

// ── Trophy Road / Battle Pass Tab ──
function SeasonTiersTab({ seasonType, icon }: { seasonType: string; icon: React.ReactNode }) {
  const { toast } = useToast();
  const [season, setSeason] = useState<Season | null>(null);
  const [tiers, setTiers] = useState<SeasonTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTier, setEditTier] = useState<SeasonTier | null>(null);
  const [isNew, setIsNew] = useState(false);

  // Form
  const [formUnlock, setFormUnlock] = useState(0);
  const [formStandard, setFormStandard] = useState<Prize[]>([]);
  const [formVip, setFormVip] = useState<Prize[]>([]);

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [parsedTiers, setParsedTiers] = useState<ParsedTier[]>([]);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    const { data: seasons } = await supabase
      .from("seasons")
      .select("*")
      .eq("type", seasonType)
      .eq("active", true)
      .limit(1);
    const s = seasons?.[0] as unknown as Season | undefined;
    setSeason(s || null);
    if (s) {
      const { data: tierData } = await supabase
        .from("season_tiers")
        .select("*")
        .eq("season_id", s.id)
        .order("sort_order", { ascending: true });
      setTiers((tierData || []) as unknown as SeasonTier[]);
    }
    setLoading(false);
  }, [seasonType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openNew = () => {
    setIsNew(true);
    setFormUnlock(0);
    setFormStandard([]);
    setFormVip([]);
    setEditTier({ id: "", season_id: season?.id || "", unlock_value: 0, standard_prizes: [], vip_prizes: [], sort_order: tiers.length });
  };

  const openEdit = (t: SeasonTier) => {
    setIsNew(false);
    setFormUnlock(t.unlock_value);
    setFormStandard(t.standard_prizes || []);
    setFormVip(t.vip_prizes || []);
    setEditTier(t);
  };

  const save = async () => {
    if (!season) return;
    const payload = {
      season_id: season.id,
      unlock_value: formUnlock,
      standard_prizes: formStandard,
      vip_prizes: formVip,
      sort_order: isNew ? tiers.length : editTier!.sort_order,
    };
    if (isNew) {
      const { error } = await supabase.from("season_tiers").insert(payload as any);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Tier added" });
    } else {
      const { error } = await supabase.from("season_tiers").update(payload as any).eq("id", editTier!.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Tier updated" });
    }
    setEditTier(null);
    fetchData();
  };

  const deleteTier = async (id: string) => {
    await supabase.from("season_tiers").delete().eq("id", id);
    toast({ title: "Tier deleted" });
    fetchData();
  };

  // ── XLSX Import ──
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Load reference data
    const [skinsRes, avatarsRes, shipsRes] = await Promise.all([
      supabase.from("skins").select("id, name, type"),
      supabase.from("avatars").select("id, name"),
      supabase.from("ships").select("id, name"),
    ]);
    const skins = skinsRes.data || [];
    const avatars = avatarsRes.data || [];
    const ships = shipsRes.data || [];

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      const parsed: ParsedTier[] = [];
      const allWarnings: string[] = [];

      // Skip header row (row 0)
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        const unlockVal = parseInt(String(row[0])) || 0;
        if (unlockVal === 0) continue;

        const stdPrizes: Prize[] = [];
        const vipPrizes: Prize[] = [];
        const warnings: string[] = [];

        // Standard: columns B, C (index 1, 2)
        for (const col of [1, 2]) {
          const cell = String(row[col] || "").trim();
          if (!cell) continue;
          const { prize, warning } = parsePrizeCell(cell, skins, avatars, ships);
          if (prize) stdPrizes.push(prize);
          if (warning) { warnings.push(warning); allWarnings.push(`Row ${i + 1}: ${warning}`); }
        }

        // VIP: columns D, E (index 3, 4)
        for (const col of [3, 4]) {
          const cell = String(row[col] || "").trim();
          if (!cell) continue;
          const { prize, warning } = parsePrizeCell(cell, skins, avatars, ships);
          if (prize) vipPrizes.push(prize);
          if (warning) { warnings.push(warning); allWarnings.push(`Row ${i + 1}: ${warning}`); }
        }

        parsed.push({ unlock_value: unlockVal, standard_prizes: stdPrizes, vip_prizes: vipPrizes, warnings });
      }

      setParsedTiers(parsed);
      setImportWarnings(allWarnings);
      setShowImport(true);
    };
    reader.readAsArrayBuffer(file);
    // Reset file input so the same file can be re-selected
    e.target.value = "";
  };

  const executeImport = async () => {
    if (!season || parsedTiers.length === 0) return;
    setImporting(true);

    // Delete all existing tiers for this season
    const { error: delError } = await supabase.from("season_tiers").delete().eq("season_id", season.id);
    if (delError) {
      toast({ title: "Error deleting existing tiers", description: delError.message, variant: "destructive" });
      setImporting(false);
      return;
    }

    // Bulk insert parsed tiers
    const rows = parsedTiers.map((t, i) => ({
      season_id: season.id,
      unlock_value: t.unlock_value,
      standard_prizes: t.standard_prizes,
      vip_prizes: t.vip_prizes,
      sort_order: i,
    }));

    const { error: insError } = await supabase.from("season_tiers").insert(rows as any);
    if (insError) {
      toast({ title: "Error inserting tiers", description: insError.message, variant: "destructive" });
      setImporting(false);
      return;
    }

    toast({ title: `Imported ${parsedTiers.length} tiers` });
    setShowImport(false);
    setParsedTiers([]);
    setImporting(false);
    fetchData();
  };

  if (loading) return <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>;
  if (!season) return <p className="text-sm text-muted-foreground">No active season found. Create one in the database.</p>;

  const unlockLabel = seasonType === "trophy_road" ? "Trophies" : "XP";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-display text-sm tracking-wider text-muted-foreground">
            {season.name} — {unlockLabel} Ladder
          </span>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            size="sm"
            variant="outline"
            className="font-display text-xs tracking-wider gap-1"
          >
            <Upload className="h-3.5 w-3.5" /> IMPORT XLSX
          </Button>
          <Button onClick={openNew} size="sm" className="font-display text-xs tracking-wider gap-1">
            <Plus className="h-3.5 w-3.5" /> ADD TIER
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border/30 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-display text-xs tracking-wider w-20">{unlockLabel.toUpperCase()}</TableHead>
              <TableHead className="font-display text-xs tracking-wider">STANDARD</TableHead>
              <TableHead className="font-display text-xs tracking-wider">VIP</TableHead>
              <TableHead className="font-display text-xs tracking-wider w-20">ACTIONS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tiers.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-display text-sm text-primary">{t.unlock_value}</TableCell>
                <TableCell className="text-xs">{prizeSummary(t.standard_prizes)}</TableCell>
                <TableCell className="text-xs text-yellow-400">{prizeSummary(t.vip_prizes)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(t)}><Edit2 className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteTier(t.id)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {tiers.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-sm">No tiers yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit/Add Tier Dialog */}
      <Dialog open={!!editTier} onOpenChange={(open) => !open && setEditTier(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display tracking-wider">{isNew ? "ADD TIER" : "EDIT TIER"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="font-display text-xs tracking-wider">{unlockLabel} Required</Label>
              <Input type="number" value={formUnlock} onChange={(e) => setFormUnlock(parseInt(e.target.value) || 0)} />
            </div>
            <PrizeEditor prizes={formStandard} onChange={setFormStandard} label="Standard Prizes" />
            <PrizeEditor prizes={formVip} onChange={setFormVip} label="VIP Prizes" />
            <Button onClick={save} className="w-full font-display text-xs tracking-wider">{isNew ? "ADD" : "SAVE"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Preview Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display tracking-wider">IMPORT PREVIEW — {parsedTiers.length} TIERS</DialogTitle>
          </DialogHeader>

          {importWarnings.length > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 space-y-1">
              <div className="flex items-center gap-2 text-destructive text-sm font-display tracking-wider">
                <AlertTriangle className="h-4 w-4" /> WARNINGS
              </div>
              {importWarnings.map((w, i) => (
                <p key={i} className="text-xs text-destructive/80">{w}</p>
              ))}
            </div>
          )}

          <div className="rounded-lg border border-border/30 overflow-hidden max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-display text-xs tracking-wider w-20">{unlockLabel.toUpperCase()}</TableHead>
                  <TableHead className="font-display text-xs tracking-wider">STANDARD</TableHead>
                  <TableHead className="font-display text-xs tracking-wider">VIP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedTiers.map((t, i) => (
                  <TableRow key={i} className={t.warnings.length > 0 ? "bg-destructive/5" : ""}>
                    <TableCell className="font-display text-sm text-primary">{t.unlock_value}</TableCell>
                    <TableCell className="text-xs">{prizeSummary(t.standard_prizes)}</TableCell>
                    <TableCell className="text-xs text-yellow-400">{prizeSummary(t.vip_prizes)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <p className="text-xs text-muted-foreground">
            This will <strong>replace all existing tiers</strong> for this season. You can still manually edit individual tiers afterwards.
          </p>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowImport(false)} className="font-display text-xs tracking-wider">
              CANCEL
            </Button>
            <Button onClick={executeImport} disabled={importing} className="font-display text-xs tracking-wider gap-1">
              <Upload className="h-3.5 w-3.5" /> {importing ? "IMPORTING..." : `IMPORT ${parsedTiers.length} TIERS`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Daily Login Tab ──
function DailyLoginTab() {
  const { toast } = useToast();
  const [rewards, setRewards] = useState<DailyReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDay, setEditDay] = useState<DailyReward | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [formDay, setFormDay] = useState(1);
  const [formStandard, setFormStandard] = useState<Prize[]>([]);
  const [formVip, setFormVip] = useState<Prize[]>([]);

  const fetch = useCallback(async () => {
    const { data } = await supabase.from("daily_login_rewards").select("*").order("day_number");
    setRewards((data || []) as unknown as DailyReward[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const openNew = () => {
    setIsNew(true);
    setFormDay(rewards.length + 1);
    setFormStandard([]);
    setFormVip([]);
    setEditDay({ id: "", day_number: rewards.length + 1, standard_prizes: [], vip_prizes: [] });
  };

  const openEdit = (r: DailyReward) => {
    setIsNew(false);
    setFormDay(r.day_number);
    setFormStandard(r.standard_prizes || []);
    setFormVip(r.vip_prizes || []);
    setEditDay(r);
  };

  const save = async () => {
    const payload = { day_number: formDay, standard_prizes: formStandard, vip_prizes: formVip };
    if (isNew) {
      const { error } = await supabase.from("daily_login_rewards").insert(payload as any);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Day added" });
    } else {
      const { error } = await supabase.from("daily_login_rewards").update(payload as any).eq("id", editDay!.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Day updated" });
    }
    setEditDay(null);
    fetch();
  };

  const deleteDay = async (id: string) => {
    await supabase.from("daily_login_rewards").delete().eq("id", id);
    toast({ title: "Day deleted" });
    fetch();
  };

  if (loading) return <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-green-400" />
          <span className="font-display text-sm tracking-wider text-muted-foreground">30-Day Calendar</span>
        </div>
        <Button onClick={openNew} size="sm" className="font-display text-xs tracking-wider gap-1">
          <Plus className="h-3.5 w-3.5" /> ADD DAY
        </Button>
      </div>

      <div className="rounded-lg border border-border/30 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-display text-xs tracking-wider w-16">DAY</TableHead>
              <TableHead className="font-display text-xs tracking-wider">STANDARD</TableHead>
              <TableHead className="font-display text-xs tracking-wider">VIP</TableHead>
              <TableHead className="font-display text-xs tracking-wider w-20">ACTIONS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rewards.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-display text-sm text-green-400">{r.day_number}</TableCell>
                <TableCell className="text-xs">{prizeSummary(r.standard_prizes)}</TableCell>
                <TableCell className="text-xs text-yellow-400">{prizeSummary(r.vip_prizes)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(r)}><Edit2 className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteDay(r.id)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rewards.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-sm">No days configured</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editDay} onOpenChange={(open) => !open && setEditDay(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display tracking-wider">{isNew ? "ADD DAY" : "EDIT DAY"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="font-display text-xs tracking-wider">Day Number</Label>
              <Input type="number" value={formDay} onChange={(e) => setFormDay(parseInt(e.target.value) || 1)} min={1} max={30} />
            </div>
            <PrizeEditor prizes={formStandard} onChange={setFormStandard} label="Standard Prizes" />
            <PrizeEditor prizes={formVip} onChange={setFormVip} label="VIP Prizes" />
            <Button onClick={save} className="w-full font-display text-xs tracking-wider">{isNew ? "ADD" : "SAVE"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Quests Tab ──
function QuestsTab() {
  const { toast } = useToast();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [editQuest, setEditQuest] = useState<Quest | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formObjType, setFormObjType] = useState("win_battles");
  const [formObjTarget, setFormObjTarget] = useState(1);
  const [formPrizes, setFormPrizes] = useState<Prize[]>([]);
  const [formActive, setFormActive] = useState(true);
  const [formType, setFormType] = useState("daily");

  const fetch = useCallback(async () => {
    const { data } = await supabase.from("quests").select("*").order("created_at", { ascending: false });
    setQuests((data || []) as unknown as Quest[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const openNew = () => {
    setIsNew(true);
    setFormTitle("");
    setFormDesc("");
    setFormObjType("win_battles");
    setFormObjTarget(1);
    setFormPrizes([]);
    setFormActive(true);
    setFormType("daily");
    setEditQuest({ id: "", title: "", description: "", type: "daily", objective_type: "win_battles", objective_target: 1, prizes: [], active: true });
  };

  const openEdit = (q: Quest) => {
    setIsNew(false);
    setFormTitle(q.title);
    setFormDesc(q.description);
    setFormObjType(q.objective_type);
    setFormObjTarget(q.objective_target);
    setFormPrizes(q.prizes || []);
    setFormActive(q.active);
    setFormType(q.type || "daily");
    setEditQuest(q);
  };

  const save = async () => {
    const payload = {
      title: formTitle,
      description: formDesc,
      type: formType,
      objective_type: formObjType,
      objective_target: formObjTarget,
      prizes: formPrizes,
      active: formActive,
    };
    if (isNew) {
      const { error } = await supabase.from("quests").insert(payload as any);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Quest added" });
    } else {
      const { error } = await supabase.from("quests").update(payload as any).eq("id", editQuest!.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Quest updated" });
    }
    setEditQuest(null);
    fetch();
  };

  const deleteQuest = async (id: string) => {
    await supabase.from("quests").delete().eq("id", id);
    toast({ title: "Quest deleted" });
    fetch();
  };

  if (loading) return <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Swords className="h-5 w-5 text-orange-400" />
          <span className="font-display text-sm tracking-wider text-muted-foreground">Quests</span>
        </div>
        <Button onClick={openNew} size="sm" className="font-display text-xs tracking-wider gap-1">
          <Plus className="h-3.5 w-3.5" /> ADD QUEST
        </Button>
      </div>

      <div className="rounded-lg border border-border/30 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-display text-xs tracking-wider">TITLE</TableHead>
              <TableHead className="font-display text-xs tracking-wider w-16">TYPE</TableHead>
              <TableHead className="font-display text-xs tracking-wider">OBJECTIVE</TableHead>
              <TableHead className="font-display text-xs tracking-wider">PRIZES</TableHead>
              <TableHead className="font-display text-xs tracking-wider w-16">ACTIVE</TableHead>
              <TableHead className="font-display text-xs tracking-wider w-20">ACTIONS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quests.map((q) => (
              <TableRow key={q.id}>
                <TableCell className="font-body text-sm">{q.title}</TableCell>
                <TableCell className="text-xs text-muted-foreground capitalize">{q.type}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {q.objective_type.replace("_", " ")} × {q.objective_target}
                </TableCell>
                <TableCell className="text-xs">{prizeSummary(q.prizes)}</TableCell>
                <TableCell className="text-xs">{q.active ? "✅" : "❌"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(q)}><Edit2 className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteQuest(q.id)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {quests.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-sm">No quests yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editQuest} onOpenChange={(open) => !open && setEditQuest(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display tracking-wider">{isNew ? "ADD QUEST" : "EDIT QUEST"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="font-display text-xs tracking-wider">Title</Label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="font-display text-xs tracking-wider">Description</Label>
              <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="font-display text-xs tracking-wider">Quest Type</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-display text-xs tracking-wider">Objective Type</Label>
                <Select value={formObjType} onValueChange={setFormObjType}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OBJECTIVE_TYPES.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-display text-xs tracking-wider">Target</Label>
                <Input type="number" value={formObjTarget} onChange={(e) => setFormObjTarget(parseInt(e.target.value) || 1)} className="h-8" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={formActive} onChange={(e) => setFormActive(e.target.checked)} id="quest-active" />
              <Label htmlFor="quest-active" className="font-display text-xs tracking-wider">Active</Label>
            </div>
            <PrizeEditor prizes={formPrizes} onChange={setFormPrizes} label="Prizes" />
            <Button onClick={save} className="w-full font-display text-xs tracking-wider">{isNew ? "ADD" : "SAVE"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Main Prizing Page ──
const Prizing = () => {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Award className="h-6 w-6 text-yellow-400" />
          <h1 className="font-display text-xl tracking-wider text-foreground">PRIZING</h1>
        </div>
        <p className="font-body text-sm text-muted-foreground">
          Manage rewards across Trophy Road, Battle Pass, Daily Login calendar, and Quests.
        </p>

        <Tabs defaultValue="trophy_road" className="w-full">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="trophy_road" className="font-display text-xs tracking-wider">Trophy Road</TabsTrigger>
            <TabsTrigger value="battle_pass" className="font-display text-xs tracking-wider">Battle Pass</TabsTrigger>
            <TabsTrigger value="daily_login" className="font-display text-xs tracking-wider">Daily Login</TabsTrigger>
            <TabsTrigger value="quests" className="font-display text-xs tracking-wider">Quests</TabsTrigger>
          </TabsList>

          <TabsContent value="trophy_road">
            <SeasonTiersTab seasonType="trophy_road" icon={<Trophy className="h-5 w-5 text-blue-400" />} />
          </TabsContent>
          <TabsContent value="battle_pass">
            <SeasonTiersTab seasonType="battle_pass" icon={<Award className="h-5 w-5 text-purple-400" />} />
          </TabsContent>
          <TabsContent value="daily_login">
            <DailyLoginTab />
          </TabsContent>
          <TabsContent value="quests">
            <QuestsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default Prizing;
