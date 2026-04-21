import type { User } from "@supabase/supabase-js";
import type { NavigateFunction } from "react-router-dom";

/**
 * If the user is signed in, returns true.
 * Otherwise navigates to /auth?redirect=<redirectTo> and returns false.
 */
export function requireAuth(
  user: User | null,
  navigate: NavigateFunction,
  redirectTo: string,
): boolean {
  if (user) return true;
  navigate(`/auth?redirect=${encodeURIComponent(redirectTo)}`);
  return false;
}
