import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import CSSStarField from "@/components/CSSStarField";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "valid" | "already" | "invalid" | "success" | "error">("loading");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`, {
      headers: { apikey: anonKey },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.valid === true) setStatus("valid");
        else if (data.reason === "already_unsubscribed") setStatus("already");
        else setStatus("invalid");
      })
      .catch(() => setStatus("error"));
  }, [token]);

  const handleUnsubscribe = async () => {
    const { data } = await supabase.functions.invoke("handle-email-unsubscribe", {
      body: { token },
    });
    if (data?.success) setStatus("success");
    else if (data?.reason === "already_unsubscribed") setStatus("already");
    else setStatus("error");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <CSSStarField />
      <div className="relative z-10 w-full max-w-md p-8 bg-card/80 border border-border/50 rounded-xl text-center">
        <h1 className="mb-4 font-display text-2xl font-bold tracking-wider text-primary glow-text">
          STARMYTE
        </h1>
        {status === "loading" && <p className="text-muted-foreground font-body">Verifying…</p>}
        {status === "valid" && (
          <>
            <p className="mb-6 text-muted-foreground font-body">
              Are you sure you want to unsubscribe from StarMyte emails?
            </p>
            <button
              onClick={handleUnsubscribe}
              className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-display tracking-wider hover:opacity-90 transition"
            >
              CONFIRM UNSUBSCRIBE
            </button>
          </>
        )}
        {status === "success" && (
          <p className="text-green-400 font-body">You have been unsubscribed successfully.</p>
        )}
        {status === "already" && (
          <p className="text-muted-foreground font-body">You are already unsubscribed.</p>
        )}
        {status === "invalid" && (
          <p className="text-destructive font-body">Invalid or expired unsubscribe link.</p>
        )}
        {status === "error" && (
          <p className="text-destructive font-body">Something went wrong. Please try again later.</p>
        )}
      </div>
    </div>
  );
};

export default Unsubscribe;
