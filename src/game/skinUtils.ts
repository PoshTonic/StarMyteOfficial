/**
 * Skin colour replacement utility.
 * Replaces fill attributes on elements with Colour_x5F_N IDs in SVG strings.
 */

export type SkinColourMap = Record<string, string>;

/**
 * Apply a skin colour map to an SVG string.
 * Matches elements with id="Colour_x5F_N" (or data-name="Colour_x5F_N") and replaces their fill.
 * The colour map keys are "1", "2", etc. corresponding to Colour_x5F_1, Colour_x5F_2, etc.
 */
export function applySkinToSVG(svgString: string, colourMap: SkinColourMap): string {
  let result = svgString;
  
  for (const [key, color] of Object.entries(colourMap)) {
    // Match elements with id="Colour_x5F_N" (exact or with numeric suffix like Colour_x5F_11)
    // Replace their fill attribute value
    const idPattern = new RegExp(
      `(id="Colour_x5F_${key}[0-9]*"[^>]*?)fill="[^"]*"`,
      'g'
    );
    result = result.replace(idPattern, `$1fill="${color}"`);

    // Also match data-name="Colour_x5F_N"
    const dataNamePattern = new RegExp(
      `(data-name="Colour_x5F_${key}"[^>]*?)fill="[^"]*"`,
      'g'
    );
    result = result.replace(dataNamePattern, `$1fill="${color}"`);

    // Handle nested case: <g id="Colour_x5F_N">...<path fill="..."/>...</g>
    // When the id is on a <g> element, replace fill on all child elements within that group
    const groupPattern = new RegExp(
      `(<g[^>]*\\bid="Colour_x5F_${key}"[^>]*>)([\\s\\S]*?)(</g>)`,
      'g'
    );
    result = result.replace(groupPattern, (_match, open, inner, close) => {
      const updatedInner = inner.replace(/fill="[^"]*"/g, `fill="${color}"`);
      return open + updatedInner + close;
    });

    // Same for data-name on <g> elements
    const groupDataNamePattern = new RegExp(
      `(<g[^>]*\\bdata-name="Colour_x5F_${key}"[^>]*>)([\\s\\S]*?)(</g>)`,
      'g'
    );
    result = result.replace(groupDataNamePattern, (_match, open, inner, close) => {
      const updatedInner = inner.replace(/fill="[^"]*"/g, `fill="${color}"`);
      return open + updatedInner + close;
    });
  }
  
  return result;
}

/**
 * Default colour maps per ship (the base SVG colours).
 */
export const DEFAULT_COLOURS: Record<string, SkinColourMap> = {
  AX15: {
    "1": "#f4f4f4",
    "2": "#d6d6d6",
    "3": "#fff",
    "4": "#00f9ff",
    "5": "#0086ff",
    "6": "aqua",
  },
  KARQQ: {
    "1": "#f4f4f4",
    "2": "#d6d6d6",
    "3": "#fff",
    "4": "#00f9ff",
    "5": "#0086ff",
    "6": "aqua",
  },
  SCORJ: {
    "1": "#f4f4f4",
    "2": "#d6d6d6",
    "3": "#fff",
    "4": "#00f9ff",
    "5": "#0086ff",
    "6": "aqua",
  },
  STNGRY: {
    "1": "#f4f4f4",
    "2": "#b2b2b2",
    "3": "#fff",
    "4": "#00f9ff",
    "5": "#0086ff",
    "6": "aqua",
  },
  BERTH4: {
    "1": "#f4f4f4",
    "2": "#d6d6d6",
    "3": "#fff",
    "4": "#00f9ff",
    "5": "#0086ff",
    "6": "aqua",
  },
  "QUR-I": {
    "1": "#f4f4f4",
    "2": "#d6d6d6",
    "3": "#fff",
    "4": "#00f9ff",
    "5": "#0086ff",
    "6": "aqua",
  },
  ZZ11: {
    "1": "#f4f4f4",
    "2": "#d6d6d6",
    "3": "#fff",
    "4": "#00f9ff",
    "5": "#0086ff",
    "6": "aqua",
  },
  WEGE: {
    "1": "#f4f4f4",
    "2": "#d6d6d6",
    "3": "#fff",
    "4": "#00f9ff",
    "5": "#0086ff",
    "6": "aqua",
  },
};
