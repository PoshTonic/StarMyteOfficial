import { STAR_CONFIG, StarRarity } from "@/game/constants";

interface StarOrbProps {
  rarity: StarRarity;
  size?: number;
  className?: string;
  selected?: boolean;
  glowing?: boolean;
}

const StarOrb = ({ rarity, size = 40, className = "", selected = false, glowing = false }: StarOrbProps) => {
  const config = STAR_CONFIG[rarity];
  const glowSize = Math.round(size * 0.35);
  const glowSizeLarge = glowSize + 6;

  return (
    <div
      className={`rounded-full shrink-0 ${glowing ? "star-merge-glow" : ""} ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 35% 35%, white 0%, ${config.glowColor} 30%, ${config.color} 70%, transparent 100%)`,
        boxShadow: `0 0 ${selected ? glowSizeLarge : glowSize}px ${config.color}, 0 0 ${selected ? glowSizeLarge + 4 : glowSize + 2}px ${config.color}40`,
        animation: glowing ? undefined : "orbFlicker 1.2s ease-in-out infinite",
        border: selected ? "2px solid white" : "none",
        transform: selected ? "scale(1.15)" : undefined,
        transition: "transform 0.15s, border 0.15s",
        ["--glow-color" as any]: config.color,
        ["--glow-color-light" as any]: config.glowColor,
      }}
    />
  );
};

export default StarOrb;
