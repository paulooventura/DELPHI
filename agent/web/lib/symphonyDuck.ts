/**
 * Soft-duck flag while Aulos of Delphi is the lead vocal.
 * AudioBus ducks the Heliodrome chord channel a few dB (no hard cut).
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
