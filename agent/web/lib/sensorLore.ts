/**
 * Technical + cultural framing for each Oracle Sense.
 * Shown in the tap-to-open detail sheet — keeps tile faces quiet while depth stays one tap away.
 */

export type SensorLore = {
  id: string;
  title: string;
  glyph: string;
  /** What the hardware measures. */
  technical: string;
  /** How traditions / oracles have read this kind of signal. */
  cultural: string;
  /** What DELPHI does with it. */
  delphi: string;
};

export const SENSOR_LORE: Record<string, SensorLore> = {
  tilt: {
    id: "tilt",
    title: "Accel + Tilt",
    glyph: "📐",
    technical:
      "The accelerometer reports linear acceleration including gravity. Tilt is the angle between the device and upright — how far you're leaning the phone in space.",
    cultural:
      "Inclination has long marked omen and orientation: a tilted vessel, a leaning tower, the plumb line that finds true vertical. The body knows when the horizon is wrong before the mind names it.",
    delphi:
      "Feeds the motion bank and the activity dial — a live read on how the instrument itself is held.",
  },
  gforce: {
    id: "gforce",
    title: "Linear g-force",
    glyph: "🚀",
    technical:
      "Linear acceleration with gravity removed. Units in g (Earth gravity ≈ 1). Spikes mark starts, stops, bumps, and free-fall.",
    cultural:
      "Sudden force is the language of omens that arrive as impact — thunder, quake, the jolt that wakes. Traditions that watch for 'signs in the body of the world' are watching for discontinuities.",
    delphi: "Drives the speed dial's intensity and shake detection when the ground (or your hand) moves.",
  },
  gyro: {
    id: "gyro",
    title: "Gyroscope",
    glyph: "🌀",
    technical:
      "Angular velocity around the device axes (α / β / γ in °/s). How fast the phone is rotating, not where it points.",
    cultural:
      "Spin and whirl appear across cosmologies as the shape of becoming — chakras, whirling dervishes, the precession of the equinoxes. Rotation is how fixed stars slowly change their story.",
    delphi: "Complements compass heading for sky pose and orientation when the phone turns in your hand.",
  },
  shake: {
    id: "shake",
    title: "Shake",
    glyph: "💥",
    technical: "Counts sharp acceleration bursts above a threshold, with a live intensity in m/s².",
    cultural:
      "Shaking is an old ritual act — rattle, casting lots, waking the spirits by disturbing stillness. A shake is a deliberate break in the quiet.",
    delphi: "A playful interrupt signal; intensity can mark intentional user gestures.",
  },
  steps: {
    id: "steps",
    title: "Pedometer",
    glyph: "👣",
    technical: "Step count and cadence (steps per minute) derived from motion patterns while walking.",
    cultural:
      "The footpath is a calendar of its own — pilgrimage counts, labyrinth steps, the measured walk that turns space into time. Many day-counts began as ways to mark a journey.",
    delphi: "Ties motion to the activity dial's walk mode and the body's rhythm through the day.",
  },
  light: {
    id: "light",
    title: "Ambient Light",
    glyph: "☀️",
    technical:
      "Illuminance in lux from a hardware light sensor when the browser exposes it. On many phones (especially iOS Safari) this API is blocked — DELPHI then estimates from solar elevation.",
    cultural:
      "Light is the oldest clock. Dawn and dusk divide ritual days; the strength of day marks work, rest, and holy hours. Lux is the modern name for what temples oriented their doors toward.",
    delphi:
      "Colors the sky and clock atmosphere. When hardware is N/A, the sun's position still gives a reasoned estimate — tick this sense on to keep that instrument visible.",
  },
  mic: {
    id: "mic",
    title: "Microphone",
    glyph: "🎙️",
    technical:
      "Sound level in dBFS and a peak frequency estimate. Requires an explicit permission opt-in; nothing is recorded beyond the live meter.",
    cultural:
      "Sound as omen: winds, bells, the first bird, silence before storm. Listening without speaking is a classic oracular posture — the ear before the mouth.",
    delphi: "A live ambient voice of the room; opt-in only, never stored as audio.",
  },
  pressure: {
    id: "pressure",
    title: "Barometer",
    glyph: "🌡️",
    technical:
      "Air pressure in hectopascals (hPa). Sea-level standard is ~1013.25. Hardware barometers exist on many phones; Safari often blocks them, so DELPHI falls back to weather-API pressure.",
    cultural:
      "Falling pressure has always meant weather change — sailors, farmers, and mountain peoples read the air's weight as mood of the sky. Storms announce themselves in the blood and the glass.",
    delphi: "Shown against the 1013.25 baseline so you can feel rising vs falling weather pressure at a glance.",
  },
  magnet: {
    id: "magnet",
    title: "Magnetometer",
    glyph: "🧲",
    technical:
      "Local magnetic field strength in microteslas (µT). Quiet Earth field is roughly 25–65 µT; metal and electronics spike higher. Feeds compass / EMF reads when available.",
    cultural:
      "Lodestone and compass turned the invisible into a direction. Magnetic sensing sits next to dowsing and geomancy in the long history of reading the field underfoot — the Earth's own quiet instruction.",
    delphi:
      "Sibling to the EMF panel. When the browser withholds the Generic Sensor API, tick this on to keep the magnetometer present as a known absence rather than a missing instrument.",
  },
  proximity: {
    id: "proximity",
    title: "Proximity",
    glyph: "📡",
    technical:
      "Near/far (or distance in cm) from the front IR sensor. Mostly Android; iOS Safari does not expose it to the web.",
    cultural:
      "Nearness is the oldest social metric — how close a body stands before speech, before touch, before threat. Thresholds of approach structure ritual space as much as architecture does.",
    delphi: "A presence detector for the instrument itself — face or hand entering the phone's personal space.",
  },
  battery: {
    id: "battery",
    title: "Battery",
    glyph: "🔋",
    technical:
      "Charge level and charging state. iOS Safari does not expose the Battery Status API to websites.",
    cultural:
      "Reserve and depletion are life metaphors everywhere — oil in the lamp, breath in the body, the fire that must be fed. Knowing what remains is half of knowing when to act.",
    delphi: "Keeps the oracle honest about how long the session can stay awake.",
  },
  orientation: {
    id: "orientation",
    title: "Orientation",
    glyph: "🧭",
    technical: "Screen angle and type (portrait / landscape). How the viewport is rotated relative to the device.",
    cultural:
      "Turning the tablet or page has always changed what a reading means — landscape for maps, portrait for faces. Orientation is a choice of which face of the world you present.",
    delphi: "Useful when pairing the sky map with how you're holding the glass.",
  },
  hardware: {
    id: "hardware",
    title: "Hardware",
    glyph: "⚙️",
    technical: "CPU cores, device memory (when exposed), pixel density, and online/offline state.",
    cultural:
      "Tools have always had a pedigree — bronze, iron, silicon. Naming the instrument's capacity is part of trusting the reading it gives.",
    delphi: "Context for performance and which senses this vessel can reasonably awaken.",
  },
  vibration: {
    id: "vibration",
    title: "Vibration",
    glyph: "📳",
    technical:
      "Triggers the haptic motor via the Vibration API. iOS Safari exposes the call but does not vibrate.",
    cultural:
      "Pulse and drum are embodied timekeeping — the beat that synchronizes a group. A buzz under the skin is a modern rattle.",
    delphi: "A test pulse so you can feel that the oracle can speak through touch when the platform allows.",
  },
  wakelock: {
    id: "wakelock",
    title: "Wake Lock",
    glyph: "👁️",
    technical:
      "Requests that the screen stay on while this tab is visible. Releases when you leave or tap Release.",
    cultural:
      "Keeping vigil — the lamp that must not go out through the night watch. Wake lock is the digital form of that discipline.",
    delphi: "Useful on the sky and senses tabs when you need the instrument to stay open without the screen sleeping.",
  },
};

export function sensorLore(id: string): SensorLore | undefined {
  return SENSOR_LORE[id];
}
