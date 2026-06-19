import { NextResponse } from "next/server";
import { getCycleSnapshot, weatherCodeToEmoji, type WeatherInfo } from "../../../lib/cycleSystems";

async function fetchWeather(lat = 36.1627, lon = -86.7816): Promise<WeatherInfo | undefined> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,weathercode&forecast_days=1&timezone=auto`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return undefined;
    const json = await res.json();
    const cw = json?.current_weather;
    if (!cw) return undefined;

    const code: number = cw.weathercode ?? 0;
    const { emoji, condition } = weatherCodeToEmoji(code);

    const hourlyCodes: number[] = json?.hourly?.weathercode ?? [];
    const hourlyTemps: number[] = json?.hourly?.temperature_2m ?? [];
    const hourlyTimes: string[] = json?.hourly?.time ?? [];

    const hourly: WeatherInfo["hourly"] = [];
    for (let h = 0; h < 24; h++) {
      const idx = hourlyTimes.findIndex(t => {
        const d = new Date(t);
        return d.getHours() === h;
      });
      const hCode = idx >= 0 ? (hourlyCodes[idx] ?? code) : code;
      const hMeta = weatherCodeToEmoji(hCode);
      hourly.push({
        hour: h,
        emoji: hMeta.emoji,
        condition: hMeta.condition,
        tempC: idx >= 0 && typeof hourlyTemps[idx] === "number" ? hourlyTemps[idx] : null,
      });
    }

    return {
      condition,
      emoji,
      tempC: typeof cw.temperature === "number" ? cw.temperature : null,
      windKmh: typeof cw.windspeed === "number" ? cw.windspeed : null,
      hourly,
    };
  } catch {
    return undefined;
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat") ? Number(searchParams.get("lat")) : 36.1627;
    const lon = searchParams.get("lon") ? Number(searchParams.get("lon")) : -86.7816;
    const weather = await fetchWeather(lat, lon);
    const snapshot = getCycleSnapshot(undefined, weather);
    return NextResponse.json(snapshot);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
