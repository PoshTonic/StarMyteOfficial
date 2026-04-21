import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { MusicProvider } from "@/contexts/MusicContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import GameLayout from "@/components/GameLayout";
import SplashGate from "@/components/SplashGate";
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import VerifyEmail from "@/pages/VerifyEmail";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import MainMenu from "@/pages/MainMenu";
import Battle from "@/pages/Battle";
import Hangar from "@/pages/Hangar";
import Store from "@/pages/Store";
import Profile from "@/pages/Profile";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminShips from "@/pages/admin/Ships";
import AdminWeapons from "@/pages/admin/Weapons";
import AdminPilots from "@/pages/admin/Pilots";
import AdminPilotDetail from "@/pages/admin/PilotDetail";
import AdminAnalytics from "@/pages/admin/Analytics";
import AdminAvatars from "@/pages/admin/Avatars";
import AdminSkins from "@/pages/admin/Skins";
import AdminInfinityRewards from "@/pages/admin/InfinityRewards";
import AdminPrizing from "@/pages/admin/Prizing";
import AdminEmotes from "@/pages/admin/Emotes";
import Ladder from "@/pages/Ladder";
import TrophyRoad from "@/pages/TrophyRoad";
import BattlePass from "@/pages/BattlePass";
import DailyLogin from "@/pages/DailyLogin";
import Quests from "@/pages/Quests";
import Unsubscribe from "@/pages/Unsubscribe";
import Links from "@/pages/Links";
import Install from "@/pages/Install";
import Faq from "@/pages/Faq";
import Tips from "@/pages/Tips";
import InAppBrowserOverlay from "@/components/InAppBrowserOverlay";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <MusicProvider>
            <InAppBrowserOverlay />
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/unsubscribe" element={<Unsubscribe />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/links" element={<Links />} />
              <Route path="/install" element={<Install />} />
              <Route path="/faq" element={<Faq />} />
              <Route path="/tips" element={<Tips />} />
              {/* Public game shell — splash + homepage + practice are open to guests for SEO + funnel */}
              <Route element={<SplashGate><GameLayout /></SplashGate>}>
                <Route path="/" element={<MainMenu />} />
                <Route path="/battle" element={<Battle />} />
              </Route>
              {/* Authenticated-only routes */}
              <Route element={<ProtectedRoute><GameLayout /></ProtectedRoute>}>
                <Route path="/store" element={<Store />} />
                <Route path="/hangar" element={<Hangar />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/ladder" element={<Ladder />} />
                <Route path="/infinity-ladder" element={<Ladder />} />
                <Route path="/trophy-road" element={<TrophyRoad />} />
                <Route path="/battle-pass" element={<BattlePass />} />
                <Route path="/daily-login" element={<DailyLogin />} />
                <Route path="/quests" element={<Quests />} />
              </Route>
              <Route path="/admin" element={<ProtectedRoute><AdminRoute><AdminDashboard /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/ships" element={<ProtectedRoute><AdminRoute><AdminShips /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/weapons" element={<ProtectedRoute><AdminRoute><AdminWeapons /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/pilots" element={<ProtectedRoute><AdminRoute><AdminPilots /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/pilots/:id" element={<ProtectedRoute><AdminRoute><AdminPilotDetail /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/analytics" element={<ProtectedRoute><AdminRoute><AdminAnalytics /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/avatars" element={<ProtectedRoute><AdminRoute><AdminAvatars /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/skins" element={<ProtectedRoute><AdminRoute><AdminSkins /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/infinity-rewards" element={<ProtectedRoute><AdminRoute><AdminInfinityRewards /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/prizing" element={<ProtectedRoute><AdminRoute><AdminPrizing /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/emotes" element={<ProtectedRoute><AdminRoute><AdminEmotes /></AdminRoute></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </MusicProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
