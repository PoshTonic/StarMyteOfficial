import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { weaponImages } from "@/game/weaponImages";
import { WEAPON_DESCRIPTIONS } from "@/game/weaponDescriptions";
import GameImage from "@/components/GameImage";

interface Weapon {
  id: string;
  name: string;
  dmg: number;
  spd: number;
  heat: number;
  cooldown: number;
  fire_mode: string;
}

interface WeaponSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: number;
  allWeapons: Weapon[];
  currentWeaponId: string | null;
  onSelect: (weaponId: string) => void;
  onRemove: () => void;
}

const WeaponSelectDialog = ({
  open,
  onOpenChange,
  slot,
  allWeapons,
  currentWeaponId,
  onSelect,
  onRemove,
}: WeaponSelectDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel border-border/30 max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wider text-primary">
            SLOT {slot}
          </DialogTitle>
          <DialogDescription className="font-body text-xs text-muted-foreground">
            Select a weapon for this slot
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="grid grid-cols-3 gap-2 mt-2 pr-3">
            {allWeapons.map((w) => {
              const isEquipped = w.id === currentWeaponId;
              return (
                <button
                  key={w.id}
                  onClick={() => onSelect(w.id)}
                  className={`glass-panel p-1.5 space-y-1 text-left transition-all hover:border-primary/50 ${
                    isEquipped ? "border-primary bg-primary/10" : ""
                  }`}
                >
                  <div className="rounded-md overflow-hidden aspect-square bg-black/20">
                    <GameImage src={weaponImages[w.name]} alt={w.name} className="w-full h-full object-contain" />
                  </div>
                  <span className="font-display text-[8px] tracking-wider block text-center">{w.name}</span>
                  <div className="space-y-0.5 text-[8px] text-muted-foreground font-body">
                    <p>DMG: <span className="text-foreground">{w.dmg}</span></p>
                    <p>Heat: <span className="text-foreground">{w.heat}</span></p>
                  </div>
                  <span className={`font-display text-[7px] tracking-wider ${isEquipped ? "text-primary" : "invisible"}`}>EQUIPPED</span>
                </button>
              );
            })}
          </div>
        </ScrollArea>

        {currentWeaponId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="mt-2 text-destructive hover:text-destructive font-display text-xs tracking-wider"
          >
            REMOVE WEAPON
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WeaponSelectDialog;
