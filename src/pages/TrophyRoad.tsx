import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SeasonLadder } from "@/components/SeasonLadder";
import { VipDialog } from "@/components/VipDialog";

const TrophyRoad = () => {
  const { user } = useAuth();
  const [trophies, setTrophies] = useState(0);
  const [vipOpen, setVipOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("trophies")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setTrophies(data.trophies);
      });
  }, [user]);

  return (
    <div className="px-4 py-4 flex-1 overflow-y-auto">
      <div className="max-w-lg mx-auto">
        <SeasonLadder
          seasonType="trophy_road"
          playerValue={trophies}
          valueLabel="Trophies"
          accentColor="text-blue-400"
          onVipClick={() => setVipOpen(true)}
        />
      </div>
      <VipDialog open={vipOpen} onOpenChange={setVipOpen} />
    </div>
  );
};

export default TrophyRoad;
