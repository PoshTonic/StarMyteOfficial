import { useEffect, useState } from "react";
import { Coins, Save, Plus, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ShipDisplay from "@/components/ShipDisplay";
import ThrusterDisplay from "@/components/ThrusterDisplay";
import { SkinColourMap } from "@/game/skinUtils";

const AVAILABILITY_OPTIONS = [
  { value: "store", label: "Store" },
  { value: "prize", label: "Prize Only" },
  { value: "both", label: "Both" },
  { value: "default", label: "Default" },
];

interface SkinRecord {
  id: string;
  name: string;
  type: string;
  price: number;
  colours: SkinColourMap;
  availability: string;
}

/** Parse a skin swatch SVG and extract fill colours from Colour_x5F_N groups */
function parseSkinSVG(svgText: string): SkinColourMap | null {
  const colourMap: SkinColourMap = {};
  const groupPattern = /<g[^>]*\bid="Colour_x5F_(\d+)"[^>]*>[\s\S]*?<\/g>/gi;
  let match;
  while ((match = groupPattern.exec(svgText)) !== null) {
    const colourKey = match[1];
    const inner = match[0];
    const fillMatch = /fill="([^"]+)"/.exec(inner);
    if (fillMatch) {
      colourMap[colourKey] = fillMatch[1];
    }
  }
  return Object.keys(colourMap).length > 0 ? colourMap : null;
}

const Skins = () => {
  const { toast } = useToast();
  const [skins, setSkins] = useState<SkinRecord[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [availabilities, setAvailabilities] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newSkin, setNewSkin] = useState({
    name: "",
    type: "ship",
    price: 100,
    availability: "store",
    colours: { "1": "#f4f4f4", "2": "#d6d6d6", "3": "#ffffff", "4": "#00f9ff" } as SkinColourMap,
  });

  const load = async () => {
    const { data } = await supabase.from("skins").select("*").order("created_at");
    const list = (data || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      price: s.price,
      colours: s.colours as SkinColourMap,
      availability: s.availability || "store",
    }));
    setSkins(list);
    const p: Record<string, number> = {};
    const a: Record<string, string> = {};
    list.forEach((s) => {
      p[s.id] = s.price;
      a[s.id] = s.availability;
    });
    setPrices(p);
    setAvailabilities(a);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (skin: SkinRecord) => {
    setSaving(skin.id);
    const newPrice = prices[skin.id] ?? skin.price;
    const newAvail = availabilities[skin.id] ?? skin.availability;
    const { error } = await supabase.from("skins").update({ price: newPrice, availability: newAvail } as any).eq("id", skin.id);
    setSaving(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${skin.name} updated` });
    }
  };

  const handleSvgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseSkinSVG(reader.result as string);
      if (parsed) {
        setNewSkin((prev) => ({ ...prev, colours: parsed }));
        toast({ title: "SVG parsed", description: `Extracted ${Object.keys(parsed).length} colours` });
      } else {
        toast({ title: "Parse failed", description: "No Colour_x5F_N groups found", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-uploaded
    e.target.value = "";
  };

  const handleCreate = async () => {
    if (!newSkin.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("skins").insert({
      name: newSkin.name,
      type: newSkin.type,
      price: newSkin.price,
      availability: newSkin.availability,
      colours: newSkin.colours,
    } as any);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${newSkin.name} created` });
      setCreateOpen(false);
      setNewSkin({ name: "", type: "ship", price: 100, availability: "store", colours: { "1": "#f4f4f4", "2": "#d6d6d6", "3": "#ffffff", "4": "#00f9ff" } });
      load();
    }
  };

  const shipSkins = skins.filter((s) => s.type === "ship");
  const jetSkins = skins.filter((s) => s.type === "jet");

  const renderSkinCard = (skin: SkinRecord) => (
    <Card key={skin.id} className="bg-card/60 border-border/30 overflow-hidden">
      <div className="aspect-square overflow-hidden flex items-center justify-center bg-card/80 p-4">
        {skin.type === "jet" ? (
          <ThrusterDisplay className="h-20 w-20" skinColours={skin.colours} />
        ) : (
          <ShipDisplay shipName="AX15" className="h-20 w-20" skinColours={skin.colours} />
        )}
      </div>
      <CardContent className="p-3 space-y-2">
        <p className="font-display text-sm tracking-wider text-foreground">{skin.name}</p>
        <div className="flex items-center gap-2">
          <Coins className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
          <Input
            type="number"
            value={prices[skin.id] ?? skin.price}
            onChange={(e) => setPrices((p) => ({ ...p, [skin.id]: parseInt(e.target.value) || 0 }))}
            className="h-7 text-xs bg-muted/50 border-border/50"
          />
        </div>
        <Select
          value={availabilities[skin.id] ?? skin.availability}
          onValueChange={(v) => setAvailabilities((a) => ({ ...a, [skin.id]: v }))}
        >
          <SelectTrigger className="h-7 text-xs bg-muted/50 border-border/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AVAILABILITY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          className="w-full h-7 text-xs font-display tracking-wider"
          onClick={() => handleSave(skin)}
          disabled={saving === skin.id}
        >
          <Save className="h-3 w-3 mr-1" /> SAVE
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-4xl">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl tracking-wider text-primary glow-text">SKINS</h1>
          <Button onClick={() => setCreateOpen(true)} className="font-display tracking-wider text-xs gap-2">
            <Plus className="h-4 w-4" /> ADD SKIN
          </Button>
        </div>

        <div className="space-y-4">
          <h2 className="font-display text-sm tracking-wider text-muted-foreground">SHIP SKINS</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {shipSkins.map(renderSkinCard)}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="font-display text-sm tracking-wider text-muted-foreground">JET SKINS</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {jetSkins.map(renderSkinCard)}
          </div>
        </div>

        {/* Create Skin Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="glass-panel border-border/50 max-w-sm max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display tracking-wider text-primary">ADD SKIN</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {/* Live Preview */}
              <div className="rounded-lg bg-card/80 p-6 flex items-center justify-center">
                {newSkin.type === "jet" ? (
                  <ThrusterDisplay className="h-24 w-24" skinColours={newSkin.colours} />
                ) : (
                  <ShipDisplay shipName="AX15" className="h-24 w-24" skinColours={newSkin.colours} />
                )}
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Name</Label>
                <Input value={newSkin.name} onChange={(e) => setNewSkin((s) => ({ ...s, name: e.target.value }))} className="bg-muted/50" />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Type</Label>
                <Select value={newSkin.type} onValueChange={(v) => setNewSkin((s) => ({ ...s, type: v }))}>
                  <SelectTrigger className="bg-muted/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ship">Ship Skin</SelectItem>
                    <SelectItem value="jet">Jet Skin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Price</Label>
                <Input type="number" value={newSkin.price} onChange={(e) => setNewSkin((s) => ({ ...s, price: parseInt(e.target.value) || 0 }))} className="bg-muted/50" />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Availability</Label>
                <Select value={newSkin.availability} onValueChange={(v) => setNewSkin((s) => ({ ...s, availability: v }))}>
                  <SelectTrigger className="bg-muted/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AVAILABILITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Colour Entry */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Colours</Label>
                  <label className="flex items-center gap-1.5 px-2 py-1 rounded border border-border/50 bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors text-[10px] text-muted-foreground">
                    <Upload className="h-3 w-3" />
                    <span>Parse from SVG</span>
                    <input type="file" accept=".svg" className="hidden" onChange={handleSvgUpload} />
                  </label>
                </div>
                {["1", "2", "3", "4"].map((key) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-16 shrink-0">Colour {key}</span>
                    <input
                      type="color"
                      value={newSkin.colours[key] || "#000000"}
                      onChange={(e) => setNewSkin((s) => ({ ...s, colours: { ...s.colours, [key]: e.target.value } }))}
                      className="h-7 w-10 rounded border border-border/50 bg-transparent cursor-pointer"
                    />
                    <Input
                      value={newSkin.colours[key] || ""}
                      onChange={(e) => setNewSkin((s) => ({ ...s, colours: { ...s.colours, [key]: e.target.value } }))}
                      className="h-7 text-xs bg-muted/50 border-border/50 flex-1"
                      placeholder="#hex"
                    />
                  </div>
                ))}
              </div>

              <Button onClick={handleCreate} className="w-full font-display tracking-wider text-xs">
                CREATE SKIN
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default Skins;
