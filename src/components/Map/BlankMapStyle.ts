/**
 * Blank MapLibre style - no tiles, just a canvas for markers
 * Theme-aware background colors
 */

import type { StyleSpecification } from 'maplibre-gl';

export const blankMapStyle = (isDark: boolean): StyleSpecification => ({
  version: 8,
  name: 'Blank Canvas',
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': isDark ? '#0f172a' : '#ffffff', // slate-900 : white
      },
    },
  ],
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
});
