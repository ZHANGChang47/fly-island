import { glassTintAlpha, hexToRgba } from "../../features/appearance/settings";
import type { ColorPalette } from "../../features/appearance/colorPalette";
import type { IslandSettings } from "../../features/appearance/types";

/**
 * The glass materials' variables (IslandGlass.css). All are CSS only: the island window is a
 * transparent stage much larger than the island, so a native blur would blur the whole stage.
 * Liquid and light glass are clear panes whose look is mostly the lit rim; frosted glass is a
 * milky or smoky pane that hides what is behind it. Light glass keeps the lit edges but trades
 * the dark inner hairline for a cyan one and casts a softer, wider shadow (direction four).
 * The strength setting makes clear glass clearer with brighter edges, frosted glass a little
 * clearer. The aurora ambience is drawn in CSS only, from `auroraAura` via IslandShell's class.
 */
export function getGlassStyle(settings: IslandSettings, colors: ColorPalette) {
  const strength = settings.glassIntensity / 100;
  const opacity = settings.opacity / 100;
  const clear = settings.material === "liquidGlass" || settings.material === "lightGlass";
  const light = settings.material === "lightGlass";
  const tint = hexToRgba(colors.islandBackgroundColor, opacity * glassTintAlpha(settings.material, settings.glassIntensity));
  return {
    "--glass-intensity": strength,
    "--glass-tint-color": tint,
    "--glass-collapsed-tint-color": tint,
    "--glass-shadow-alpha": light ? 0.18 + strength * 0.12 : 0.14 + strength * 0.1,
    "--glass-sheen-alpha": clear ? 0.06 + strength * 0.1 : 0.05,
    "--glass-border-alpha": clear ? 0.22 + strength * 0.3 : 0.14 + strength * 0.08,
    "--glass-inset-alpha": clear ? 0.3 + strength * 0.4 : 0.22 + strength * 0.12,
    "--glass-inner-glow-alpha": clear ? 0.05 + strength * 0.1 : 0,
    "--glass-inner-line-alpha": light ? 0.14 + strength * 0.08 : 0.12,
    "--glass-glow-alpha": clear ? 0.08 + strength * 0.1 : 0.03,
    "--glass-accent-alpha": strength * 0.08,
    "--glass-page-accent": light ? "0, 113, 184" : "116, 214, 255",
    "--glass-highlight-opacity": clear ? 0.34 + strength * 0.5 : 0,
    "--glass-grain-opacity": clear ? 0.05 + strength * 0.03 : 0.035,
    "--glass-panel-accent-alpha": strength * 0.085,
  };
}
