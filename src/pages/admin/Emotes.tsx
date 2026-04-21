import { useEffect, useState } from "react";
import { Coins, Save } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EmoteRecord {
  id: string;
  name: string;
  image_url: string;
  price: number;
  is_default: boolean;
}

const Emotes = () => {
  const { toast } = useToast();
  const [emotes, setEmotes] = useState<EmoteRecord[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("emotes").select("*").order("price");
    const list = (data || []) as EmoteRecord[];
    setEmotes(list);
    const p: Record<string, number> = {};
    list.forEach((e) => { p[e.id] = e.price; });
    setPrices(p);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (emote: EmoteRecord) => {
    setSaving(emote.id);
    const newPrice = prices[emote.id] ?? emote.price;
    const { error } = await supabase.from("emotes").update({ price: newPrice }).eq("id", emote.id);
    setSaving(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${emote.name} updated` });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl">
        <h1 className="font-display text-2xl tracking-wider text-primary glow-text">EMOTES</h1>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {emotes.map((emote) => (
            <Card key={emote.id} className="bg-card/60 border-border/30 overflow-hidden">
              <div className="aspect-[3/4] overflow-hidden">
                <img src={emote.image_url} alt={emote.name} className="w-full h-full object-contain" loading="lazy" />
              </div>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <p className="font-display text-sm tracking-wider text-foreground truncate">{emote.name}</p>
                  {emote.is_default && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">DEFAULT</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <Coins className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                  <Input
                    type="number"
                    value={prices[emote.id] ?? emote.price}
                    onChange={(e) => setPrices((p) => ({ ...p, [emote.id]: parseInt(e.target.value) || 0 }))}
                    className="h-7 text-xs bg-muted/50 border-border/50"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-xs font-display tracking-wider"
                  onClick={() => handleSave(emote)}
                  disabled={saving === emote.id}
                >
                  <Save className="h-3 w-3 mr-1" /> SAVE
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
};

export default Emotes;
