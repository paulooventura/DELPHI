/**
 * Built-in world map for the Earth level when the tile server can't be reached (T341):
 * Natural Earth land, land borders and major cities, shipped in public/earth/offline/
 * (scripts/build-offline-map.mjs). The GeoJSON is fetched here and inlined, so MapLibre's
 * worker never has to reach the app's own URL scheme.
 *
 * EarthMap paints and anchors on a fill layer called "water", so this style keeps one.
 * Glyphs stay on OpenFreeMap: text layers validate, and offline they just draw no labels.
 */
import type { StyleSpecification } from "maplibre-gl";

export const OFFLINE_MAP_FILES = ["land", "borders", "cities"] as const;
const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";

type FC = { type: "FeatureCollection"; features: unknown[] };

const OCEAN: FC = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]] },
    },
  ],
};

export function offlineMapStyle(data: { land: FC; borders: FC; cities: FC }): StyleSpecification {
  return {
    version: 8,
    name: "Pneuma offline world",
    glyphs: GLYPHS,
    sources: {
      ocean: { type: "geojson", data: OCEAN as never },
      land: { type: "geojson", data: data.land as never },
      borders: { type: "geojson", data: data.borders as never },
      cities: { type: "geojson", data: data.cities as never },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#04060b" } },
      { id: "water", type: "fill", source: "ocean", paint: { "fill-color": "rgb(8, 22, 52)", "fill-opacity": 0.55 } },
      { id: "land", type: "fill", source: "land", paint: { "fill-color": "#161a22" } },
      { id: "coast", type: "line", source: "land", paint: { "line-color": "rgba(170, 185, 210, 0.35)", "line-width": 0.6 } },
      {
        id: "borders",
        type: "line",
        source: "borders",
        paint: { "line-color": "rgba(170, 185, 210, 0.28)", "line-width": 0.5, "line-dasharray": [2, 2] },
      },
      {
        id: "cities",
        type: "circle",
        source: "cities",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 1.2, 6, 3],
          "circle-color": "rgba(235, 228, 210, 0.75)",
        },
      },
    ],
  };
}

/** Fetches the bundled files and builds the style; null if any file is missing. */
export async function loadOfflineMapStyle(): Promise<StyleSpecification | null> {
  try {
    const [land, borders, cities] = await Promise.all(
      OFFLINE_MAP_FILES.map(f => fetch(`/earth/offline/${f}.json`).then(r => (r.ok ? (r.json() as Promise<FC>) : Promise.reject(r.status)))),
    );
    return offlineMapStyle({ land: land!, borders: borders!, cities: cities! });
  } catch {
    return null;
  }
}
