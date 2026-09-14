/**
 * Heliodrome lane voice — which cycles feed the NOW-Chord.
 * Orrery picker (scientific / cultural / mystical + per-lane toggles) writes here;
 * the app-wide chord ticker reads it so audio matches the visible lanes.
 */

import type { OrreryLaneId, OrreryLaneState } from "./lore/orreryLanes";

let hidden = new Set<OrreryLaneId>();

export function setHeliodromeHiddenLanes(ids: Iterable<OrreryLaneId>): void {
  hidden = new Set(ids);
}

export function getHeliodromeHiddenLanes(): ReadonlySet<OrreryLaneId> {
  return hidden;
}

/** Lanes that should ring in the NOW-Chord (respects Heliodrome picker). */
export function audibleHeliodromeLanes(lanes: OrreryLaneState[]): OrreryLaneState[] {
  return lanes.filter(l => l.id !== "wuku-tzolkin" && !hidden.has(l.id));
}
