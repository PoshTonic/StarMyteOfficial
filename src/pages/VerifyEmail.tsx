import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import CSSStarField from "@/components/CSSStarField";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

type Status = "loading" | "success" | "error";

const VerifyEmail = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const token = params.get("token") || "";
  const uid = params.get("uid") || "";

  useEffect(() => {
    let cancelled = false;
    const verify = async () => {
      if (!token || !uid) {
        setErrorMsg("This verification link is missing required information.");
        setStatus("error");
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke("verify-email-token", {
          body: { token, uid },
        });
        if (cancelled) return;
        if (error || !data?.ok) {
          setErrorMsg(data?.error || "Verification link invalid or expired.");
          setStatus("error");
          return;
        }
        setStatus("success");
      } catch (err: any) {
        if (cancelled) return;
        setErrorMsg(err?.message || "Something went wrong.");
        setStatus("error");
      }
    };
    verify();
    return () => {
      cancelled = true;
    };
  }, [token, uid]);

  // Auto-redirect on success after 4s
  useEffect(() => {
    if (status !== "success") return;
    const t = setTimeout(() => navigate("/profile"), 4000);
    return () => clearTimeout(t);
  }, [status, navigate]);

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <CSSStarField />
      <div className="relative z-10 w-full max-w-md p-8 glass-panel rounded-xl text-center">
        {status === "loading" && (
          <>
            <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
            <h1 className="font-display text-2xl font-bold tracking-wider text-primary glow-text mb-2">
              VERIFYING...
            </h1>
            <p className="text-sm text-muted-foreground font-body">
              Hold tight, Pilot. Confirming your credentials.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 className="h-14 w-14 text-emerald-400 mx-auto mb-4" />
            <h1 className="font-display text-2xl font-bold tracking-wider text-primary glow-text mb-3">
              EMAIL SUCCESSFULLY VERIFIED
            </h1>
            <p className="text-sm text-muted-foreground font-body mb-6">
              Your StarMyte account is fully activated. Welcome aboard, Pilot.
            </p>
            <Button
              onClick={() => navigate("/profile")}
              className="w-full font-display tracking-wider animate-pulse-glow"
            >
              ENTER STARMYTE
            </Button>
            <p className="mt-4 text-xs text-muted-foreground/60 font-body">
              Redirecting automatically in a moment...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="h-14 w-14 text-destructive mx-auto mb-4" />
            <h1 className="font-display text-2xl font-bold tracking-wider text-destructive mb-3">
              VERIFICATION FAILED
            </h1>
            <p className="text-sm text-muted-foreground font-body mb-6">
              {errorMsg}
            </p>
            <Button
              onClick={() => navigate("/profile")}
              variant="outline"
              className="w-full font-display tracking-wider"
            >
              BACK TO PROFILE
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
