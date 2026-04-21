import { useEffect, useState, useCallback, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Swords, Warehouse, UserCircle, ShoppingBag, Coins,
  ShieldCheck, Trophy,
} from "lucide-react";
import StarField from "@/components/StarField";
import { useAuth } from "@/contexts/AuthContext";
import { useMusic } from "@/contexts/MusicContext";
import { supabase } from "@/integrations/supabase/client";
import { requireAuth } from "@/lib/requireAuth";

const TRANSITION_MS = 750;

/** Positional index for bottom-nav pages (left → right). */
const NAV_ORDER: Record<string, number> = {
  "/store": 0,
  "/hangar": 1,
  "/": 2,
  "/ladder": 3,
  "/infinity-ladder": 3,
  "/profile": 4,
};

/** Sidebar / engagement pages default to "right" of everything. */
const SIDEBAR_INDEX = 5;

const getNavIndex = (path: string): number => NAV_ORDER[path] ?? SIDEBAR_INDEX;

const GameLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { introMode, setIntroMode } = useMusic();
  const [credits, setCredits] = useState(0);
  const [trophies, setTrophies] = useState(0);
  const [level, setLevel] = useState(1);
  const [isAdmin, setIsAdmin] = useState(false);
  

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase.from("profiles").select("credits, trophies, level").eq("id", user.id).single();
      if (data) {
        setCredits(data.credits ?? 0);
        setTrophies(data.trophies ?? 0);
        setLevel(data.level ?? 1);
      }
      const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      setIsAdmin(!!role);
    };
    load();
  }, [user]);

  // Real-time profile updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('profile-header')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${user.id}`,
      }, (payload) => {
        const p = payload.new as any;
        if (p.credits !== undefined) setCredits(p.credits);
        if (p.trophies !== undefined) setTrophies(p.trophies);
        if (p.level !== undefined) setLevel(p.level);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Clear introMode after 3.25s
  useEffect(() => {
    if (!introMode) return;
    const timer = setTimeout(() => setIntroMode(false), 3250);
    return () => clearTimeout(timer);
  }, [introMode, setIntroMode]);

  // Transition state
  const [transitionClass, setTransitionClass] = useState("animate-page-enter");
  const isTransitioning = useRef(false);
  const pendingPath = useRef<string | null>(null);
  const directionRef = useRef<"left" | "right">("right");

  const navigateTo = useCallback((path: string) => {
    if (path === location.pathname || isTransitioning.current) return;
    isTransitioning.current = true;
    pendingPath.current = path;

    // Determine direction based on positional index
    const currentIdx = getNavIndex(location.pathname);
    const targetIdx = getNavIndex(path);
    const goingRight = targetIdx >= currentIdx;
    directionRef.current = goingRight ? "right" : "left";

    // Exit: if going right, current page slides out to the left (and vice versa)
    setTransitionClass(goingRight ? "animate-page-exit-left" : "animate-page-exit-right");
    setTimeout(() => {
      navigate(path);
    }, TRANSITION_MS);
  }, [location.pathname, navigate]);

  // When route actually changes, play enter animation
  useEffect(() => {
    if (pendingPath.current && location.pathname === pendingPath.current) {
      pendingPath.current = null;
    }
    if (introMode) {
      setTransitionClass("");
    } else {
      // Enter from the opposite side of the exit direction
      const enterClass = directionRef.current === "right"
        ? "animate-page-enter-from-right"
        : "animate-page-enter-from-left";
      setTransitionClass(enterClass);
    }
    const timer = setTimeout(() => {
      isTransitioning.current = false;
    }, TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  

  const bottomNav = [
    { label: "STORE", icon: ShoppingBag, path: "/store" },
    { label: "HANGAR", icon: Warehouse, path: "/hangar" },
    { label: "BATTLE", icon: Swords, path: "/", primary: true },
    { label: "LADDERS", icon: Trophy, path: "/ladder" },
    { label: "PROFILE", icon: UserCircle, path: "/profile" },
  ];

  const isActive = (path: string) => {
    if (path === "/ladder") return location.pathname === "/ladder" || location.pathname === "/infinity-ladder";
    return location.pathname === path;
  };

  const isBattle = location.pathname === "/battle";

  return (
    <div className="fixed inset-0 flex flex-col">
      <StarField />

      {/* Top bar - hidden during battle */}
      {!isBattle && <div className={`relative z-10 flex items-center justify-between px-4 pt-3 pb-1 ${introMode ? "intro-slide-down" : ""}`}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 glass-panel px-3 py-1.5">
            <Coins className="h-4 w-4 text-yellow-400" />
            <span className="font-display text-sm tracking-wider text-yellow-400">{credits}</span>
          </div>
          <div className="flex items-center gap-1.5 glass-panel px-3 py-1.5">
            <Trophy className="h-4 w-4 text-amber-400" />
            <span className="font-display text-sm tracking-wider text-amber-400">{trophies}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-display text-[10px] tracking-wider text-muted-foreground">LVL {level}</span>
          {isAdmin && (
            <button
              onClick={() => navigateTo("/admin")}
              className="glass-panel p-1.5 text-accent hover:text-accent/80 transition-colors"
            >
              <ShieldCheck className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>}

      {/* Page content with transitions */}
      <div className={`relative z-10 flex-1 flex flex-col overflow-y-auto overflow-x-hidden ${isBattle ? "!overflow-hidden" : ""}`}>
        <div className={`flex-1 flex flex-col ${isBattle ? "" : transitionClass}`}>
          <Outlet context={{ introMode }} />
        </div>
      </div>

      {/* Bottom navigation bar - hidden during battle */}
      {!isBattle && <div className={`relative z-10 px-2 pb-3 pt-1 ${introMode ? "intro-slide-up" : ""}`}>
        <div className="glass-panel flex items-end justify-around py-2 px-1">
          {bottomNav.map((item) => {
            const isPrimary = item.primary;
            const active = isActive(item.path);
            const needsAuth = !isPrimary && item.path !== "/";
            const handleClick = () => {
              if (needsAuth && !requireAuth(user, navigate, item.path)) return;
              navigateTo(item.path);
            };
            return (
              <button
                key={item.label}
                onClick={handleClick}
                data-nav={item.label}
                className={`flex flex-col items-center gap-1 px-2 py-1 transition-all ${
                  isPrimary ? "relative -mt-6" : active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {isPrimary ? (
                  <div className="flex flex-col items-center">
                    <div className={`h-14 w-14 rounded-full bg-primary flex items-center justify-center shadow-[0_0_20px_hsl(var(--primary)/0.4)] hover:shadow-[0_0_30px_hsl(var(--primary)/0.6)] transition-shadow ${active ? "ring-2 ring-primary/50" : ""}`}>
                      <item.icon className="h-7 w-7 text-primary-foreground" />
                    </div>
                    <span className="font-display text-[9px] tracking-wider text-primary mt-1">{item.label}</span>
                  </div>
                ) : (
                  <>
                    <item.icon className="h-5 w-5" />
                    <span className={`font-display text-[9px] tracking-wider ${active ? "text-primary" : ""}`}>{item.label}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>}

    </div>
  );
};

export default GameLayout;
