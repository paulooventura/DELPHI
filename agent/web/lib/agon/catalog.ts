/**
 * Agon enrollment catalog: certifications, venue gear, backer visions, availability.
 * One data file (public/agon-catalog.json) feeds both the portal form and the server checks.
 */
import raw from "../../public/agon-catalog.json";

type Item = { id: string; label: string };
type Group = { group: string; items: Item[] };

export const CATALOG = raw as {
  version: number;
  certs: Group[];
  gear: Group[];
  vision: Item[];
  availability: { days: Item[]; slots: (Item & { hint: string })[]; notice: Item[]; radius: Item[] };
};

const flat = (groups: Group[]) => groups.flatMap((g) => g.items);
const labelMap = (items: Item[]) => new Map(items.map((i) => [i.id, i.label]));

export const CERT_LABEL = labelMap(flat(CATALOG.certs));
export const GEAR_LABEL = labelMap(flat(CATALOG.gear));
export const VISION_LABEL = labelMap(CATALOG.vision);
export const NOTICE_LABEL = labelMap(CATALOG.availability.notice);
export const RADIUS_LABEL = labelMap(CATALOG.availability.radius);
export const DAY_IDS = CATALOG.availability.days.map((d) => d.id);
export const SLOT_IDS = CATALOG.availability.slots.map((s) => s.id);

/** "fri-late" style keys for the availability grid. */
export function isSlotKey(v: string): boolean {
  const [d, s, extra] = v.split("-");
  return !extra && DAY_IDS.includes(d) && SLOT_IDS.includes(s);
}

/** Groups slot keys into a readable line: "Fri: evening, late · Sat: late". */
export function slotsLine(keys: string[]): string {
  const slotName = new Map(CATALOG.availability.slots.map((s) => [s.id, s.label.toLowerCase()]));
  return CATALOG.availability.days
    .map((d) => {
      const on = SLOT_IDS.filter((s) => keys.includes(`${d.id}-${s}`)).map((s) => slotName.get(s));
      return on.length ? `${d.label}: ${on.join(", ")}` : "";
    })
    .filter(Boolean)
    .join(" · ");
}
