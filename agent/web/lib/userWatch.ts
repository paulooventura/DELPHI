/**
 * Live "you are here" for the map: watches the reader's position only if location is
 * already granted (never asks), pauses while the page is hidden, and never sends it anywhere.
 */

export type UserFix = { lat: number; lon: number; heading: number | null; speed: number | null };

type Env = {
  geolocation?: Geolocation;
  permissions?: Permissions;
  doc?: Pick<Document, "hidden" | "addEventListener" | "removeEventListener">;
};

const WATCH_OPTS: PositionOptions = { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 };

/** Starts watching; returns a stop function that clears the watch and the listener. */
export function watchUser(onFix: (fix: UserFix) => void, env: Env = {}): () => void {
  const geo = env.geolocation ?? (typeof navigator !== "undefined" ? navigator.geolocation : undefined);
  const perms = env.permissions ?? (typeof navigator !== "undefined" ? (navigator as Navigator & { permissions?: Permissions }).permissions : undefined);
  const doc = env.doc ?? (typeof document !== "undefined" ? document : undefined);
  if (!geo || !perms) return () => {};

  let alive = true;
  let granted = false;
  let id: number | null = null;

  const start = () => {
    if (!alive || !granted || id !== null || doc?.hidden) return;
    id = geo.watchPosition(
      pos => {
        if (!alive) return;
        const { latitude, longitude, heading, speed } = pos.coords;
        onFix({
          lat: latitude,
          lon: longitude,
          heading: heading != null && Number.isFinite(heading) ? heading : null,
          speed: speed != null && Number.isFinite(speed) ? speed : null,
        });
      },
      () => {},
      WATCH_OPTS,
    );
  };
  const stop = () => {
    if (id !== null) geo.clearWatch(id);
    id = null;
  };
  const onVisibility = () => (doc?.hidden ? stop() : start());

  perms
    .query({ name: "geolocation" as PermissionName })
    .then(p => {
      granted = p.state === "granted";
      start();
    })
    .catch(() => {});
  doc?.addEventListener("visibilitychange", onVisibility);

  return () => {
    alive = false;
    stop();
    doc?.removeEventListener("visibilitychange", onVisibility);
  };
}
