import { NextResponse } from "next/server";
import { getCycleSnapshot, weatherCodeToEmoji, type WeatherInfo } from "../../../lib/cycleSystems";

function hourFromIso(iso: string): number {
  const m = iso.match(/T(\d{2}):/);
  return m ? Number.parseInt(m[1]!, 10) : 0;
}

function dateFromIso(iso: string): string {
  return iso.slice(0, 10);
}

async function fetchWeather(
  lat = 36.1627,
  lon = -86.7816,
  timezone = "auto",
  localDate?: string,
): Promise<WeatherInfo | undefined> {
  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: "temperature_2m,weather_code,wind_speed_10m,is_day,cloud_cover,precipitation",
      hourly: "weather_code,temperature_2m,precipitation_probability,cloud_cover,is_day",
      forecast_days: "2",
      timezone,
    });
    const url = `https://api.open-meteo.com/v1/forecast?${params}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), next: { revalidate: 300 } });
    if (!res.ok) return undefined;
    const json = await res.json();
    const cur = json?.current;
    if (!cur) return undefined;

    const code: number = cur.weather_code ?? 0;
    const curIsDay = cur.is_day === 1 || cur.is_day === true;
    const { emoji, condition } = weatherCodeToEmoji(code, curIsDay);

    const hourlyCodes: number[] = json?.hourly?.weather_code ?? [];
    const hourlyTemps: number[] = json?.hourly?.temperature_2m ?? [];
    const hourlyPrecip: number[] = json?.hourly?.precipitation_probability ?? [];
    const hourlyCloud: number[] = json?.hourly?.cloud_cover ?? [];
    const hourlyIsDay: number[] = json?.hourly?.is_day ?? [];
    const hourlyTimes: string[] = json?.hourly?.time ?? [];

    const targetDate = localDate ?? dateFromIso(hourlyTimes[0] ?? "");
    const hourly: WeatherInfo["hourly"] = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      emoji: "·",
      condition: "",
      tempC: null,
      precipProb: null,
      cloudCover: null,
      isDay: hour >= 6 && hour < 20,
    }));

    for (let idx = 0; idx < hourlyTimes.length; idx++) {
      const time = hourlyTimes[idx]!;
      if (dateFromIso(time) !== targetDate) continue;
      const hour = hourFromIso(time);
      if (hour < 0 || hour > 23) continue;

      const hCode = hourlyCodes[idx] ?? code;
      const isDay = hourlyIsDay[idx] === 1;
      const hMeta = weatherCodeToEmoji(hCode, isDay);
      hourly[hour] = {
        hour,
        emoji: hMeta.emoji,
        condition: hMeta.condition,
        tempC: typeof hourlyTemps[idx] === "number" ? hourlyTemps[idx]! : null,
        precipProb: typeof hourlyPrecip[idx] === "number" ? hourlyPrecip[idx]! : null,
        cloudCover: typeof hourlyCloud[idx] === "number" ? hourlyCloud[idx]! : null,
        isDay,
      };
    }

    // Fill gaps from nearest hour or current conditions
    for (let h = 0; h < 24; h++) {
      if (hourly[h]!.emoji !== "·") continue;
      const near = hourly.find(x => x.emoji !== "·");
      hourly[h] = {
        hour: h,
        emoji: near?.emoji ?? emoji,
        condition: near?.condition ?? condition,
        tempC: near?.tempC ?? (typeof cur.temperature_2m === "number" ? cur.temperature_2m : null),
        precipProb: near?.precipProb ?? null,
        cloudCover: near?.cloudCover ?? null,
        isDay: h >= 6 && h < 20,
      };
    }

    return {
      condition,
      emoji,
      tempC: typeof cur.temperature_2m === "number" ? cur.temperature_2m : null,
      windKmh: typeof cur.wind_speed_10m === "number" ? cur.wind_speed_10m : null,
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
    const timezone = searchParams.get("tz") ?? "auto";
    const localDate = searchParams.get("date") ?? undefined;
    const weather = await fetchWeather(lat, lon, timezone, localDate);
    // Calendar fields are always recomputed on the client in local time; ship weather only.
    const snapshot = getCycleSnapshot(new Date(), weather);
    return NextResponse.json(snapshot);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
