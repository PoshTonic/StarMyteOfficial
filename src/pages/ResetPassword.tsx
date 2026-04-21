import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import CSSStarField from "@/components/CSSStarField";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    // Also check hash for type=recovery
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setReady(true);
    }
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: "Password updated!", description: "You can now sign in with your new password." });
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <CSSStarField />
      <div className="relative z-10 w-full max-w-md p-8 bg-card/80 border border-border/50 rounded-xl">
        <h1 className="mb-2 text-center font-display text-3xl font-bold tracking-wider text-primary glow-text">
          STARMYTE
        </h1>
        <p className="mb-8 text-center text-sm text-muted-foreground font-body">
          Set your new password
        </p>

        {!ready ? (
          <p className="text-center text-muted-foreground font-body text-sm">
            Verifying your reset link…
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="font-body">New Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-muted/50 border-border/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="font-body">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-muted/50 border-border/50"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full font-display tracking-wider animate-pulse-glow">
              {loading ? "UPDATING..." : "SET NEW PASSWORD"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground font-body">
          <button onClick={() => navigate("/auth")} className="text-primary hover:underline font-semibold">
            Back to Sign In
          </button>
        </p>

        <div className="mt-6 pt-4 border-t border-border/30 flex items-center justify-center gap-4 text-xs text-muted-foreground font-body">
          <Link to="/terms" className="hover:text-primary hover:underline">
            Terms of Service
          </Link>
          <span className="opacity-50">·</span>
          <Link to="/privacy" className="hover:text-primary hover:underline">
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
