// ───────────────────────────────────────────────────────────────
// COSMOS · weatherService  (Open-Meteo, keyless)
// ───────────────────────────────────────────────────────────────

import type { GeoCoords, WeatherData } from '@/types/cosmos';

const WMO: Record<number, string> = {
  0: 'clear sky', 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast',
  45: 'fog', 48: 'rime fog', 51: 'light drizzle', 53: 'drizzle',
  55: 'dense drizzle', 61: 'light rain', 63: 'rain', 65: 'heavy rain',
  71: 'light snow', 73: 'snow', 75: 'heavy snow', 80: 'rain showers',
  81: 'showers', 82: 'violent showers', 95: 'thunderstorm',
  96: 'thunderstorm + hail', 99: 'severe thunderstorm',
};

export async function fetchWeather(
  coords: GeoCoords,
  signal?: AbortSignal,
): Promise<WeatherData> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}` +
    `&longitude=${coords.lon}` +
    `&current=temperature_2m,weather_code,is_day,cloud_cover,wind_speed_10m` +
    `&wind_speed_unit=kmh`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`weather ${res.status}`);
  const j = await res.json();
  const c = j.current;

  return {
    tempC: c.temperature_2m,
    code: c.weather_code,
    description: WMO[c.weather_code] ?? 'unknown',
    isDay: c.is_day === 1,
    cloudCover: c.cloud_cover,
    windKph: c.wind_speed_10m,
    fetchedAt: Date.now(),
  };
}
