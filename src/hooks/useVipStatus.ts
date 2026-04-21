import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface VipStatus {
  isVip: boolean;
  subscriptionEnd: string | null;
  loading: boolean;
}

export function useVipStatus() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<VipStatus>({
    isVip: false,
    subscriptionEnd: null,
    loading: true,
  });
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const checkVip = useCallback(async () => {
    if (!user) {
      setStatus({ isVip: false, subscriptionEnd: null, loading: false });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("check-vip");
      if (error) throw error;
      setStatus({
        isVip: data?.subscribed ?? false,
        subscriptionEnd: data?.subscription_end ?? null,
        loading: false,
      });
    } catch {
      setStatus((prev) => ({ ...prev, loading: false }));
    }
  }, [user]);

  useEffect(() => {
    checkVip();
    const interval = setInterval(checkVip, 60_000);
    return () => clearInterval(interval);
  }, [checkVip]);

  const startCheckout = async () => {
    if (checkoutLoading) return;
    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-vip-checkout");
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err) {
      console.error("Checkout error:", err);
      toast({
        title: "Checkout failed",
        description: "Unable to connect to payment provider. Please try again.",
        variant: "destructive",
      });
      setCheckoutLoading(false);
    }
  };

  const manageSubscription = async () => {
    if (checkoutLoading) return;
    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No portal URL returned");
      }
    } catch (err) {
      console.error("Portal error:", err);
      toast({
        title: "Error",
        description: "Unable to open subscription management. Please try again.",
        variant: "destructive",
      });
      setCheckoutLoading(false);
    }
  };

  return { ...status, checkVip, startCheckout, manageSubscription, checkoutLoading };
}
