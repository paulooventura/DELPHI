// ───────────────────────────────────────────────────────────────
// COSMOS · useCosmosStore
// Centralized state. The ticking clock lives here so every tab
// reads one synchronized timestamp.
// ───────────────────────────────────────────────────────────────

import { create } from 'zustand';
import type {
  TabId,
  SensorData,
  GeoCoords,
  WeatherData,
  UserProfile,
} from '@/types/cosmos';
import { fetchWeather } from '@/services/weatherService';

interface CosmosState {
  activeTab: TabId;
  now: Date;
  timeScale: number; // 1 = realtime; >1 accelerates
  live: boolean;

  profile: UserProfile;
  coords: GeoCoords | null;
  weather: WeatherData | null;
  sensor: SensorData;
  aimedObjectId: string | null;

  _tick?: ReturnType<typeof setInterval>;

  setTab: (t: TabId) => void;
  setNow: (d: Date) => void;
  setTimeScale: (s: number) => void;
  goLive: () => void;
  startClock: () => void;
  stopClock: () => void;

  setProfile: (p: Partial<UserProfile>) => void;
  setAimed: (id: string | null) => void;

  requestGeo: () => Promise<void>;
  refreshWeather: () => Promise<void>;
  requestSensors: () => Promise<void>;
  _onOrient?: (e: DeviceOrientationEvent) => void;
}

export const useCosmosStore = create<CosmosState>((set, get) => ({
  activeTab: 'clock',
  now: new Date(),
  timeScale: 1,
  live: true,
  profile: {},
  coords: null,
  weather: null,
  sensor: { alpha: 0, beta: 0, gamma: 0, available: false, permission: 'unknown' },
  aimedObjectId: null,

  setTab: (t) => set({ activeTab: t }),
  setNow: (d) => set({ now: d, live: false }),
  setTimeScale: (s) => set({ timeScale: s }),
  goLive: () => set({ now: new Date(), live: true, timeScale: 1 }),

  startClock: () => {
    if (get()._tick) return;
    const tick = setInterval(() => {
      const { live, timeScale, now } = get();
      if (live && timeScale === 1) {
        set({ now: new Date() });
      } else {
        // accelerated / scrubbing mode advances from the held instant
        set({ now: new Date(now.getTime() + 1000 * timeScale) });
      }
    }, 1000);
    set({ _tick: tick });
  },
  stopClock: () => {
    const t = get()._tick;
    if (t) clearInterval(t);
    set({ _tick: undefined });
  },

  setProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
  setAimed: (id) => set({ aimedObjectId: id }),

  requestGeo: async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          set({
            coords: { lat: pos.coords.latitude, lon: pos.coords.longitude },
          });
          resolve();
        },
        () => resolve(),
        { enableHighAccuracy: false, timeout: 8000 },
      );
    });
    await get().refreshWeather();
  },

  refreshWeather: async () => {
    const c = get().coords;
    if (!c) return;
    try {
      const w = await fetchWeather(c);
      set({ weather: w });
    } catch {
      /* leave weather null; synthesis degrades gracefully */
    }
  },

  requestSensors: async () => {
    if (typeof window === 'undefined') return;
    const DOE = window.DeviceOrientationEvent as any;
    if (!DOE) {
      set((s) => ({ sensor: { ...s.sensor, permission: 'unsupported' } }));
      return;
    }
    // iOS 13+ gated permission
    if (typeof DOE.requestPermission === 'function') {
      try {
        const res = await DOE.requestPermission();
        if (res !== 'granted') {
          set((s) => ({ sensor: { ...s.sensor, permission: 'denied' } }));
          return;
        }
      } catch {
        set((s) => ({ sensor: { ...s.sensor, permission: 'denied' } }));
        return;
      }
    }
    const handler = (e: DeviceOrientationEvent) => {
      set({
        sensor: {
          alpha: e.alpha ?? 0,
          beta: e.beta ?? 0,
          gamma: e.gamma ?? 0,
          available: true,
          permission: 'granted',
        },
      });
    };
    // detach a prior listener if re-requested
    const prev = get()._onOrient;
    if (prev) window.removeEventListener('deviceorientation', prev);
    window.addEventListener('deviceorientation', handler, true);
    set((s) => ({
      _onOrient: handler,
      sensor: { ...s.sensor, permission: 'granted', available: true },
    }));
  },
}));
