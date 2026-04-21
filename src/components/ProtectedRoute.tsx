import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import SplashGate from "@/components/SplashGate";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="font-display text-primary animate-pulse tracking-wider">LOADING...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return <SplashGate>{children}</SplashGate>;
};

export default ProtectedRoute;
