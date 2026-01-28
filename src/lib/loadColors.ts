/**
 * Load Colors - The Sacred Array
 *
 * Default color palette for load groups. These colors are used throughout
 * the app for load visualization, including the fog of war map.
 *
 * Colors cycle when there are more loads than colors.
 */

export const loadColors = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
] as const;

/**
 * Get color for a load by index
 * Cycles through loadColors array if index exceeds length
 */
export function getLoadColor(index: number): string {
  return loadColors[index % loadColors.length];
}

/**
 * Get color for a load by its sub_inventory name
 * Generates consistent color for the same load name within a session
 */
export function getLoadColorByName(loadNames: string[], loadName: string | null | undefined): string {
  if (!loadName) return '#94a3b8'; // slate-400 for unassigned

  const index = loadNames.indexOf(loadName);
  if (index === -1) return '#94a3b8';

  return getLoadColor(index);
}

/**
 * Build a map of load names to colors for efficient lookup
 */
export function buildLoadColorMap(loadNames: string[]): Map<string, string> {
  const colorMap = new Map<string, string>();

  loadNames.forEach((name, index) => {
    colorMap.set(name, getLoadColor(index));
  });

  return colorMap;
}
