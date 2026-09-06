"use client";

import { useState } from "react";
import { castArtSrcs, coinArtSrc, cowrieArtSrc } from "../../lib/cast/castArt";
import { symbolForCastEntry } from "../../lib/cast/realms";
import { CastSymbol, CoinFace } from "./CastSymbol";

export function CastArt({
  system,
  id,
  glyph,
  size = 168,
}: {
  system: string;
  id: string;
  glyph?: string;
  size?: number;
}) {
  const srcs = castArtSrcs(system, id);
  const [srcIndex, setSrcIndex] = useState(0);
  const spec = symbolForCastEntry(system, id, glyph);
  const src = srcs[srcIndex];

  if (src) {
    return (
      <img
        className="onyx-cast-art-img"
        src={src}
        alt=""
        width={size}
        height={size}
        onError={() => setSrcIndex(i => i + 1)}
      />
    );
  }
  return <CastSymbol spec={spec} size={size} />;
}

export function CastCoin({ yang, size = 56 }: { yang: boolean; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!failed) {
    return (
      <img
        className="onyx-coin-art"
        src={coinArtSrc(yang)}
        alt={yang ? "Yang coin" : "Yin coin"}
        width={size}
        height={size}
        onError={() => setFailed(true)}
      />
    );
  }
  return <CoinFace yang={yang} size={size} />;
}

export function CastCowrie({ open, size = 48 }: { open: boolean; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!failed) {
    return (
      <img
        className="onyx-cowrie-art"
        src={cowrieArtSrc(open)}
        alt={open ? "Cowrie mouth-up" : "Cowrie mouth-down"}
        width={size}
        height={size}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <CastSymbol
      spec={{ kind: "cowrie-emblem" }}
      size={size}
    />
  );
}
