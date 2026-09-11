/**
 * Pneuma Mundi chamber map — user-facing names for the compass and doors.
 * Route keys (sky / tonal / …) stay stable so deep links and mode state keep working.
 */

export type ChamberId =
  | "aether"
  | "heliodrome"
  | "agon"
  | "mouseion"
  | "adyton"
  | "omphalos"
  | "psyche";

/** Stable door keys used by the compass router. */
export type CompassDoor = "sky" | "tonal" | "studies" | "orrery" | "you";

export type ChamberDef = {
  id: ChamberId;
  /** Public chamber name */
  name: string;
  /** One-line function */
  gist: string;
  door: CompassDoor | null;
};

/**
 * Omphalos = home surface: the NOW moment reading (street chord).
 * Psyche = inward personal chord (birth / natal) — formerly the You tab.
 * Cardinals fly outward; center draws inward into Psyche from Omphalos.
 */
export const CHAMBERS: Record<ChamberId, ChamberDef> = {
  aether: {
    id: "aether",
    name: "Aether",
    gist: "Live map of the heavens",
    door: "sky",
  },
  heliodrome: {
    id: "heliodrome",
    name: "Heliodrome",
    gist: "Heavens in motion — the sun’s course",
    door: "orrery",
  },
  agon: {
    id: "agon",
    name: "Agon",
    gist: "Sound and gathering — Show Thyself",
    door: "tonal",
  },
  mouseion: {
    id: "mouseion",
    name: "Mouseion",
    gist: "Research and learning",
    door: "studies",
  },
  adyton: {
    id: "adyton",
    name: "Adyton",
    gist: "Harm reduction — inward of Mouseion",
    door: null,
  },
  omphalos: {
    id: "omphalos",
    name: "Omphalos",
    gist: "Moment reading — the chord of now",
    door: null,
  },
  psyche: {
    id: "psyche",
    name: "Psyche",
    gist: "Your natal chord — private, on this device",
    door: "you",
  },
};

export const DOOR_TO_CHAMBER: Record<CompassDoor, ChamberId> = {
  sky: "aether",
  orrery: "heliodrome",
  tonal: "agon",
  studies: "mouseion",
  you: "psyche",
};

export function chamberForDoor(door: CompassDoor): ChamberDef {
  return CHAMBERS[DOOR_TO_CHAMBER[door]];
}

/** Short compass labels for the four cardinal buttons. */
export const COMPASS_DOOR_LABEL: Record<Exclude<CompassDoor, "you">, string> = {
  sky: CHAMBERS.aether.name,
  orrery: CHAMBERS.heliodrome.name,
  tonal: CHAMBERS.agon.name,
  studies: CHAMBERS.mouseion.name,
};
