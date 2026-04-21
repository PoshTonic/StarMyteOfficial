import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Mail, RefreshCw, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const COOLDOWN_SECONDS = 120;
const storageKey = (uid: string) => `starmyte_last_verify_resend_${uid}`;

const EmailVerificationOverlay = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [verified, setVerified] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Load profile verification state
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("email_verified")
        .eq("id", user.id)
        .single();
      if (!cancelled) setVerified(!!data?.email_verified);
    };
    load();

    // Realtime: react when user verifies in another tab/device
    const channel = supabase
      .channel(`profile-verify-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload: any) => {
          if (payload.new?.email_verified) setVerified(true);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Countdown ticker based on localStorage
  useEffect(() => {
    if (!user) return;
    const tick = () => {
      const last = parseInt(localStorage.getItem(storageKey(user.id)) || "0", 10);
      const elapsed = Math.floor((Date.now() - last) / 1000);
      const remaining = Math.max(0, COOLDOWN_SECONDS - elapsed);
      setSecondsLeft(remaining);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [user]);

  const handleResend = useCallback(async () => {
    if (!user || sending || secondsLeft > 0) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-verification-email");
      if (error) throw new Error(error.message);
      if (data?.alreadyVerified) {
        setVerified(true);
        toast({ title: "Already verified", description: "Your email is confirmed." });
        return;
      }
      localStorage.setItem(storageKey(user.id), Date.now().toString());
      setSecondsLeft(COOLDOWN_SECONDS);
      toast({
        title: "Verification email sent",
        description: "Check your inbox (and junk/spam folder).",
      });
    } catch (err: any) {
      toast({
        title: "Could not send email",
        description: err?.message || "Please try again shortly.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }, [user, sending, secondsLeft, toast]);

  const handleSignOut = async () => {
    await signOut();
  };

  if (!user || verified === null || verified) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const countdownLabel = `Resend available in ${mins}:${secs.toString().padStart(2, "0")}`;

  return createPortal(
    <div className="fixed inset-0 z-[55] flex items-center justify-center px-4 bg-background/95 backdrop-blur-sm">
      <div className="w-full max-w-md p-8 glass-panel rounded-xl text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 border border-primary/30">
          <Mail className="h-8 w-8 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold tracking-wider text-primary glow-text mb-3">
          VERIFY YOUR EMAIL
        </h1>
        <p className="text-sm text-muted-foreground font-body mb-2">
          We sent a verification link to
        </p>
        <p className="font-body text-sm font-semibold text-foreground mb-4 break-all">
          {user.email}
        </p>
        <p className="text-sm text-muted-foreground font-body mb-6 leading-relaxed">
          Click the link in the email to unlock your full pilot profile. Be sure to
          check your <span className="text-primary font-semibold">junk / spam folder</span>{" "}
          if you don't see it within a couple of minutes.
        </p>

        <Button
          onClick={handleResend}
          disabled={sending || secondsLeft > 0}
          className="w-full font-display tracking-wider mb-3"
        >
          <RefreshCw className={`h-4 w-4 ${sending ? "animate-spin" : ""}`} />
          {sending
            ? "SENDING..."
            : secondsLeft > 0
            ? countdownLabel
            : "RESEND VERIFICATION EMAIL"}
        </Button>

        <button
          onClick={handleSignOut}
          className="text-xs text-muted-foreground hover:text-primary font-body inline-flex items-center gap-1.5"
        >
          <LogOut className="h-3 w-3" />
          Sign out
        </button>
      </div>
    </div>,
    document.body
  );
};

export default EmailVerificationOverlay;
