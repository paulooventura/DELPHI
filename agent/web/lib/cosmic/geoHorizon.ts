/**
 * Topocentric horizon coordinates from geographic positions.
 * Converts observer + target (lat/lon/alt) into local azimuth and altitude.
 */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** WGS-84 ellipsoid constants. */
const WGS84_A = 6378137;
const WGS84_E2 = 0.00669437999014;

export type GeoPosition = {
  latDeg: number;
  lonDeg: number;
  altM: number;
};

export type HorizontalCoords = {
  az: number;
  alt: number;
  /** Slant range in metres. */
  rangeM: number;
  /** Great-circle surface distance in metres. */
  surfaceDistanceM: number;
};

export type EcefVector = { x: number; y: number; z: number };

/** Geodetic → Earth-Centered Earth-Fixed (ECEF) metres. */
export function geoToEcef(latDeg: number, lonDeg: number, altM: number): EcefVector {
  const lat = latDeg * RAD;
  const lon = lonDeg * RAD;
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const sinLon = Math.sin(lon);
  const cosLon = Math.cos(lon);
  const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  return {
    x: (n + altM) * cosLat * cosLon,
    y: (n + altM) * cosLat * sinLon,
    z: (n * (1 - WGS84_E2) + altM) * sinLat,
  };
}

/** ECEF difference vector → local East-North-Up at observer. */
export function ecefToEnu(
  dx: number,
  dy: number,
  dz: number,
  observerLatDeg: number,
  observerLonDeg: number,
): { e: number; n: number; u: number } {
  const lat = observerLatDeg * RAD;
  const lon = observerLonDeg * RAD;
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const sinLon = Math.sin(lon);
  const cosLon = Math.cos(lon);
  return {
    e: -sinLon * dx + cosLon * dy,
    n: -sinLat * cosLon * dx - sinLat * sinLon * dy + cosLat * dz,
    u: cosLat * cosLon * dx + cosLat * sinLon * dy + sinLat * dz,
  };
}

/** Haversine surface distance between two geodetic points (metres). */
export function surfaceDistanceM(
  lat1Deg: number,
  lon1Deg: number,
  lat2Deg: number,
  lon2Deg: number,
): number {
  const lat1 = lat1Deg * RAD;
  const lat2 = lat2Deg * RAD;
  const dLat = (lat2Deg - lat1Deg) * RAD;
  const dLon = (lon2Deg - lon1Deg) * RAD;
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * WGS84_A * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Map a geographic target into the observer's local horizontal frame.
 * Azimuth: 0° = north, 90° = east. Altitude: 0° = horizon, 90° = zenith.
 */
export function geoToAltAz(
  observer: GeoPosition,
  target: GeoPosition,
): HorizontalCoords {
  const obsEcef = geoToEcef(observer.latDeg, observer.lonDeg, observer.altM);
  const tgtEcef = geoToEcef(target.latDeg, target.lonDeg, target.altM);
  const dx = tgtEcef.x - obsEcef.x;
  const dy = tgtEcef.y - obsEcef.y;
  const dz = tgtEcef.z - obsEcef.z;
  const { e, n, u } = ecefToEnu(dx, dy, dz, observer.latDeg, observer.lonDeg);
  const horiz = Math.sqrt(e * e + n * n);
  const rangeM = Math.sqrt(e * e + n * n + u * u);
  let az = Math.atan2(e, n) * DEG;
  if (az < 0) az += 360;
  const alt = Math.atan2(u, horiz) * DEG;
  const surfaceDistanceM_ = surfaceDistanceM(
    observer.latDeg,
    observer.lonDeg,
    target.latDeg,
    target.lonDeg,
  );
  return { az, alt, rangeM, surfaceDistanceM: surfaceDistanceM_ };
}

/** Angular rate (deg/min) between two horizon positions over elapsed minutes. */
export function horizonAngularRateDegMin(
  a: Pick<HorizontalCoords, "az" | "alt">,
  b: Pick<HorizontalCoords, "az" | "alt">,
  elapsedMin: number,
): { azRate: number; altRate: number; sepRate: number } {
  if (elapsedMin <= 0) return { azRate: 0, altRate: 0, sepRate: 0 };
  const dAz = ((b.az - a.az + 540) % 360) - 180;
  const dAlt = b.alt - a.alt;
  const azRate = dAz / elapsedMin;
  const altRate = dAlt / elapsedMin;
  const sepRate = Math.sqrt(azRate * azRate + altRate * altRate);
  return { azRate, altRate, sepRate };
}
