import { useState, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMusic } from "@/contexts/MusicContext";
import CSSStarField from "@/components/CSSStarField";
import LoadingScreen from "@/components/LoadingScreen";

const Auth = () => {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";
  const { toast } = useToast();
  const { preload, startMusic, unlock } = useMusic();

  const handleLoadingComplete = useCallback(() => {
    unlock();
    startMusic();
    navigate(redirectTo);
  }, [navigate, unlock, startMusic, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast({
          title: "Reset link sent!",
          description: "Check your email for a password reset link.",
        });
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setShowLoading(true);
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName || "Pilot" } },
        });
        if (error) throw error;
        // Fire-and-forget: send our custom branded verification email
        supabase.functions.invoke("send-verification-email").catch((err) => {
          console.error("Failed to send verification email:", err);
        });
        toast({
          title: "Account created!",
          description: "Check your email to verify your account.",
        });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      setShowLoading(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setLoading(false);
    }
  };

  if (showLoading) {
    return <LoadingScreen onComplete={handleLoadingComplete} preloadFn={preload} />;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <CSSStarField />
      <div className="relative z-10 w-full max-w-md p-8 bg-card/80 border border-border/50 rounded-xl">
        <h1 className="mb-2 text-center font-display text-3xl font-bold tracking-wider text-primary glow-text">
          STARMYTE
        </h1>
        <p className="mb-8 text-center text-sm text-muted-foreground font-body">
          {mode === "login" ? "Welcome back, Pilot" : mode === "register" ? "Register your callsign" : "Reset your password"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div className="space-y-2">
              <Label htmlFor="displayName" className="font-body">Callsign</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your pilot name"
                className="bg-muted/50 border-border/50"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email" className="font-body">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pilot@starmyte.com"
              className="bg-muted/50 border-border/50"
            />
          </div>
          {mode !== "forgot" && (
            <div className="space-y-2">
              <Label htmlFor="password" className="font-body">Password</Label>
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
          )}
          <Button type="submit" disabled={loading} className="w-full font-display tracking-wider animate-pulse-glow">
            {loading ? "Loading..." : mode === "login" ? "LAUNCH" : mode === "register" ? "ENLIST" : "SEND RESET LINK"}
          </Button>
        </form>

        {mode !== "forgot" && (
          <>
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border/50" />
              <span className="text-xs text-muted-foreground font-body">OR</span>
              <div className="h-px flex-1 bg-border/50" />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full font-body bg-background hover:bg-accent"
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </Button>
          </>
        )}

        {mode === "login" && (
          <p className="mt-3 text-center text-sm text-muted-foreground font-body">
            <button onClick={() => setMode("forgot")} className="text-primary/70 hover:text-primary hover:underline text-xs">
              Forgot password?
            </button>
          </p>
        )}

        <p className="mt-4 text-center text-sm text-muted-foreground font-body">
          {mode === "login" ? "No account?" : mode === "register" ? "Already enlisted?" : "Remember your password?"}{" "}
          <button
            onClick={() => setMode(mode === "register" ? "login" : mode === "login" ? "register" : "login")}
            className="text-primary hover:underline font-semibold"
          >
            {mode === "login" ? "Register" : "Sign In"}
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

export default Auth;
