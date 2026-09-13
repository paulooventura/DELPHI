/**
 * Soft-duck the Omphalos symphony bed while Aulos of Delphi is the lead vocal.
 */

type Listener = (ducked: boolean) => void;

let ducked = false;
const listeners = new Set<Listener>();

export function isSymphonyDucked(): boolean {
  return ducked;
}

export function setSymphonyDucked(next: boolean): void {
  if (ducked === next) return;
  ducked = next;
  listeners.forEach(fn => fn(ducked));
}

export function subscribeSymphonyDuck(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
