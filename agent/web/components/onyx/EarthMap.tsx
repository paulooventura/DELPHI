"use client";

/**
 * The orrery's deepest Earth level: a MapLibre world map (globe projection, OpenFreeMap tiles)
 * with live aircraft (adsb.lol via our own cached route), the named satellites' ground tracks
 * and footprints, GEBCO seafloor relief and NOAA charted wrecks. Loaded only when opened.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MlMap, type MapGeoJSONFeature } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  cellKey,
  cellsForView,
  deadReckon,
  altitudeLabel,
  haversineKm,
  routeCheck,
  type AcRow,
  type AircraftCell,
  type FlightRoute,
} from "../../lib/aircraft";
import { NIGHT_STEPS, fmtSolarTime, lightAt, nightBands, solarTimeHours, sunElevation } from "../../lib/daynight";
import { ORBIT_CLASS_LABEL, RE_KM, measureSat, rowToOmm, temeToGeodetic, type GpRow } from "../../lib/orbits";
import { json2satrec, propagate, type SatRec } from "../../lib/sgp4";

export type MapSat = { name: string; row: GpRow };

type LayerId = "daynight" | "aircraft" | "satellites" | "seafloor" | "wrecks";
const LAYERS: Array<{ id: LayerId; label: string }> = [
  { id: "daynight", label: "Day & night" },
  { id: "aircraft", label: "Aircraft" },
  { id: "satellites", label: "Satellites" },
  { id: "seafloor", label: "Seafloor" },
  { id: "wrecks", label: "Wrecks" },
];

type Plane = { row: AcRow; at: number; seen: number; trail: Array<[number, number, number]> };
type Sel = { kind: "plane"; hex: string } | { kind: "sat"; norad: number } | { kind: "wreck"; i: number } | { kind: "sun" };
/** Each night step's fill; stacked over every step, deep night ≈ 0.62. */
const NIGHT_STEP_OPACITY = 1 - Math.pow(0.38, 1 / NIGHT_STEPS.length);
const NIGHT_EVERY_MS = 60_000;
type WreckSet = { fetchedAt: string; source: string; cats: string[]; rows: Array<[number, number, number, number | null, number | null, string, number | null]> };
/** [label, value, dimmed]: dimmed rows are shown greyed as unsure. */
type CardRow = [string, string, boolean?];
type Card = { title: string; sub: string; rows: CardRow[] };

const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const ODBL = "https://opendatacommons.org/licenses/odbl/1-0/";
const POLL_MS = 10_000;
/** Below this zoom a view spans too many cells to poll politely. */
const AIRCRAFT_MIN_ZOOM = 4.2;
const CLOSE_ZOOM = 1.25;
const TRAIL_MAX = 60;
const TRAIL_AGE_MS = 15 * 60_000;
const DROP_AFTER_MS = 75_000;
const FONT = ["Noto Sans Regular"];

const CATEGORY: Record<string, string> = {
  A1: "Light aircraft",
  A2: "Small aircraft",
  A3: "Large aircraft",
  A4: "Large, high wake (757)",
  A5: "Heavy aircraft",
  A6: "High performance",
  A7: "Helicopter",
  B1: "Glider",
  B2: "Balloon or airship",
  B3: "Parachutist",
  B4: "Ultralight",
  B6: "Drone",
  B7: "Space vehicle",
  C1: "Emergency vehicle",
  C2: "Service vehicle",
  C3: "Ground obstacle",
};
const WATLEV = ["", "partly submerged", "always dry", "always under water", "covers and uncovers", "awash", "subject to flooding", "floating"];

const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");
const fmtKm = (km: number) => (km < 10 ? `${km.toFixed(1)} km` : `${fmtInt(km)} km`);
const unwrap = (lons: number[]) => {
  for (let i = 1; i < lons.length; i++) {
    while (lons[i]! - lons[i - 1]! > 180) lons[i]! -= 360;
    while (lons[i]! - lons[i - 1]! < -180) lons[i]! += 360;
  }
  return lons;
};

/** Plane silhouette for an SDF icon, drawn once (pointing up = north). */
function planeIcon(size: number): ImageData {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const s = size / 32;
  g.fillStyle = "#fff";
  g.beginPath();
  const pts = [
    [16, 2], [18, 5], [18, 12], [29, 18], [29, 21], [18, 17.5], [18, 25], [22, 28], [22, 30], [16, 28.5],
    [10, 30], [10, 28], [14, 25], [14, 17.5], [3, 21], [3, 18], [14, 12], [14, 5],
  ];
  pts.forEach(([x, y], k) => (k ? g.lineTo(x! * s, y! * s) : g.moveTo(x! * s, y! * s)));
  g.closePath();
  g.fill();
  return g.getImageData(0, 0, size, size);
}

function circle(lat: number, lon: number, radiusKm: number, n = 72): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const d = radiusKm / 6371.0088;
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  for (let k = 0; k <= n; k++) {
    const b = (2 * Math.PI * k) / n;
    const lat2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
    const lon2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(lat2));
    out.push([(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }
  const lons = unwrap(out.map(p => p[0]));
  return out.map((p, k) => [lons[k]!, p[1]]);
}

const fc = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features });

export default function EarthMap({
  center,
  sats,
  reduceMotion,
  onClose,
}: {
  center: [number, number];
  sats: MapSat[];
  reduceMotion: boolean;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const planesRef = useRef(new Map<string, Plane>());
  const satRecs = useRef<Array<{ name: string; row: GpRow; rec: SatRec | null }>>([]);
  const wrecksRef = useRef<WreckSet | null>(null);
  const userRef = useRef<{ lat: number; lon: number } | null>(null);
  const routesRef = useRef(new Map<string, FlightRoute | null | "loading">());
  const onCloseRef = useRef(onClose);
  const applyVisRef = useRef<() => void>(() => {});
  const drawRef = useRef<() => void>(() => {});
  const buildCardRef = useRef<(sel: Sel | null) => Card | null>(() => null);
  const [card, setCard] = useState<Card | null>(null);
  const [hasUser, setHasUser] = useState(false);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const subRef = useRef<{ lat: number; lon: number; distAu: number } | null>(null);
  const [layers, setLayers] = useState<Record<LayerId, boolean>>({ daynight: true, aircraft: true, satellites: true, seafloor: true, wrecks: true });
  const layersRef = useRef(layers);
  const [layersOpen, setLayersOpen] = useState(false);
  const [sel, setSel] = useState<Sel | null>(null);
  const selRef = useRef(sel);
  const [status, setStatus] = useState({ aircraft: 0, note: "", wrecks: 0, ready: false });
  useEffect(() => {
    selRef.current = sel;
  }, [sel]);

  const recs = useMemo(
    () =>
      sats.map(s => {
        let rec: SatRec | null = null;
        try {
          rec = json2satrec(rowToOmm(s.row) as Parameters<typeof json2satrec>[0]);
        } catch {
          rec = null;
        }
        return { ...s, rec };
      }),
    [sats],
  );
  useEffect(() => {
    satRecs.current = recs;
    drawRef.current();
  }, [recs]);

  /* Distance from the reader only if they already granted location; never asks, never sends. */
  useEffect(() => {
    let alive = true;
    const perms = (navigator as Navigator & { permissions?: Permissions }).permissions;
    perms
      ?.query({ name: "geolocation" as PermissionName })
      .then(p => {
        if (!alive || p.state !== "granted") return;
        navigator.geolocation.getCurrentPosition(
          pos => {
            if (!alive) return;
            userRef.current = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            setHasUser(true);
          },
          () => {},
          { maximumAge: 10 * 60_000, timeout: 8_000 },
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const box = boxRef.current;
    const root = rootRef.current;
    if (!box || !root) return;
    let alive = true;
    const map = new maplibregl.Map({
      container: box,
      style: STYLE_URL,
      center,
      zoom: 1.7,
      minZoom: 0.6,
      maxZoom: 15,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      renderWorldCopies: true,
      fadeDuration: reduceMotion ? 0 : 200,
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    mapRef.current = map;
    const openedAt = performance.now();

    const satPos = (rec: SatRec, t: Date) => {
      const pv = propagate(rec, t);
      const p = pv?.position;
      const v = pv?.velocity;
      if (!p || typeof p !== "object" || !v || typeof v !== "object") return null;
      return { p: p as { x: number; y: number; z: number }, v: v as { x: number; y: number; z: number } };
    };

    /* ── layers ── */
    const addLayers = () => {
      map.setProjection({ type: "globe" });
      const firstSymbol = map.getStyle().layers.find(l => l.type === "symbol")?.id;
      map.addSource("seafloor", {
        type: "raster",
        tiles: [`${location.origin}/api/seafloor/{z}/{x}/{y}`],
        tileSize: 256,
        maxzoom: 8,
        attribution: "GEBCO",
      });
      map.addLayer(
        {
          id: "seafloor",
          type: "raster",
          source: "seafloor",
          paint: { "raster-saturation": -0.85, "raster-brightness-max": 0.42, "raster-contrast": 0.18, "raster-opacity": 0.85 },
        },
        "water",
      );
      map.setPaintProperty("water", "fill-color", "rgb(8, 22, 52)");
      map.setPaintProperty("water", "fill-opacity", 0.55);

      const empty = fc([]);
      map.addSource("night", { type: "geojson", data: empty });
      map.addLayer(
        {
          id: "night",
          type: "fill",
          source: "night",
          paint: {
            "fill-color": "#01030c",
            "fill-opacity": NIGHT_STEP_OPACITY,
            "fill-antialias": false,
          },
        },
        firstSymbol,
      );
      map.addLayer(
        {
          id: "night-edge",
          type: "line",
          source: "night",
          filter: ["==", ["geometry-type"], "LineString"],
          paint: { "line-color": "#ffc978", "line-opacity": 0.4, "line-width": 1, "line-blur": 1.5 },
        },
        firstSymbol,
      );
      map.addSource("sun", { type: "geojson", data: empty });
      map.addLayer(
        {
          id: "sun-glow",
          type: "circle",
          source: "sun",
          paint: { "circle-radius": 15, "circle-color": "#ffd98a", "circle-opacity": 0.22, "circle-blur": 1 },
        },
        firstSymbol,
      );
      map.addLayer(
        {
          id: "sun",
          type: "circle",
          source: "sun",
          paint: { "circle-radius": 5, "circle-color": "#ffe9b0", "circle-stroke-color": "#ffbf5a", "circle-stroke-width": 1.2 },
        },
        firstSymbol,
      );
      updateNight();

      map.addSource("wrecks", { type: "geojson", data: empty });
      map.addLayer(
        {
          id: "wrecks",
          type: "circle",
          source: "wrecks",
          minzoom: 3.5,
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 1.4, 10, 3.5],
            "circle-color": ["match", ["get", "cat"], 0, "#e6a07a", "#8fb7b0"],
            "circle-opacity": 0.75,
            "circle-stroke-width": 0,
          },
        },
        firstSymbol,
      );
      map.addLayer({
        id: "wreck-names",
        type: "symbol",
        source: "wrecks",
        minzoom: 8,
        filter: ["!=", ["get", "name"], ""],
        layout: { "text-field": ["get", "name"], "text-font": FONT, "text-size": 9, "text-offset": [0, 0.9], "text-optional": true },
        paint: { "text-color": "#9fc5be", "text-halo-color": "#03040a", "text-halo-width": 1 },
      });

      map.addSource("sat-tracks", { type: "geojson", data: empty });
      map.addSource("sat-points", { type: "geojson", data: empty });
      map.addLayer({
        id: "sat-footprints",
        type: "fill",
        source: "sat-tracks",
        filter: ["==", ["get", "kind"], "footprint"],
        paint: { "fill-color": "#7dffc8", "fill-opacity": 0.05 },
      });
      map.addLayer({
        id: "sat-footprint-edge",
        type: "line",
        source: "sat-tracks",
        filter: ["==", ["get", "kind"], "footprint"],
        paint: { "line-color": "#7dffc8", "line-opacity": 0.35, "line-width": 0.8 },
      });
      map.addLayer({
        id: "sat-tracks",
        type: "line",
        source: "sat-tracks",
        filter: ["==", ["get", "kind"], "track"],
        paint: {
          "line-color": "#7dffc8",
          "line-width": ["case", ["get", "sel"], 1.6, 1],
          "line-opacity": ["case", ["get", "future"], 0.55, 0.22],
          "line-dasharray": [2, 2],
        },
      });
      map.addLayer({
        id: "sat-points",
        type: "circle",
        source: "sat-points",
        paint: { "circle-radius": 4.5, "circle-color": "#7dffc8", "circle-stroke-color": "#03040a", "circle-stroke-width": 1.2 },
      });
      map.addLayer({
        id: "sat-names",
        type: "symbol",
        source: "sat-points",
        layout: { "text-field": ["get", "name"], "text-font": FONT, "text-size": 11, "text-offset": [0, 1.1], "text-allow-overlap": true },
        paint: { "text-color": "#bfffe6", "text-halo-color": "#03040a", "text-halo-width": 1.2 },
      });

      map.addImage("plane", planeIcon(64), { sdf: true, pixelRatio: 2 });
      map.addSource("trails", { type: "geojson", data: empty });
      map.addSource("planes", { type: "geojson", data: empty });
      map.addLayer({
        id: "trails",
        type: "line",
        source: "trails",
        minzoom: 3,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["case", ["get", "sel"], "#ffd27a", "#9fb4ff"],
          "line-width": ["case", ["get", "sel"], 2.2, 1],
          "line-opacity": ["case", ["get", "sel"], 0.95, 0.35],
        },
      });
      map.addLayer({
        id: "planes",
        type: "symbol",
        source: "planes",
        layout: {
          "icon-image": "plane",
          "icon-size": ["interpolate", ["linear"], ["zoom"], 3, 0.42, 8, 0.62, 12, 0.8],
          "icon-rotate": ["get", "trk"],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "symbol-sort-key": ["get", "alt"],
        },
        paint: {
          "icon-color": [
            "case",
            ["get", "sel"],
            "#ffd27a",
            ["get", "mil"],
            "#ff9a8a",
            ["get", "gnd"],
            "#8a8f9a",
            ["interpolate", ["linear"], ["get", "alt"], 0, "#ffb86b", 10000, "#7fe3ff", 30000, "#c9c2ff", 45000, "#ffffff"],
          ],
          "icon-halo-color": "#03040a",
          "icon-halo-width": 0.6,
        },
      });
      map.addLayer({
        id: "plane-labels",
        type: "symbol",
        source: "planes",
        minzoom: 6.5,
        layout: {
          "text-field": ["get", "label"],
          "text-font": FONT,
          "text-size": 9.5,
          "text-offset": [0, 1.25],
          "text-anchor": "top",
          "text-optional": true,
        },
        paint: { "text-color": "#d9dcff", "text-halo-color": "#03040a", "text-halo-width": 1.1 },
      });
      map.addSource("you", { type: "geojson", data: empty });
      map.addLayer({
        id: "you",
        type: "circle",
        source: "you",
        paint: { "circle-radius": 4, "circle-color": "#ffffff", "circle-stroke-color": "#7a6cf0", "circle-stroke-width": 2 },
      });
      applyVisibility();
      setStatus(s => ({ ...s, ready: true }));
      root.dataset.ready = "1";
    };

    const applyVisibility = () => {
      if (!map.getLayer("planes")) return;
      const L = layersRef.current;
      const vis = (on: boolean) => (on ? "visible" : "none");
      for (const id of ["night", "night-edge", "sun-glow", "sun"]) map.setLayoutProperty(id, "visibility", vis(L.daynight));
      for (const id of ["planes", "plane-labels", "trails"]) map.setLayoutProperty(id, "visibility", vis(L.aircraft));
      for (const id of ["sat-footprints", "sat-footprint-edge", "sat-tracks", "sat-points", "sat-names"]) map.setLayoutProperty(id, "visibility", vis(L.satellites));
      map.setLayoutProperty("seafloor", "visibility", vis(L.seafloor));
      map.setPaintProperty("water", "fill-opacity", L.seafloor ? 0.55 : 1);
      for (const id of ["wrecks", "wreck-names"]) map.setLayoutProperty(id, "visibility", vis(L.wrecks));
      if (L.wrecks && !wrecksRef.current) loadWrecks();
    };
    applyVisRef.current = applyVisibility;

    /* ── day and night: the subsolar point and the twilight bands, once a minute ── */
    let nightTimer = 0;
    const updateNight = () => {
      window.clearTimeout(nightTimer);
      if (!alive) return;
      const { sub, features } = nightBands(new Date());
      subRef.current = sub;
      const edge = (features[0]!.geometry as GeoJSON.Polygon).coordinates[0]!.filter(p => Math.abs(p[1]!) < 90);
      (map.getSource("night") as GeoJSONSource | undefined)?.setData(
        fc([...features, { type: "Feature", geometry: { type: "LineString", coordinates: edge }, properties: { band: -1 } }]),
      );
      (map.getSource("sun") as GeoJSONSource | undefined)?.setData(
        fc([{ type: "Feature", geometry: { type: "Point", coordinates: [sub.lon, sub.lat] }, properties: {} }]),
      );
      root.dataset.subsolar = `${sub.lat.toFixed(2)},${sub.lon.toFixed(2)}`;
      nightTimer = window.setTimeout(updateNight, NIGHT_EVERY_MS);
    };

    const loadWrecks = () => {
      if (wrecksRef.current) return;
      wrecksRef.current = { fetchedAt: "", source: "", cats: [], rows: [] };
      fetch("/earth/wrecks.json")
        .then(r => r.json() as Promise<WreckSet>)
        .then(w => {
          if (!alive) return;
          wrecksRef.current = w;
          (map.getSource("wrecks") as GeoJSONSource | undefined)?.setData(
            fc(
              w.rows.map((r, i) => ({
                type: "Feature",
                id: i,
                geometry: { type: "Point", coordinates: [r[0], r[1]] },
                properties: { i, cat: r[2], name: r[5] },
              })),
            ),
          );
          root.dataset.wrecks = String(w.rows.length);
          setStatus(s => ({ ...s, wrecks: w.rows.length }));
        })
        .catch(() => {
          wrecksRef.current = null;
        });
    };

    /* ── aircraft polling: our route per cell, every ~10 s, only while visible and zoomed in ── */
    let pollTimer = 0;
    let polling = false;
    const poll = async () => {
      window.clearTimeout(pollTimer);
      pollTimer = 0;
      if (!alive || document.hidden) return;
      const z = map.getZoom();
      let cells: ReturnType<typeof cellsForView> = null;
      if (layersRef.current.aircraft && z >= AIRCRAFT_MIN_ZOOM) {
        const b = map.getBounds();
        cells = cellsForView(Math.max(-89.9, b.getSouth()), b.getWest(), Math.min(89.9, b.getNorth()), b.getEast());
      }
      if (!cells) {
        setStatus(s => ({ ...s, note: layersRef.current.aircraft ? "zoom in to see aircraft" : "" }));
        pollTimer = window.setTimeout(poll, POLL_MS);
        return;
      }
      if (polling) return;
      polling = true;
      const results = await Promise.allSettled(
        cells.map(c => fetch(`/api/aircraft?cell=${cellKey(c)}`).then(r => (r.ok ? (r.json() as Promise<AircraftCell>) : Promise.reject(r.status)))),
      );
      polling = false;
      if (!alive) return;
      const now = Date.now();
      let failed = 0;
      for (const res of results) {
        if (res.status !== "fulfilled") {
          failed++;
          continue;
        }
        const at = Math.min(now, res.value.at || now);
        for (const row of res.value.rows) {
          const p = planesRef.current.get(row[0]);
          const lastFix = p?.trail[p.trail.length - 1];
          if (!p) {
            planesRef.current.set(row[0], { row, at, seen: now, trail: [[row[5], row[4], at]] });
            continue;
          }
          p.row = row;
          p.at = at;
          p.seen = now;
          if (!lastFix || Math.abs(lastFix[0] - row[5]) + Math.abs(lastFix[1] - row[4]) > 0.0005) p.trail.push([row[5], row[4], at]);
          while (p.trail.length > TRAIL_MAX || (p.trail.length > 1 && now - p.trail[0]![2] > TRAIL_AGE_MS)) p.trail.shift();
        }
      }
      for (const [hex, p] of planesRef.current) if (now - p.seen > DROP_AFTER_MS && selRef.current?.kind !== "plane") planesRef.current.delete(hex);
      setStatus(s => ({ ...s, note: failed === results.length ? "aircraft feed unavailable, retrying" : "" }));
      root.dataset.cells = String(cells.length);
      draw();
      pollTimer = window.setTimeout(poll, POLL_MS);
    };
    let moveTimer = 0;
    const onMoveEnd = () => {
      window.clearTimeout(moveTimer);
      moveTimer = window.setTimeout(() => {
        if (!polling) poll();
      }, 450);
    };

    /* ── per-second redraw: dead-reckoned planes, trails, satellites ── */
    let trackAt = 0;
    let lastTracks: GeoJSON.Feature[] = [];
    const draw = () => {
      if (!alive || !map.getSource("planes")) return;
      const now = Date.now();
      const s = selRef.current;
      const b = map.getBounds();
      const planes: GeoJSON.Feature[] = [];
      const trails: GeoJSON.Feature[] = [];
      let inView = 0;
      let maxTrail = 0;
      const mid = { x: box.clientWidth / 2, y: box.clientHeight / 2 };
      let nearest: { d: number; x: number; y: number } | null = null;
      for (const [hex, p] of planesRef.current) {
        const r = p.row;
        const [lat, lon] = deadReckon(r[4], r[5], r[8], r[12] & 2 ? 0 : r[7], Math.min(90, (now - p.at) / 1000));
        const isSel = s?.kind === "plane" && s.hex === hex;
        if (b.contains([lon, lat])) {
          inView++;
          const q = map.project([lon, lat]);
          const d = Math.hypot(q.x - mid.x, q.y - mid.y);
          if (!(r[12] & 2) && (!nearest || d < nearest.d)) nearest = { d, x: q.x, y: q.y };
        }
        planes.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [lon, lat] },
          properties: {
            hex,
            trk: r[8] < 0 ? 0 : r[8],
            alt: r[6],
            gnd: !!(r[12] & 2),
            mil: !!(r[12] & 1),
            sel: isSel,
            label: r[1] || r[2] || "",
          },
        });
        if (p.trail.length) {
          const coords = p.trail.map(t => [t[0], t[1]]);
          coords.push([lon, lat]);
          const lons = unwrap(coords.map(c => c[0]!));
          maxTrail = Math.max(maxTrail, coords.length);
          trails.push({
            type: "Feature",
            geometry: { type: "LineString", coordinates: coords.map((c, k) => [lons[k]!, c[1]!]) },
            properties: { sel: isSel },
          });
        }
      }
      (map.getSource("planes") as GeoJSONSource).setData(fc(planes));
      (map.getSource("trails") as GeoJSONSource).setData(fc(trails));
      root.dataset.aircraft = String(inView);
      const np = nearest as { x: number; y: number } | null;
      root.dataset.planePx = np ? `${np.x.toFixed(1)},${np.y.toFixed(1)}` : "";
      root.dataset.aircraftAll = String(planesRef.current.size);
      root.dataset.trailMax = String(maxTrail);
      if (s?.kind === "plane") root.dataset.selTrail = String((planesRef.current.get(s.hex)?.trail.length ?? 0) + 1);

      const t = new Date(now);
      const points: GeoJSON.Feature[] = [];
      const recomputeTracks = now - trackAt > 20_000;
      const tracks: GeoJSON.Feature[] = [];
      for (const sat of satRecs.current) {
        if (!sat.rec) continue;
        const pv = satPos(sat.rec, t);
        if (!pv) continue;
        const g = temeToGeodetic(pv.p, t);
        const isSel = s?.kind === "sat" && s.norad === sat.row[0];
        if (sat.row[0] === 25544) {
          const q = map.project([g.lonDeg, g.latDeg]);
          root.dataset.issPx = `${q.x.toFixed(1)},${q.y.toFixed(1)}`;
        }
        points.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [g.lonDeg, g.latDeg] },
          properties: { norad: sat.row[0], name: sat.name, sel: isSel },
        });
        tracks.push({
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [circle(g.latDeg, g.lonDeg, RE_KM * Math.acos(RE_KM / (RE_KM + Math.max(0, g.altKm))))] },
          properties: { kind: "footprint", sel: isSel },
        });
        if (recomputeTracks) {
          const periodMs = (1440 / sat.row[4]) * 60_000;
          for (const [from, to, future] of [
            [-0.5, 0, false],
            [0, 1, true],
          ] as const) {
            const pts: Array<[number, number]> = [];
            for (let k = 0; k <= 90; k++) {
              const tt = new Date(now + periodMs * (from + ((to - from) * k) / 90));
              const q = satPos(sat.rec, tt);
              if (!q) continue;
              const gg = temeToGeodetic(q.p, tt);
              pts.push([gg.lonDeg, gg.latDeg]);
            }
            const lons = unwrap(pts.map(p => p[0]));
            tracks.push({
              type: "Feature",
              geometry: { type: "LineString", coordinates: pts.map((p, k) => [lons[k]!, p[1]]) },
              properties: { kind: "track", future, sel: isSel, norad: sat.row[0] },
            });
          }
        }
      }
      (map.getSource("sat-points") as GeoJSONSource).setData(fc(points));
      if (recomputeTracks) {
        trackAt = now;
        lastTracks = tracks.filter(f => f.properties?.kind === "track");
      }
      (map.getSource("sat-tracks") as GeoJSONSource).setData(fc([...tracks.filter(f => f.properties?.kind === "footprint"), ...lastTracks]));
      root.dataset.sats = String(points.length);
      const sub = subRef.current;
      if (sub) {
        const q = map.project([sub.lon, sub.lat]);
        root.dataset.sunPx = `${q.x.toFixed(1)},${q.y.toFixed(1)}`;
      }

      const u = userRef.current;
      (map.getSource("you") as GeoJSONSource).setData(fc(u ? [{ type: "Feature", geometry: { type: "Point", coordinates: [u.lon, u.lat] }, properties: {} }] : []));
      setStatus(st => (st.aircraft === inView ? st : { ...st, aircraft: inView }));

      // Origin and destination come from our cached route, asked once per callsign when a card opens.
      const cs = s?.kind === "plane" ? planesRef.current.get(s.hex)?.row[1] : "";
      if (cs && !routesRef.current.has(cs)) {
        const r = planesRef.current.get((s as { hex: string }).hex)!.row;
        routesRef.current.set(cs, "loading");
        fetch(`/api/aircraft/flight/${encodeURIComponent(cs)}?lat=${r[4]}&lon=${r[5]}`)
          .then(res => (res.ok ? (res.json() as Promise<{ route: FlightRoute | null }>) : { route: null }))
          .then(j => routesRef.current.set(cs, j.route))
          .catch(() => routesRef.current.set(cs, null))
          .finally(() => drawRef.current());
      }
      const c = buildCardRef.current(s);
      setCard(c);
      if (c) root.dataset.card = c.title;
      else delete root.dataset.card;
    };
    drawRef.current = draw;

    let drawTimer = 0;
    const loopDraw = () => {
      window.clearTimeout(drawTimer);
      if (!alive || document.hidden) return;
      draw();
      drawTimer = window.setTimeout(loopDraw, map.getZoom() >= 9 ? 250 : 1000);
    };

    /* ── taps ── */
    const onClick = (e: maplibregl.MapMouseEvent) => {
      const r = 14;
      const box: [[number, number], [number, number]] = [
        [e.point.x - r, e.point.y - r],
        [e.point.x + r, e.point.y + r],
      ];
      const ids = ["planes", "sat-points", "wrecks", "sun"].filter(id => map.getLayer(id) && map.getLayoutProperty(id, "visibility") !== "none");
      const feats = map.queryRenderedFeatures(box, { layers: ids });
      let best: { f: MapGeoJSONFeature; d: number } | null = null;
      for (const f of feats) {
        if (f.geometry.type !== "Point") continue;
        const pt = map.project(f.geometry.coordinates as [number, number]);
        const d = Math.hypot(pt.x - e.point.x, pt.y - e.point.y) - (f.layer.id === "wrecks" ? 0 : f.layer.id === "sun" ? 2 : 4);
        if (!best || d < best.d) best = { f, d };
      }
      if (!best) return;
      const pr = best.f.properties as Record<string, unknown>;
      if (best.f.layer.id === "planes") setSel({ kind: "plane", hex: String(pr.hex) });
      else if (best.f.layer.id === "sat-points") setSel({ kind: "sat", norad: Number(pr.norad) });
      else if (best.f.layer.id === "sun") setSel({ kind: "sun" });
      else setSel({ kind: "wreck", i: Number(pr.i) });
    };

    const onZoom = (e: { originalEvent?: unknown }) => {
      root.dataset.zoom = map.getZoom().toFixed(2);
      if (!e.originalEvent || performance.now() - openedAt < 900) return;
      if (map.getZoom() < CLOSE_ZOOM) onCloseRef.current();
    };

    const onVisibility = () => {
      if (document.hidden) {
        window.clearTimeout(pollTimer);
        window.clearTimeout(drawTimer);
      } else {
        poll();
        loopDraw();
        updateNight();
      }
    };

    map.on("load", () => {
      if (!alive) return;
      addLayers();
      if (!reduceMotion) map.easeTo({ zoom: 2.6, duration: 1100 });
      else map.jumpTo({ zoom: 2.6 });
      poll();
      loopDraw();
    });
    map.on("error", () => {
      /* tile hiccups: MapLibre retries; nothing to show the reader */
    });
    map.on("moveend", onMoveEnd);
    map.on("zoom", onZoom);
    map.on("click", onClick);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      alive = false;
      window.clearTimeout(pollTimer);
      window.clearTimeout(drawTimer);
      window.clearTimeout(moveTimer);
      window.clearTimeout(nightTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      map.remove();
      mapRef.current = null;
    };
    // The map is created once per opening; center is only the starting view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flyToUser = () => {
    const u = userRef.current;
    const map = mapRef.current;
    if (!u || !map) return;
    if (reduceMotion) map.jumpTo({ center: [u.lon, u.lat], zoom: 7 });
    else map.flyTo({ center: [u.lon, u.lat], zoom: 7, duration: 2200 });
  };

  const toggleLayer = (id: LayerId) => {
    const next = { ...layersRef.current, [id]: !layersRef.current[id] };
    layersRef.current = next;
    setLayers(next);
    applyVisRef.current();
  };

  useEffect(() => {
    drawRef.current();
  }, [sel]);

  /** The open card, rebuilt with every redraw. */
  useEffect(() => {
  buildCardRef.current = (sel: Sel | null): Card | null => {
    if (!sel) return null;
    const u = userRef.current;
    const now = Date.now();
    if (sel.kind === "plane") {
      const p = planesRef.current.get(sel.hex);
      if (!p) return null;
      const r = p.row;
      const ground = !!(r[12] & 2);
      const [lat, lon] = deadReckon(r[4], r[5], r[8], ground ? 0 : r[7], Math.min(90, (now - p.at) / 1000));
      const rows: CardRow[] = [
        ["Altitude", altitudeLabel(r[6], ground)],
        ["Speed", `${fmtInt(r[7])} kt · ${fmtInt(r[7] * 1.852)} km/h`],
        ["Heading", r[8] >= 0 ? `${Math.round(r[8])}°` : "—"],
      ];
      if (!ground && r[9]) rows.push(["Climb", `${r[9] > 0 ? "+" : "−"}${fmtInt(Math.abs(r[9]))} ft/min`]);
      if (r[3] || r[13]) rows.push(["Type", [r[3], r[13]].filter(Boolean).join(" · ")]);
      if (r[10] && CATEGORY[r[10]]) rows.push(["Class", CATEGORY[r[10]]!]);
      if (r[2]) rows.push(["Registration", r[2]]);
      if (r[14]) rows.push(["Operator", r[14]]);
      if (r[12] & 1) rows.push(["Military", "yes (adsb.lol database)"]);
      const route = r[1] ? routesRef.current.get(r[1]) : undefined;
      if (route === "loading") rows.push(["Route", "looking up…"]);
      else if (route) {
        const { sure } = routeCheck(route, lat, lon);
        rows.push(["From", `${route.from.iata || route.from.icao} · ${route.from.city || route.from.name}`, !sure]);
        rows.push(["To", `${route.to.iata || route.to.icao} · ${route.to.city || route.to.name}`, !sure]);
        if (!sure) rows.push(["Route note", "route from callsign, may not match", true]);
      } else if (r[1]) rows.push(["Route", "not in the open route data"]);
      if (u) rows.push(["From you", fmtKm(haversineKm(u.lat, u.lon, lat, lon))]);
      rows.push(["Position", `${lat.toFixed(3)}°, ${lon.toFixed(3)}°`]);
      if (r[11]) rows.push(["Squawk", r[11]]);
      rows.push(["ICAO hex", r[0].toUpperCase()]);
      rows.push(["Trail", `${p.trail.length + 1} points · ${Math.max(0, Math.round((now - p.trail[0]![2]) / 1000))} s`]);
      rows.push(["Report age", `${Math.max(0, Math.round((now - p.at) / 1000))} s`]);
      return { title: r[1] || r[2] || r[0].toUpperCase(), sub: [r[13] || r[3], r[14]].filter(Boolean).join(" · ") || "Aircraft", rows };
    }
    if (sel.kind === "sat") {
      const sat = satRecs.current.find(s => s.row[0] === sel.norad);
      if (!sat?.rec) return null;
      const t = new Date(now);
      const pv = propagate(sat.rec, t);
      const p = pv?.position;
      const v = pv?.velocity;
      if (!p || typeof p !== "object" || !v || typeof v !== "object") return null;
      const m = measureSat(sat.row, p as { x: number; y: number; z: number }, v as { x: number; y: number; z: number }, t);
      const g = temeToGeodetic(p as { x: number; y: number; z: number }, t);
      const foot = RE_KM * Math.acos(RE_KM / (RE_KM + Math.max(0, g.altKm)));
      const rows: Array<[string, string]> = [
        ["Altitude", fmtKm(m.altKm)],
        ["Speed", `${m.speedKmS.toFixed(2)} km/s`],
        ["Orbit", `${m.periodMin.toFixed(1)} min`],
        ["Inclination", `${m.incDeg.toFixed(1)}°`],
        ["Over", `${g.latDeg.toFixed(2)}°, ${g.lonDeg.toFixed(2)}°`],
        ["Seen from", `within ${fmtInt(foot)} km of the ground track`],
      ];
      if (u) rows.push(["From you", fmtKm(Math.hypot(haversineKm(u.lat, u.lon, g.latDeg, g.lonDeg), m.altKm))]);
      rows.push(["NORAD id", String(m.norad)]);
      return { title: sat.name, sub: `${ORBIT_CLASS_LABEL[m.cls]} · ${sat.row[1]}`, rows };
    }
    if (sel.kind === "sun") {
      const s = subRef.current;
      if (!s) return null;
      const rows: CardRow[] = [
        ["Over", `${Math.abs(s.lat).toFixed(2)}° ${s.lat >= 0 ? "N" : "S"}, ${Math.abs(s.lon).toFixed(2)}° ${s.lon >= 0 ? "E" : "W"}`],
        ["Local solar time", "12:00 here, solar noon"],
      ];
      if (u) {
        const el = sunElevation(u.lat, u.lon, s);
        rows.push(["Your solar time", fmtSolarTime(solarTimeHours(u.lon, s.lon))]);
        rows.push(["Sun from you", `${el >= 0 ? "" : "−"}${Math.abs(el).toFixed(1)}° · ${lightAt(el)}`]);
        rows.push(["From you", fmtKm(haversineKm(u.lat, u.lon, s.lat, s.lon))]);
      }
      const c = mapRef.current?.getCenter();
      if (c) rows.push(["Map centre", `${fmtSolarTime(solarTimeHours(c.lng, s.lon))} solar time · ${lightAt(sunElevation(c.lat, c.lng, s))}`]);
      rows.push(["Sun distance", `${s.distAu.toFixed(4)} AU · ${((s.distAu * 149_597_870.7) / 299_792.458 / 60).toFixed(1)} light-min`]);
      rows.push(["Shading", "night, then civil, nautical and astronomical twilight, updated each minute"]);
      return { title: "Sun overhead here", sub: "Subsolar point", rows };
    }
    const w = wrecksRef.current?.rows[sel.i];
    if (!w) return null;
    const rows: Array<[string, string]> = [["Kind", wrecksRef.current!.cats[w[2]] ?? "wreck"]];
    if (w[3] !== null) rows.push(["Depth over it", `${w[3]} m`]);
    if (w[4] && WATLEV[w[4]]) rows.push(["Water", WATLEV[w[4]]!]);
    if (w[6]) rows.push(["Charted", String(w[6])]);
    rows.push(["Position", `${w[1].toFixed(4)}°, ${w[0].toFixed(4)}°`]);
    if (u) rows.push(["From you", fmtKm(haversineKm(u.lat, u.lon, w[1], w[0]))]);
    rows.push(["Source", "NOAA nautical charts"]);
    rows.push(["Note", "Not for navigation"]);
    return { title: w[5] || "Unnamed wreck", sub: "Shipwreck", rows };
  };
  }, []);

  return (
    <div ref={rootRef} className="onyx-orr-map" data-testid="earth-map">
      <div ref={boxRef} className="onyx-orr-map-box" />
      <header className="onyx-orr-head">
        <button type="button" className="onyx-orr-back" onClick={onClose} aria-label="Back to the globe">
          ‹
        </button>
        <p className="onyx-orr-title">
          Orrery<span className="onyx-orr-sub"> · Earth up close</span>
        </p>
        <span />
      </header>

      {card ? (
        <section className="onyx-orr-card" aria-label={`Measurements: ${card.title}`}>
          <header>
            <div>
              <h2>{card.title}</h2>
              <p>{card.sub}</p>
            </div>
            <button type="button" className="onyx-orr-card-x" onClick={() => setSel(null)} aria-label="Close measurements">
              ×
            </button>
          </header>
          <dl>
            {card.rows.map(([k, v, dim]) => (
              <div key={k} className={dim ? "onyx-orr-dim" : undefined}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <div className="onyx-orr-panel">
        <div className="onyx-orr-row onyx-orr-tools">
          <button type="button" className={`onyx-orr-chip${layersOpen ? " on" : ""}`} aria-expanded={layersOpen} onClick={() => setLayersOpen(o => !o)}>
            Layers
          </button>
          {hasUser ? (
            <button type="button" className="onyx-orr-chip" onClick={flyToUser}>
              Near you
            </button>
          ) : null}
          <span className="onyx-orr-date" aria-live="polite">
            {!status.ready
              ? "opening the map…"
              : status.note || (layers.aircraft ? `${fmtInt(status.aircraft)} aircraft in view` : "aircraft hidden")}
          </span>
        </div>
        {layersOpen ? (
          <div className="onyx-orr-row onyx-orr-layers" role="group" aria-label="Map layers">
            {LAYERS.map(l => (
              <button
                key={l.id}
                type="button"
                className={`onyx-orr-chip${layers[l.id] ? " on" : ""}`}
                aria-pressed={layers[l.id]}
                data-layer={l.id}
                onClick={() => toggleLayer(l.id)}
              >
                {l.label}
              </button>
            ))}
            <button type="button" className="onyx-orr-chip ghost" disabled aria-disabled="true" title="Ships need a live AIS feed; coming later">
              Ships (coming)
            </button>
          </div>
        ) : null}
        <p className="onyx-orr-hint">drag to move · pinch out to the globe · tap a plane, satellite, wreck or the Sun</p>
        <p className="onyx-orr-credit">
          Aircraft: adsb.lol (<a href={ODBL} target="_blank" rel="noopener noreferrer">ODbL</a>) · Map: OpenFreeMap © OpenMapTiles ©{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> · Seafloor:
          GEBCO · Wrecks: NOAA{status.wrecks ? ` (${fmtInt(status.wrecks)}, US charts)` : ""}, not for navigation · Orbits:
          CelesTrak · <a href="/credits">Credits</a>
        </p>
      </div>
    </div>
  );
}
