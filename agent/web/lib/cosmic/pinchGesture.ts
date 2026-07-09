/**
 * Pinch-to-zoom + wheel gesture controller for canvas sky views.
 * Keeps scale in refs for 60 fps render loops (no React re-renders per frame).
 */

import { stepSpring } from "../motion/spring";

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 50;

export type PinchGestureOptions = {
  min?: number;
  max?: number;
  /** Wheel delta sensitivity (default 0.002). */
  wheelSensitivity?: number;
  onScaleChange?: (scale: number) => void;
};

export type PinchGestureController = {
  /** Smoothed scale for rendering (spring-interpolated). */
  getScale: () => number;
  /** Target scale from user input. */
  getTargetScale: () => number;
  setTargetScale: (s: number) => void;
  /** Advance spring physics; call once per animation frame. */
  tick: (dtSec: number) => void;
  attach: (el: HTMLElement) => void;
  detach: () => void;
};

function clampScale(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function touchDistance(touches: TouchList): number | null {
  if (touches.length < 2) return null;
  const dx = touches[0]!.clientX - touches[1]!.clientX;
  const dy = touches[0]!.clientY - touches[1]!.clientY;
  return Math.hypot(dx, dy);
}

export function createPinchGestureController(opts: PinchGestureOptions = {}): PinchGestureController {
  const min = opts.min ?? ZOOM_MIN;
  const max = opts.max ?? ZOOM_MAX;
  const wheelSens = opts.wheelSensitivity ?? 0.002;

  let target = 1;
  let value = 1;
  let velocity = 0;
  let pinchStartDist: number | null = null;
  let pinchStartScale = 1;
  let element: HTMLElement | null = null;

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * wheelSens);
    target = clampScale(target * factor, min, max);
    opts.onScaleChange?.(target);
  };

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length >= 2) {
      pinchStartDist = touchDistance(e.touches);
      pinchStartScale = target;
    }
  };

  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length < 2 || pinchStartDist == null) return;
    e.preventDefault();
    const d = touchDistance(e.touches);
    if (d == null || pinchStartDist <= 0) return;
    target = clampScale(pinchStartScale * (d / pinchStartDist), min, max);
    opts.onScaleChange?.(target);
  };

  const onTouchEnd = () => {
    if (pinchStartDist != null) pinchStartDist = null;
  };

  return {
    getScale: () => value,
    getTargetScale: () => target,
    setTargetScale(s) {
      target = clampScale(s, min, max);
      opts.onScaleChange?.(target);
    },
    tick(dtSec) {
      const step = stepSpring(value, velocity, target, dtSec, { stiffness: 88, damping: 20 });
      value = step.value;
      velocity = step.velocity;
    },
    attach(el) {
      if (element) this.detach();
      element = el;
      el.addEventListener("wheel", onWheel, { passive: false });
      el.addEventListener("touchstart", onTouchStart, { passive: true });
      el.addEventListener("touchmove", onTouchMove, { passive: false });
      el.addEventListener("touchend", onTouchEnd);
      el.addEventListener("touchcancel", onTouchEnd);
    },
    detach() {
      if (!element) return;
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("touchstart", onTouchStart);
      element.removeEventListener("touchmove", onTouchMove);
      element.removeEventListener("touchend", onTouchEnd);
      element.removeEventListener("touchcancel", onTouchEnd);
      element = null;
    },
  };
}
