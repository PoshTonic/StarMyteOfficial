import { useEffect, useState, lazy, Suspense } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import dynamicIconImports from "lucide-react/dynamicIconImports";
import type { LucideProps } from "lucide-react";

interface DynIconProps extends Omit<LucideProps, "ref"> {
  name: keyof typeof dynamicIconImports;
}

const DynIcon = ({ name, ...props }: DynIconProps) => {
  const LucideIcon = lazy(dynamicIconImports[name]);
  return (
    <Suspense fallback={<div className="h-4 w-4" />}>
      <LucideIcon {...props} />
    </Suspense>
  );
};

const defaultForm = { name: "", type: "projectile", dmg: 0, heat: 0, cooldown: 0, fire_rate: 0, fire_mode: "tap", spd: 100 };

const Weapons = () => {
  const { toast } = useToast();
  const [weapons, setWeapons] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const load = async () => {
    const { data } = await supabase.from("weapons").select("*").order("created_at");
    setWeapons(data || []);
  };

  useEffect(() => { load(); }, []);

  const openEdit = (w: any) => {
    setEditing(w);
    setIsNew(false);
    setForm({ name: w.name, type: w.type, dmg: w.dmg, heat: w.heat, cooldown: Number(w.cooldown), fire_rate: Number(w.fire_rate), fire_mode: w.fire_mode, spd: w.spd });
  };

  const openNew = () => {
    setEditing({});
    setIsNew(true);
    setForm(defaultForm);
  };

  const handleSave = async () => {
    try {
      if (isNew) {
        const { error } = await supabase.from("weapons").insert(form);
        if (error) throw error;
        toast({ title: "Weapon created!" });
      } else {
        const { error } = await supabase.from("weapons").update(form).eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Weapon updated!" });
      }
      setEditing(null);
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl tracking-wider text-primary glow-text">WEAPONS</h1>
          <Button onClick={openNew} className="font-display tracking-wider text-xs gap-2">
            <Plus className="h-4 w-4" /> ADD WEAPON
          </Button>
        </div>

        <div className="glass-panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-display tracking-wider text-xs">NAME</TableHead>
                <TableHead className="font-display tracking-wider text-xs">TYPE</TableHead>
                <TableHead className="font-display tracking-wider text-xs hidden md:table-cell">DMG</TableHead>
                <TableHead className="font-display tracking-wider text-xs hidden md:table-cell">HEAT</TableHead>
                <TableHead className="font-display tracking-wider text-xs hidden md:table-cell">MODE</TableHead>
                <TableHead className="font-display tracking-wider text-xs hidden md:table-cell">SPD</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weapons.map((w) => (
                <TableRow key={w.id} className="cursor-pointer hover:bg-muted/30" onClick={() => openEdit(w)}>
                  <TableCell className="font-display tracking-wider">{w.name}</TableCell>
                  <TableCell>{w.type}</TableCell>
                  <TableCell className="hidden md:table-cell">{w.dmg}</TableCell>
                  <TableCell className="hidden md:table-cell">{w.heat}</TableCell>
                  <TableCell className="capitalize hidden md:table-cell">{w.fire_mode}</TableCell>
                  <TableCell className="hidden md:table-cell">{w.spd}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent className="glass-panel border-border/50 max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-display tracking-wider text-primary">
                {isNew ? "ADD WEAPON" : "EDIT WEAPON"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground font-body">Name</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-muted/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-body">Type</label>
                <Input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="bg-muted/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-body">Fire Mode</label>
                <Select value={form.fire_mode} onValueChange={(v) => setForm({ ...form, fire_mode: v })}>
                  <SelectTrigger className="bg-muted/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tap">Tap</SelectItem>
                    <SelectItem value="hold">Hold</SelectItem>
                    <SelectItem value="target">Target</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(["dmg", "heat", "cooldown", "fire_rate", "spd"] as const).map((field) => (
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

export default Weapons;
