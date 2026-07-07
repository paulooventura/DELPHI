"use client";

import type { ReactElement } from "react";

export type CosmicGraphicProps = {
  graphicKey: string;
  x: number;
  y: number;
  size: number;
  color: string;
  active?: boolean;
};

function g(
  key: string,
  x: number,
  y: number,
  size: number,
  color: string,
  active: boolean,
  children: ReactElement,
): ReactElement {
  const s = size * (active ? 1.08 : 1);
  const opacity = active ? 1 : 0.88;
  return (
    <g
      key={key}
      transform={`translate(${x - s / 2}, ${y - s / 2}) scale(${s / 24})`}
      opacity={opacity}
    >
      {children}
    </g>
  );
}

function LunarIcon({ phase, color }: { phase: string; color: string }) {
  const lit = color;
  const dark = "#1e293b";
  switch (phase) {
    case "new":
      return <circle cx={12} cy={12} r={9} fill={dark} stroke={lit} strokeWidth={1.2} />;
    case "waxing-crescent":
      return (
        <>
          <circle cx={12} cy={12} r={9} fill={dark} stroke={lit} strokeWidth={0.8} />
          <path d="M12 3 A9 9 0 0 1 12 21 A6 6 0 0 0 12 3" fill={lit} />
        </>
      );
    case "first-quarter":
      return (
        <>
          <circle cx={12} cy={12} r={9} fill={dark} stroke={lit} strokeWidth={0.8} />
          <path d="M12 3 A9 9 0 0 1 12 21 L12 3 Z" fill={lit} />
        </>
      );
    case "waxing-gibbous":
      return (
        <>
          <circle cx={12} cy={12} r={9} fill={lit} stroke={lit} strokeWidth={0.8} />
          <path d="M12 3 A9 9 0 0 0 12 21 A6 6 0 0 1 12 3" fill={dark} />
        </>
      );
    case "full":
      return <circle cx={12} cy={12} r={9} fill={lit} stroke="#fef3c7" strokeWidth={1} />;
    case "waning-gibbous":
      return (
        <>
          <circle cx={12} cy={12} r={9} fill={lit} stroke={lit} strokeWidth={0.8} />
          <path d="M12 3 A9 9 0 0 1 12 21 A6 6 0 0 0 12 3" fill={dark} />
        </>
      );
    case "last-quarter":
      return (
        <>
          <circle cx={12} cy={12} r={9} fill={dark} stroke={lit} strokeWidth={0.8} />
          <path d="M12 3 A9 9 0 0 0 12 21 L12 3 Z" fill={lit} />
        </>
      );
    default:
      return (
        <>
          <circle cx={12} cy={12} r={9} fill={dark} stroke={lit} strokeWidth={0.8} />
          <path d="M12 3 A9 9 0 0 0 12 21 A6 6 0 0 1 12 3" fill={lit} />
        </>
      );
  }
}

function SeasonIcon({ season, color }: { season: string; color: string }) {
  switch (season) {
    case "spring":
      return (
        <>
          <circle cx={12} cy={14} r={3} fill={color} />
          <path d="M12 4 C8 8 6 11 6 14 M12 4 C16 8 18 11 18 14" stroke={color} strokeWidth={1.4} fill="none" />
          <circle cx={8} cy={9} r={2} fill="#86efac" opacity={0.9} />
          <circle cx={16} cy={9} r={2} fill="#86efac" opacity={0.9} />
        </>
      );
    case "summer":
      return (
        <>
          <circle cx={12} cy={12} r={5} fill={color} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const a = (deg * Math.PI) / 180;
            return (
              <line
                key={deg}
                x1={12 + Math.cos(a) * 7}
                y1={12 + Math.sin(a) * 7}
                x2={12 + Math.cos(a) * 10}
                y2={12 + Math.sin(a) * 10}
                stroke={color}
                strokeWidth={1.3}
                strokeLinecap="round"
              />
            );
          })}
        </>
      );
    case "autumn":
      return (
        <path
          d="M12 4 C16 8 17 12 14 16 C12 19 8 18 7 14 C6 10 9 6 12 4 Z"
          fill={color}
          stroke="#9a3412"
          strokeWidth={0.8}
        />
      );
    default:
      return (
        <>
          <path d="M6 16 L18 16 L16 20 L8 20 Z" fill="#64748b" />
          <circle cx={9} cy={11} r={2.2} fill="#e2e8f0" />
          <circle cx={14} cy={9} r={2.5} fill="#f8fafc" />
          <circle cx={12} cy={13} r={2} fill="#cbd5e1" />
        </>
      );
  }
}

function ShiAnimalIcon({ animal, color }: { animal: string; color: string }) {
  const stroke = color;
  switch (animal) {
    case "zi":
      return <ellipse cx={12} cy={13} rx={6} ry={4} fill={stroke} opacity={0.35} stroke={stroke} strokeWidth={1} />;
    case "chou":
      return <path d="M6 14 Q12 6 18 14 L16 18 L8 18 Z" fill={stroke} opacity={0.4} stroke={stroke} />;
    case "yin":
      return <path d="M8 16 L10 8 L14 8 L16 16 M9 12 H15" stroke={stroke} strokeWidth={1.5} fill="none" />;
    case "mao":
      return <ellipse cx={12} cy={13} rx={4} ry={5} fill={stroke} opacity={0.35} stroke={stroke} />;
    case "chen":
      return <path d="M6 16 Q12 4 18 16" stroke={stroke} strokeWidth={1.6} fill="none" />;
    case "si":
      return <path d="M8 16 Q12 6 16 16" stroke={stroke} strokeWidth={1.5} fill="none" />;
    case "wu":
      return <path d="M7 16 L9 9 L15 9 L17 16 M8 13 H16" stroke={stroke} strokeWidth={1.3} fill="none" />;
    case "wei":
      return <circle cx={12} cy={14} r={5} fill={stroke} opacity={0.3} stroke={stroke} />;
    case "shen":
      return <circle cx={10} cy={11} r={3} fill={stroke} opacity={0.35} stroke={stroke} />;
    case "you":
      return <path d="M8 16 L12 7 L16 16 M10 13 H14" stroke={stroke} strokeWidth={1.3} fill="none" />;
    case "xu":
      return <ellipse cx={12} cy={13} rx={5} ry={4} fill={stroke} opacity={0.3} stroke={stroke} />;
    default:
      return <circle cx={12} cy={13} r={5} fill={stroke} opacity={0.35} stroke={stroke} />;
  }
}

function ZodiacIcon({ sign, color }: { sign: string; color: string }) {
  const paths: Record<string, string> = {
    aries: "M8 16 Q12 6 16 16 M10 12 H14",
    taurus: "M8 14 Q12 8 16 14 Q12 18 8 14",
    gemini: "M9 6 V16 M15 6 V16 M9 10 H15 M9 13 H15",
    cancer: "M8 14 Q12 8 16 14 Q12 18 8 14",
    leo: "M9 16 Q12 6 15 16 M11 12 H13",
    virgo: "M9 6 V16 M12 6 V16 M15 8 V16",
    libra: "M7 14 H17 M9 10 H15 M12 10 V16",
    scorpio: "M9 6 V16 M12 8 V16 M15 6 V16 M15 14 L17 16",
    sagittarius: "M8 16 L16 8 M13 8 H16 V11",
    capricorn: "M8 16 Q12 8 16 12 V16",
    aquarius: "M7 10 H17 M7 14 H17",
    pisces: "M8 8 Q12 14 8 20 M16 8 Q12 14 16 20",
  };
  return <path d={paths[sign] ?? paths.aries} stroke={color} strokeWidth={1.4} fill="none" strokeLinecap="round" />;
}

function TzolkinMedallion({ index, color }: { index: number; color: string }) {
  const label = ["Im", "Ik", "Ak", "Kn", "Ch", "Km", "Mn", "Lm", "Ml", "Ok", "Cn", "Eb", "Bn", "Ix", "Me", "Kb", "Kb", "Et", "Kw", "Aj"][index] ?? "Tz";
  return (
    <>
      <circle cx={12} cy={12} r={10} fill={`${color}55`} stroke={color} strokeWidth={1.2} />
      <text x={12} y={13} textAnchor="middle" fontSize={6} fill="#fef3c7" fontWeight={700}>
        {label}
      </text>
    </>
  );
}

function SexagenaryIcon({ alt, color }: { alt: boolean; color: string }) {
  return alt ? (
  <>
    <rect x={5} y={6} width={14} height={12} rx={2} fill="#7f1d1d" stroke={color} strokeWidth={1} />
    <text x={12} y={14} textAnchor="middle" fontSize={7} fill={color}>
      福
    </text>
  </>
  ) : (
  <>
    <circle cx={12} cy={12} r={9} fill="#14532d" stroke="#4ade80" strokeWidth={1} />
    <circle cx={12} cy={12} r={4} fill="#4ade80" opacity={0.7} />
  </>
  );
}

export function CosmicGraphicIcon({ graphicKey, x, y, size, color, active = false }: CosmicGraphicProps): ReactElement | null {
  const [kind, id] = graphicKey.split(":");
  const key = graphicKey;

  switch (kind) {
    case "lunar":
      return g(key, x, y, size, color, active, <LunarIcon phase={id!} color={color} />);
    case "season":
      return g(key, x, y, size, color, active, <SeasonIcon season={id!} color={color} />);
    case "shi":
      return g(key, x, y, size, color, active, <ShiAnimalIcon animal={id!} color={color} />);
    case "zodiac":
      return g(key, x, y, size, color, active, <ZodiacIcon sign={id!} color={color} />);
    case "tzolkin":
      return g(key, x, y, size, color, active, <TzolkinMedallion index={Number(id)} color={color} />);
    case "sexagenary":
      return g(key, x, y, size, color, active, <SexagenaryIcon alt={id === "alt"} color={color} />);
    default:
      return null;
  }
}

/** HTML/SVG hybrid for dashboard cards (larger display). */
export function CosmicGraphicBadge({
  graphicKey,
  color,
  active = true,
  className = "",
}: {
  graphicKey?: string;
  color: string;
  active?: boolean;
  className?: string;
}) {
  if (!graphicKey) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      width={44}
      height={44}
      role="img"
      aria-hidden
    >
      <CosmicGraphicIcon graphicKey={graphicKey} x={12} y={12} size={22} color={color} active={active} />
    </svg>
  );
}
