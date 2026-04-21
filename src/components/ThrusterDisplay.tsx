import thrusterSvgRaw from "@/assets/Thruster_Thumbnail.svg?raw";
import { applySkinToSVG, SkinColourMap } from "@/game/skinUtils";

interface Props {
  className?: string;
  skinColours?: SkinColourMap;
}

/**
 * Renders the thruster thumbnail SVG with animated flame pulse.
 * Splits into Body-Thruster (static) and Flame-Thruster (animated with flamePulse).
 * Optionally applies skin colours to Colour_x5F_5 and Colour_x5F_6.
 */
const ThrusterDisplay = ({ className = "h-32 w-32", skinColours }: Props) => {
  let svgContent = thrusterSvgRaw;

  if (skinColours) {
    svgContent = applySkinToSVG(svgContent, skinColours);
  }

  // Extract inner content of specific groups
  const extractGroup = (svg: string, groupId: string): string => {
    const regex = new RegExp(`<g\\s+id="${groupId}"[^>]*>([\\s\\S]*?)</g>`, "m");
    const match = svg.match(regex);
    return match ? match[0] : "";
  };

  const flameGroup = extractGroup(svgContent, "Flame-Thruster");
  const bodyGroup = extractGroup(svgContent, "Body-Thruster");

  return (
    <svg viewBox="0 0 150 150" className={className}>
      {/* Flame layer with pulse animation — origin at top of flame (nozzle) */}
      <g
        className="animate-[flamePulse_0.4s_ease-in-out_infinite]"
        style={{ transformOrigin: "center top" }}
        dangerouslySetInnerHTML={{ __html: flameGroup }}
      />
      {/* Static thruster body */}
      <g dangerouslySetInnerHTML={{ __html: bodyGroup }} />
    </svg>
  );
};

export default ThrusterDisplay;
