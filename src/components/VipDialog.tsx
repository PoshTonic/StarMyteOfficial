import { Crown, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useVipStatus } from "@/hooks/useVipStatus";

const VIP_PERKS = [
  "50% Off All Store Purchases",
  "2x Rewards on Trophy Road",
  "2x Rewards on Battle Pass",
  "2x Rewards on Daily Login",
  "Free Access to Infinity Mode",
  "Gold Name Plate",
  "Seasonal VIP Avatar",
];

interface VipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VipDialog({ open, onOpenChange }: VipDialogProps) {
  const { isVip, loading, checkoutLoading, startCheckout, manageSubscription } = useVipStatus();

  const busy = loading || checkoutLoading;

  const handleAction = async () => {
    if (isVip) {
      await manageSubscription();
    } else {
      await startCheckout();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-yellow-500/30 bg-gradient-to-b from-card to-card/80">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/20">
            <Crown className="h-6 w-6 text-yellow-400" />
          </div>
          <DialogTitle className="font-display text-xl tracking-wider text-yellow-400">
            VIP PASS
          </DialogTitle>
          <DialogDescription className="font-display text-lg tracking-wider">
            £2.49/month
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {VIP_PERKS.map((perk) => (
            <div key={perk} className="flex items-center gap-3">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-yellow-500/20">
                <Check className="h-3 w-3 text-yellow-400" />
              </div>
              <span className="font-body text-sm text-foreground">{perk}</span>
            </div>
          ))}
        </div>

        {isVip ? (
          <div className="space-y-2">
            <p className="text-center text-xs text-green-400 font-display tracking-wider">
              ✓ VIP ACTIVE
            </p>
            <Button
              onClick={handleAction}
              disabled={busy}
              variant="outline"
              className="w-full font-display text-xs tracking-wider border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "MANAGE SUBSCRIPTION"}
            </Button>
          </div>
        ) : (
          <button
            onClick={handleAction}
            disabled={busy}
            className="gold-sweep-btn w-full py-3 rounded-lg font-display text-sm tracking-wider text-yellow-950 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Crown className="h-4 w-4" />
                SUBSCRIBE NOW
              </>
            )}
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
