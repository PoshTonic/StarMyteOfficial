import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SeasonLadder } from "@/components/SeasonLadder";
import { VipDialog } from "@/components/VipDialog";

const BattlePass = () => {
  const { user } = useAuth();
  const [level, setLevel] = useState(1);
  const [vipOpen, setVipOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("level")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setLevel(data.level);
      });
  }, [user]);

  return (
    <div className="px-4 py-4 flex-1 overflow-y-auto">
      <div className="max-w-lg mx-auto">
        <SeasonLadder
          seasonType="battle_pass"
          playerValue={level}
          valueLabel="Level"
          accentColor="text-purple-400"
          onVipClick={() => setVipOpen(true)}
        />
      </div>
      <VipDialog open={vipOpen} onOpenChange={setVipOpen} />
    </div>
  );
};

export default BattlePass;
