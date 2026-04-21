import { Crown, Rocket, Crosshair, Palette, UserCircle, MessageSquareMore, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export type PurchaseType = "vip" | "ship" | "weapon" | "skin" | "avatar" | "emote";

interface PurchaseSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: PurchaseType;
  itemName?: string;
}

const CONFIG: Record<PurchaseType, { icon: typeof Crown; title: string; getMessage: (name: string) => string }> = {
  vip: {
    icon: Crown,
    title: "YOU'RE A VIP!",
    getMessage: () => "All VIP perks are now active. Enjoy 50% off store purchases, 2x rewards, and more!",
  },
  ship: {
    icon: Rocket,
    title: "SHIP ACQUIRED!",
    getMessage: (name) => `${name} has been added to your hangar with starter weapons equipped.`,
  },
  weapon: {
    icon: Crosshair,
    title: "WEAPON UNLOCKED!",
    getMessage: (name) => `${name} is now available to equip in your hangar.`,
  },
  skin: {
    icon: Palette,
    title: "SKIN ACQUIRED!",
    getMessage: (name) => `${name} skin has been added to your collection.`,
  },
  avatar: {
    icon: UserCircle,
    title: "AVATAR UNLOCKED!",
    getMessage: (name) => `${name} has been added to your avatar selection.`,
  },
  emote: {
    icon: MessageSquareMore,
    title: "EMOTE UNLOCKED!",
    getMessage: (name) => `${name} emote is now available in your loadout.`,
  },
};

export function PurchaseSuccessDialog({ open, onOpenChange, type, itemName = "" }: PurchaseSuccessDialogProps) {
  const config = CONFIG[type];
  const Icon = config.icon;
  const isVip = type === "vip";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`max-w-sm ${isVip ? "border-yellow-500/30 bg-gradient-to-b from-card to-card/80" : "glass-panel border-border/50"}`}
      >
        <DialogHeader className="text-center">
          <div
            className={`mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full ${
              isVip ? "bg-yellow-500/20" : "bg-primary/20"
            }`}
          >
            <Icon className={`h-7 w-7 ${isVip ? "text-yellow-400" : "text-primary"}`} />
          </div>
          <DialogTitle
            className={`font-display text-xl tracking-wider ${isVip ? "text-yellow-400" : "text-primary"}`}
          >
            {config.title}
          </DialogTitle>
          <DialogDescription className="font-body text-sm text-muted-foreground pt-1">
            {config.getMessage(itemName)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-2 py-2">
          <PartyPopper className={`h-5 w-5 ${isVip ? "text-yellow-400" : "text-primary"}`} />
          <span className="font-display text-xs tracking-wider text-muted-foreground">CONGRATULATIONS</span>
          <PartyPopper className={`h-5 w-5 ${isVip ? "text-yellow-400" : "text-primary"}`} />
        </div>

        <Button
          onClick={() => onOpenChange(false)}
          className={`w-full font-display tracking-wider text-xs ${
            isVip
              ? "bg-yellow-500 hover:bg-yellow-600 text-yellow-950"
              : ""
          }`}
        >
          AWESOME!
        </Button>
      </DialogContent>
    </Dialog>
  );
}
