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
import { getAvatarImageUrl } from "@/game/avatarImageUrl";
import { useToast } from "@/hooks/use-toast";

const AVAILABILITY_OPTIONS = [
  { value: "store", label: "Store" },
  { value: "prize", label: "Prize Only" },
  { value: "both", label: "Both" },
  { value: "default", label: "Default" },
];

interface AvatarRecord {
  id: string;
  name: string;
  image_path: string;
  image_url: string | null;
  price: number;
  availability: string;
}

const Avatars = () => {
  const { toast } = useToast();
  const [avatars, setAvatars] = useState<AvatarRecord[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [availabilities, setAvailabilities] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newAvatar, setNewAvatar] = useState({ name: "", price: 50, availability: "store" });
  const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null);
  const [newAvatarPreview, setNewAvatarPreview] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("avatars").select("*").order("created_at");
    const list = (data || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      image_path: a.image_path,
      image_url: a.image_url || null,
      price: a.price,
      availability: a.availability || "store",
    }));
    setAvatars(list);
    const p: Record<string, number> = {};
    const av: Record<string, string> = {};
    list.forEach((a) => {
      p[a.id] = a.price;
      av[a.id] = a.availability;
    });
    setPrices(p);
    setAvailabilities(av);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (avatar: AvatarRecord) => {
    setSaving(avatar.id);
    const newPrice = prices[avatar.id] ?? avatar.price;
    const newAvail = availabilities[avatar.id] ?? avatar.availability;
    const { error } = await supabase.from("avatars").update({ price: newPrice, availability: newAvail } as any).eq("id", avatar.id);
    setSaving(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${avatar.name} updated` });
    }
  };

  const handleUploadImage = async (avatar: AvatarRecord, file: File) => {
    setUploading(avatar.id);
    const ext = file.name.split(".").pop() || "png";
    const filePath = `${avatar.id}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setUploading(null);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;

    const { error: updateError } = await supabase.from("avatars").update({ image_url: publicUrl } as any).eq("id", avatar.id);
    setUploading(null);

    if (updateError) {
      toast({ title: "Error updating URL", description: updateError.message, variant: "destructive" });
    } else {
      toast({ title: `${avatar.name} image uploaded` });
      load();
    }
  };

  const handleNewAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setNewAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCreate = async () => {
    if (!newAvatar.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    if (!newAvatarFile) {
      toast({ title: "Image required", variant: "destructive" });
      return;
    }

    // Create DB entry first with a placeholder image_path
    const { data: inserted, error: insertError } = await supabase
      .from("avatars")
      .insert({
        name: newAvatar.name,
        image_path: newAvatar.name,
        price: newAvatar.price,
        availability: newAvatar.availability,
      } as any)
      .select("id")
      .single();

    if (insertError || !inserted) {
      toast({ title: "Error", description: insertError?.message || "Failed to create", variant: "destructive" });
      return;
    }

    // Upload image
    const ext = newAvatarFile.name.split(".").pop() || "png";
    const filePath = `${(inserted as any).id}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, newAvatarFile, { upsert: true });

    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    await supabase.from("avatars").update({ image_url: urlData.publicUrl } as any).eq("id", (inserted as any).id);

    toast({ title: `${newAvatar.name} created` });
    setCreateOpen(false);
    setNewAvatar({ name: "", price: 50, availability: "store" });
    setNewAvatarFile(null);
    setNewAvatarPreview(null);
    load();
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl tracking-wider text-primary glow-text">AVATARS</h1>
          <Button onClick={() => setCreateOpen(true)} className="font-display tracking-wider text-xs gap-2">
            <Plus className="h-4 w-4" /> ADD AVATAR
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {avatars.map((avatar) => {
            const img = getAvatarImageUrl(avatar);
            return (
              <Card key={avatar.id} className="bg-card/60 border-border/30 overflow-hidden">
                <div className="aspect-square overflow-hidden relative group">
                  {img && <img src={img} alt={avatar.name} className="w-full h-full object-cover" loading="lazy" />}
                  <label className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <Upload className="h-6 w-6 text-foreground" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading === avatar.id}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadImage(avatar, f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                <CardContent className="p-3 space-y-2">
                  <p className="font-display text-sm tracking-wider text-foreground">{avatar.name}</p>
                  <div className="flex items-center gap-2">
                    <Coins className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                    <Input
                      type="number"
                      value={prices[avatar.id] ?? avatar.price}
                      onChange={(e) => setPrices((p) => ({ ...p, [avatar.id]: parseInt(e.target.value) || 0 }))}
                      className="h-7 text-xs bg-muted/50 border-border/50"
                    />
                  </div>
                  <Select
                    value={availabilities[avatar.id] ?? avatar.availability}
                    onValueChange={(v) => setAvailabilities((a) => ({ ...a, [avatar.id]: v }))}
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
                    onClick={() => handleSave(avatar)}
                    disabled={saving === avatar.id}
                  >
                    <Save className="h-3 w-3 mr-1" /> SAVE
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Create Avatar Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="glass-panel border-border/50 max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-display tracking-wider text-primary">ADD AVATAR</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {newAvatarPreview && (
                <div className="rounded-lg overflow-hidden aspect-square max-w-[200px] mx-auto">
                  <img src={newAvatarPreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Image</Label>
                <label className="flex items-center gap-2 px-3 py-2 rounded-md border border-border/50 bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors text-xs text-muted-foreground">
                  <Upload className="h-3.5 w-3.5" />
                  <span>{newAvatarFile ? newAvatarFile.name : "Upload image..."}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleNewAvatarFileChange} />
                </label>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Name</Label>
                <Input value={newAvatar.name} onChange={(e) => setNewAvatar((a) => ({ ...a, name: e.target.value }))} className="bg-muted/50" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Price</Label>
                <Input type="number" value={newAvatar.price} onChange={(e) => setNewAvatar((a) => ({ ...a, price: parseInt(e.target.value) || 0 }))} className="bg-muted/50" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Availability</Label>
                <Select value={newAvatar.availability} onValueChange={(v) => setNewAvatar((a) => ({ ...a, availability: v }))}>
                  <SelectTrigger className="bg-muted/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AVAILABILITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} className="w-full font-display tracking-wider text-xs">
                CREATE AVATAR
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default Avatars;
