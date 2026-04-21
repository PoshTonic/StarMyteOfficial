import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { supabase } from "@/integrations/supabase/client";

function logErrorToDb(message: string, stack: string | null, type: string, url: string | null) {
  supabase.auth.getUser().then(({ data }) => {
    const userId = data?.user?.id ?? null;
    if (!userId) return; // can't insert without user_id due to RLS
    supabase.from("app_errors").insert({
      user_id: userId,
      error_message: message.substring(0, 2000),
      error_stack: stack?.substring(0, 4000) ?? null,
      error_type: type,
      url: url ?? window.location.href,
    }).then(() => {});
  });
}

window.onerror = (message, source, lineno, colno, error) => {
  logErrorToDb(
    String(message),
    error?.stack ?? `${source}:${lineno}:${colno}`,
    "runtime",
    String(source ?? window.location.href)
  );
};

window.onunhandledrejection = (event) => {
  const reason = event.reason;
  logErrorToDb(
    reason?.message ?? String(reason),
    reason?.stack ?? null,
    reason?.message?.includes("timeout") || reason?.message?.includes("network") ? "network_timeout" : "runtime",
    window.location.href
  );
};

// Intercept fetch errors for network timeout detection
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  try {
    const response = await originalFetch(...args);
    if (!response.ok && response.status >= 500) {
      logErrorToDb(
        `HTTP ${response.status}: ${response.statusText}`,
        null,
        "network_timeout",
        String(args[0])
      );
    }
    return response;
  } catch (err: any) {
    logErrorToDb(
      err?.message ?? "Network error",
      err?.stack ?? null,
      "network_timeout",
      String(args[0])
    );
    throw err;
  }
};

// Service worker handling: unregister in iframe/preview, update in production
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if ('serviceWorker' in navigator) {
  if (isInIframe || isPreviewHost) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(reg => reg.unregister());
    });
  } else {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(reg => reg.update());
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);
