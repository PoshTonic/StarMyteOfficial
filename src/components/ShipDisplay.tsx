import { getShipSVGData } from "@/game/shipAssets";
import { applySkinToSVG, SkinColourMap } from "@/game/skinUtils";

interface Props {
  shipName: string;
  className?: string;
  skinColours?: SkinColourMap;
  jetSkinColours?: SkinColourMap;
}

/**
 * Renders a ship SVG with pulsing flame animation.
 * Uses dangerouslySetInnerHTML to inject the hull/flames SVG paths.
 * Optionally applies skin colours to the SVG layers.
 */
const ShipDisplay = ({ shipName, className = "h-32 w-32", skinColours, jetSkinColours }: Props) => {
  const data = getShipSVGData(shipName);

  // Extract inner content from the SVG strings (strip the outer <svg> tags)
  const extractInner = (svg: string) => {
    const match = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
    return match ? match[1] : "";
  };

  let hull = data.hull;
  let flames = data.flames;

  if (skinColours) {
    hull = applySkinToSVG(hull, skinColours);
  }
  // Jet skin applies to flames; fall back to ship skin if no jet skin
  const flameSkin = jetSkinColours || skinColours;
  if (flameSkin) {
    flames = applySkinToSVG(flames, flameSkin);
  }

  const hullInner = extractInner(hull);
  const flamesInner = extractInner(flames);

  return (
    <svg viewBox="0 0 250 250" className={className}>
      {/* Flames layer with pulse animation */}
      <g
        className="animate-[flamePulse_0.4s_ease-in-out_infinite]"
        style={{ transformOrigin: "center center" }}
        dangerouslySetInnerHTML={{ __html: flamesInner }}
      />
      {/* Hull layer */}
      <g dangerouslySetInnerHTML={{ __html: hullInner }} />
    </svg>
  );
};

export default ShipDisplay;
