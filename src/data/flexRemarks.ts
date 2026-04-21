export interface ShipStats {
  battles_fought: number;
  pvp_wins: number;
  pvp_losses: number;
  enemies_defeated: number;
  asteroids_destroyed: number;
  bosses_defeated: number;
  distance_flown: number;
}

export interface FlexRemark {
  stat: keyof ShipStats;
  threshold: number;
  label: string;
  remark: string;
}

// Sorted by threshold descending within each stat category
// The system picks the highest qualifying remark across ALL stats
export const FLEX_REMARKS: FlexRemark[] = [
  // Distance Flown (km = seconds played)
  { stat: "distance_flown", threshold: 1_000_000, label: "Distance Flown", remark: "You've exceeded the distance from Earth to the Moon — and back... twice! 🌙" },
  { stat: "distance_flown", threshold: 384_400, label: "Distance Flown", remark: "You've flown to the Moon! Houston, we have a legend. 🚀" },
  { stat: "distance_flown", threshold: 100_000, label: "Distance Flown", remark: "That's further than the circumference of Earth! 🌍" },
  { stat: "distance_flown", threshold: 42_195, label: "Distance Flown", remark: "You've flown a cosmic marathon. Pheidippides would be proud. 🏃" },
  { stat: "distance_flown", threshold: 10_000, label: "Distance Flown", remark: "10,000km — that's like flying from London to Sydney! ✈️" },
  { stat: "distance_flown", threshold: 1_000, label: "Distance Flown", remark: "A thousand kilometres and counting. The stars are calling. ⭐" },
  { stat: "distance_flown", threshold: 100, label: "Distance Flown", remark: "First 100km logged. Every journey starts with a single thruster burn. 🔥" },

  // Enemies Defeated (PvP)
  { stat: "enemies_defeated", threshold: 10_000, label: "Enemies Defeated", remark: "10,000 pilots vanquished. You're basically Thanos with a spaceship. 💀" },
  { stat: "enemies_defeated", threshold: 3_333, label: "Enemies Defeated", remark: "300 Spartans once stood against a million Persians. If you were there, they'd have won! ⚔️" },
  { stat: "enemies_defeated", threshold: 1_000, label: "Enemies Defeated", remark: "A thousand foes felled. They write legends about pilots like you. 📜" },
  { stat: "enemies_defeated", threshold: 300, label: "Enemies Defeated", remark: "King Leonidas would recruit you in a heartbeat. 🛡️" },
  { stat: "enemies_defeated", threshold: 100, label: "Enemies Defeated", remark: "Triple digits! You're officially a menace. 💯" },
  { stat: "enemies_defeated", threshold: 50, label: "Enemies Defeated", remark: "50 enemies down. The galaxy is starting to take notice. 👀" },
  { stat: "enemies_defeated", threshold: 10, label: "Enemies Defeated", remark: "First double digits. You're no longer a rookie. 🎯" },

  // Battles Fought
  { stat: "battles_fought", threshold: 5_000, label: "Battles Fought", remark: "5,000 battles. At this point, war is just your day job. 💼" },
  { stat: "battles_fought", threshold: 1_000, label: "Battles Fought", remark: "A true veteran of the cosmos. Battle-hardened and still flying. 🏅" },
  { stat: "battles_fought", threshold: 500, label: "Battles Fought", remark: "500 sorties completed. You eat danger for breakfast. 🥣" },
  { stat: "battles_fought", threshold: 100, label: "Battles Fought", remark: "Century mark! Most pilots don't make it past 50. 💪" },
  { stat: "battles_fought", threshold: 25, label: "Battles Fought", remark: "25 battles in the books. You're finding your groove. 📖" },
  { stat: "battles_fought", threshold: 5, label: "Battles Fought", remark: "First handful of battles. The adventure begins! 🌟" },

  // Asteroids Destroyed
  { stat: "asteroids_destroyed", threshold: 50_000, label: "Asteroids Destroyed", remark: "50,000 space rocks pulverised. The asteroid belt filed a restraining order. 🪨" },
  { stat: "asteroids_destroyed", threshold: 10_000, label: "Asteroids Destroyed", remark: "The asteroid belt fears you. NASA wants your number. 📞" },
  { stat: "asteroids_destroyed", threshold: 5_000, label: "Asteroids Destroyed", remark: "5,000 asteroids turned to dust. You're a walking extinction event. ☄️" },
  { stat: "asteroids_destroyed", threshold: 1_000, label: "Asteroids Destroyed", remark: "A thousand rocks shattered. The dinosaurs wish you'd been around. 🦖" },
  { stat: "asteroids_destroyed", threshold: 100, label: "Asteroids Destroyed", remark: "100 asteroids smashed. Earth sleeps safer tonight. 🌎" },
  { stat: "asteroids_destroyed", threshold: 10, label: "Asteroids Destroyed", remark: "First ten asteroids down. Keep blasting! 💥" },

  // Bosses Defeated
  { stat: "bosses_defeated", threshold: 100, label: "Bosses Defeated", remark: "100 bosses toppled. You don't fight bosses — bosses fight you. 👑" },
  { stat: "bosses_defeated", threshold: 50, label: "Bosses Defeated", remark: "Boss Hunter extraordinaire. They tremble at your approach. 😱" },
  { stat: "bosses_defeated", threshold: 25, label: "Bosses Defeated", remark: "25 bosses beaten. That's a whole rogues' gallery. 🎭" },
  { stat: "bosses_defeated", threshold: 10, label: "Bosses Defeated", remark: "Double-digit boss kills. You've got a talent for toppling titans. 🗡️" },
  { stat: "bosses_defeated", threshold: 1, label: "Bosses Defeated", remark: "First boss defeated! The journey of a thousand victories begins. 🏆" },

  // PvP Wins
  { stat: "pvp_wins", threshold: 1_000, label: "PvP Wins", remark: "1,000 PvP victories. You're the final boss now. 🎮" },
  { stat: "pvp_wins", threshold: 500, label: "PvP Wins", remark: "500 wins. Other pilots check for your name before queuing. 😰" },
  { stat: "pvp_wins", threshold: 100, label: "PvP Wins", remark: "Triple-digit domination. The leaderboard knows your name. 📊" },
  { stat: "pvp_wins", threshold: 50, label: "PvP Wins", remark: "50 PvP wins! You're building a reputation out there. 🌟" },
  { stat: "pvp_wins", threshold: 10, label: "PvP Wins", remark: "10 PvP victories. Competitive spirit unlocked! 🔓" },
];

/**
 * Find the best "flex" for a given set of ship stats.
 * Returns the remark for the stat where the player has achieved the highest
 * threshold relative to the available milestones.
 */
export function getBestFlex(stats: ShipStats): FlexRemark | null {
  let bestRemark: FlexRemark | null = null;
  let bestScore = -1;

  // Group remarks by stat, sorted desc by threshold
  const statGroups = new Map<keyof ShipStats, FlexRemark[]>();
  for (const r of FLEX_REMARKS) {
    if (!statGroups.has(r.stat)) statGroups.set(r.stat, []);
    statGroups.get(r.stat)!.push(r);
  }

  for (const [stat, remarks] of statGroups) {
    const value = stats[stat];
    // Find highest qualifying remark (remarks are already sorted desc by threshold in the array)
    for (const r of remarks) {
      if (value >= r.threshold) {
        // Score = how many thresholds in this category the player has passed
        const rank = remarks.filter(rr => value >= rr.threshold).length;
        if (rank > bestScore) {
          bestScore = rank;
          bestRemark = r;
        }
        break;
      }
    }
  }

  return bestRemark;
}
