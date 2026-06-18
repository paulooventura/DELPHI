import { NextResponse } from "next/server";
import { getCycleSnapshot, type WeatherInfo } from "../../../lib/cycleSystems";

async function fetchWeather(lat = 36.1627, lon = -86.7816): Promise<WeatherInfo | undefined> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,weathercode&forecast_days=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return undefined;
    const json = await res.json();
    const cw   = json?.current_weather;
    if (!cw) return undefined;
    const code: number = cw.weathercode ?? 0;
    const condition =
      code === 0   ? "Clear sky"
      : code <= 3  ? "Partly cloudy"
      : code <= 9  ? "Foggy"
      : code <= 29 ? "Drizzle"
      : code <= 39 ? "Rain"
      : code <= 49 ? "Snow"
      : code <= 67 ? "Showers"
      : code <= 77 ? "Snow"
      : code <= 82 ? "Rain showers"
      : code <= 86 ? "Snow showers"
      : "Thunderstorm";
    const emoji =
      code === 0   ? "☀️"
      : code <= 3  ? "⛅"
      : code <= 9  ? "🌫️"
      : code <= 39 ? "🌧️"
      : code <= 49 ? "❄️"
      : code <= 67 ? "🌦️"
      : code <= 77 ? "🌨️"
      : "⛈️";
    return { condition, emoji, tempC: typeof cw.temperature === "number" ? cw.temperature : null, windKmh: typeof cw.windspeed === "number" ? cw.windspeed : null };
  } catch {
    return undefined;
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat") ? Number(searchParams.get("lat")) : 36.1627;
    const lon = searchParams.get("lon") ? Number(searchParams.get("lon")) : -86.7816;
    const weather  = await fetchWeather(lat, lon);
    const snapshot = getCycleSnapshot(undefined, weather);
    return NextResponse.json(snapshot);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
