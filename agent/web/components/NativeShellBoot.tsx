"use client";

import { useEffect } from "react";
import { bootNativeShell } from "../lib/native/shell";

/** Status bar + opted-in sky alerts when running inside the iOS app; nothing in a browser. */
export function NativeShellBoot() {
  useEffect(() => {
    void bootNativeShell();
  }, []);
  return null;
}
