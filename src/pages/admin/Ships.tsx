import { useEffect, useState } from "react";
import { Plus, Upload, Info } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/AdminLayout";
import ShipDisplay from "@/components/ShipDisplay";
import { supabase } from "@/integrations/supabase/client";

const SHIP_GRADIENTS: Record<string, string> = {
  KARQQ: "from-amber-900/40 to-yellow-600/20",
  SCORJ: "from-cyan-900/40 to-blue-600/20",
  AX15: "from-red-900/40 to-orange-600/20",
  CROWN: "from-violet-900/40 to-purple-600/20",
  NR77: "from-rose-900/40 to-pink-600/20",
  BERTH4: "from-emerald-900/40 to-green-600/20",
  "QUR-I": "from-orange-900/40 to-amber-600/20",
  ZZ11: "from-sky-900/40 to-blue-600/20",
  WEGE: "from-teal-900/40 to-cyan-600/20",
};

const Ships = () => {
  const { toast } = useToast();
  const [ships, setShips] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState({ name: "", hp: 100, speed: 50, fuel: 100, heat_cap: 100, price: 200, availability: "store" });
  const [svgFile, setSvgFile] = useState<File | null>(null);
  const [svgPreview, setSvgPreview] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("ships").select("*").order("created_at");
    setShips(data || []);
  };

  useEffect(() => { load(); }, []);

  const openEdit = (ship: any) => {
    setEditing(ship);
    setIsNew(false);
    setForm({ name: ship.name, hp: ship.hp, speed: ship.speed, fuel: ship.fuel, heat_cap: ship.heat_cap, price: ship.price, availability: ship.availability || "store" });
    setSvgFile(null);
    setSvgPreview(null);
  };

  const openNew = () => {
    setEditing({});
    setIsNew(true);
    setForm({ name: "", hp: 100, speed: 50, fuel: 100, heat_cap: 100, price: 200, availability: "store" });
    setSvgFile(null);
    setSvgPreview(null);
  };

  const parseSVGLayers = (svgText: string, shipName: string): { hull: string; flames: string } | null => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const allGroups = doc.querySelectorAll("g");

    let hullGroup: Element | null = null;
    let flamesGroup: Element | null = null;

    allGroups.forEach((g) => {
      const id = g.getAttribute("id") || "";
      const label = g.getAttribute("inkscape:label") || g.getAttribute("data-name") || id;
      if (label.toLowerCase().includes("hull")) hullGroup = g;
      if (label.toLowerCase().includes("flame")) flamesGroup = g;
    });

    if (!hullGroup || !flamesGroup) return null;

    const wrapSVG = (inner: string) =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 250"><g>${inner}</g></svg>`;

    return {
      hull: wrapSVG((hullGroup as Element).innerHTML),
      flames: wrapSVG((flamesGroup as Element).innerHTML),
    };
  };

  const handleSvgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSvgFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      setSvgPreview(reader.result as string);
    };
    reader.readAsText(file);
  };

  const handleSave = async () => {
    try {
      let svgData: Record<string, string> = {};

      if (svgPreview) {
        const parsed = parseSVGLayers(svgPreview, form.name);
        if (!parsed) {
          toast({
            title: "SVG parsing failed",
            description: "Could not find Hull-[Name] and Flames-[Name] layers. Please check the layer naming.",
            variant: "destructive",
          });
          return;
        }
        svgData = { svg_hull: parsed.hull, svg_flames: parsed.flames };
      }

      if (isNew) {
        const { error } = await supabase.from("ships").insert({ ...form, ...svgData });
        if (error) throw error;
        toast({ title: "Ship created!" });
      } else {
        const { error } = await supabase.from("ships").update({ ...form, ...svgData }).eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Ship updated!" });
      }
      setEditing(null);
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const statBar = (label: string, value: number, max: number, colorClass: string) => (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px] font-body">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${colorClass} transition-all`} style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  );

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl tracking-wider text-primary glow-text">SHIPS</h1>
          <Button onClick={openNew} className="font-display tracking-wider text-xs gap-2">
            <Plus className="h-4 w-4" /> ADD SHIP
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {ships.map((ship) => {
            const gradient = SHIP_GRADIENTS[ship.name] || "from-primary/20 to-accent/10";
            return (
              <button
                key={ship.id}
                onClick={() => openEdit(ship)}
                className="glass-panel p-3 space-y-2 text-left transition-all hover:border-primary/50 hover:shadow-[0_0_15px_hsl(199_89%_48%/0.15)] cursor-pointer"
              >
                <div className={`relative rounded-lg bg-gradient-to-br ${gradient} p-4 flex items-center justify-center aspect-square`}>
                  <ShipDisplay shipName={ship.name} className="h-20 w-20" />
                </div>
                <span className="font-display text-sm tracking-wider text-foreground block text-center">{ship.name}</span>
              </button>
            );
          })}
          {ships.length === 0 && (
            <div className="col-span-full glass-panel p-8 flex flex-col items-center justify-center min-h-[200px] space-y-4">
              <p className="font-display text-sm tracking-wider text-muted-foreground">NO SHIPS YET</p>
            </div>
          )}
        </div>

        <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent className="glass-panel border-border/50 max-w-sm max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display tracking-wider text-primary">
                {isNew ? "ADD SHIP" : "EDIT SHIP"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {/* SVG Preview */}
              {!isNew && editing && (
                <div className={`rounded-lg bg-gradient-to-br ${SHIP_GRADIENTS[editing.name] || "from-primary/20 to-accent/10"} p-6 flex items-center justify-center`}>
                  <ShipDisplay shipName={editing.name} className="h-24 w-24" />
                </div>
              )}

              <div>
                <label className="text-xs text-muted-foreground font-body">Name</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-muted/50" />
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-body uppercase">PRICE (CREDITS)</label>
                <Input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                  className="bg-muted/50"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-body uppercase">AVAILABILITY</label>
                <Select value={form.availability} onValueChange={(v) => setForm({ ...form, availability: v })}>
                  <SelectTrigger className="bg-muted/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="store">Store</SelectItem>
                    <SelectItem value="prize">Prize Only</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                    <SelectItem value="default">Default</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(["hp", "speed", "fuel", "heat_cap"] as const).map((field) => (
                <div key={field}>
                  <label className="text-xs text-muted-foreground font-body uppercase">{field.replace("_", " ")}</label>
                  <Input
                    type="number"
                    value={form[field]}
                    onChange={(e) => setForm({ ...form, [field]: Number(e.target.value) })}
                    className="bg-muted/50"
                  />
                </div>
              ))}

              {/* SVG Upload */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-body">Ship SVG</label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md border border-border/50 bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors text-xs text-muted-foreground">
                    <Upload className="h-3.5 w-3.5" />
                    <span>{svgFile ? svgFile.name : "Upload SVG..."}</span>
                    <input type="file" accept=".svg" className="hidden" onChange={handleSvgChange} />
                  </label>
                </div>
                <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground/70">
                  <Info className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>SVGs must contain two groups named <code className="text-primary/70">Hull-[ShipName]</code> and <code className="text-primary/70">Flames-[ShipName]</code> for proper parsing.</span>
                </div>
              </div>

              <Button onClick={handleSave} className="w-full font-display tracking-wider text-xs">
                {isNew ? "CREATE" : "SAVE CHANGES"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default Ships;
