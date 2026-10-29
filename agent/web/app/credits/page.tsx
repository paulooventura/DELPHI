import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Credits & data · Pneuma Mundi",
  description: "The open data, software and type Pneuma Mundi is built on, and how to cite them.",
  alternates: { canonical: "/credits" },
};

const ODBL = "https://opendatacommons.org/licenses/odbl/1-0/";
const h2 = { fontSize: "1.05rem", margin: "2rem 0 0.5rem", color: "#e8e4f4", fontWeight: 500 } as const;

function Out({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>
      {children}
    </a>
  );
}

/** Text from Homebase staging/pneuma-launch/biz/CREDITS.md (Seal, T297). Keep the two in step. */
export default function CreditsPage() {
  return (
    <main
      style={{
        maxWidth: 680,
        margin: "0 auto",
        padding: "max(2.5rem, env(safe-area-inset-top)) 1.25rem calc(3rem + env(safe-area-inset-bottom))",
        color: "#b9b5cc",
        lineHeight: 1.6,
        fontSize: "0.95rem",
      }}
    >
      <p style={{ letterSpacing: "0.2em", fontSize: "0.7rem", textTransform: "uppercase" }}>Pneuma Mundi</p>
      <h1 style={{ fontSize: "1.6rem", color: "#f4f1ff", fontWeight: 400, margin: "0.25rem 0 0" }}>Credits &amp; data</h1>
      <p>Made by Paulo Ventura. Films, music, words and design by Paulo Ventura and his studio.</p>

      <h2 style={h2}>The sky and the solar system</h2>
      <ul>
        <li>
          Planets, Sun and Moon: computed on your phone with{" "}
          <Out href="https://github.com/cosinekitty/astronomy">astronomy-engine</Out> by Don Cross (MIT).
        </li>
        <li>
          Asteroids, comets, Kuiper belt, centaurs, moons and spacecraft paths:{" "}
          <Out href="https://ssd.jpl.nasa.gov/">NASA/JPL Solar System Dynamics</Out>, Small-Body Database and Horizons.
        </li>
        <li>Stars: Yale Bright Star Catalogue, 5th revised edition (Hoffleit &amp; Warren, 1991).</li>
        <li>
          Magnetic declination: <Out href="https://www.ncei.noaa.gov/products/world-magnetic-model">NOAA NCEI World Magnetic Model</Out>.
        </li>
      </ul>

      <h2 style={h2}>Earth orbit</h2>
      <ul>
        <li>
          Satellite and debris orbital elements: <Out href="https://celestrak.org/">CelesTrak</Out>, from US Space Force
          tracking data. Positions are propagated on your phone with SGP4 via{" "}
          <Out href="https://github.com/shashwatak/satellite-js">satellite.js</Out> (MIT).
        </li>
        <li>
          Land outline: <Out href="https://www.naturalearthdata.com/">Natural Earth</Out> (public domain).
        </li>
      </ul>

      <h2 style={h2}>The world map</h2>
      <ul>
        <li>
          Live aircraft and flight routes: contains information from <Out href="https://adsb.lol/">adsb.lol</Out>, made
          available under the <Out href={ODBL}>Open Database License (ODbL)</Out>. Thank you to the volunteers who feed
          it. Our aircraft feed is offered on the same ODbL terms.
        </li>
        <li>
          Map tiles: <Out href="https://openfreemap.org/">OpenFreeMap</Out> © <Out href="https://openmaptiles.org/">OpenMapTiles</Out>.
          Map data © <Out href="https://www.openstreetmap.org/copyright">OpenStreetMap</Out> contributors, under the{" "}
          <Out href={ODBL}>ODbL</Out>.
        </li>
        <li>
          Map rendering: <Out href="https://maplibre.org/">MapLibre GL JS</Out> (BSD-3-Clause).
        </li>
        <li>
          Seafloor: imagery reproduced from the <Out href="https://www.gebco.net/">GEBCO_2026 Grid</Out>, GEBCO
          Compilation Group (2026), doi:10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa.
        </li>
        <li>
          Wrecks: <Out href="https://encdirect.noaa.gov/">NOAA</Out> Electronic Navigational Charts (ENC Direct), US
          waters. <b>Not for navigation.</b>
        </li>
      </ul>

      <h2 style={h2}>Weather and places</h2>
      <ul>
        <li>
          Weather and place search: <Out href="https://open-meteo.com/">Open-Meteo</Out> (
          <Out href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</Out>).
        </li>
      </ul>

      <h2 style={h2}>Type</h2>
      <ul>
        <li>
          Bodoni Moda, Manrope and Geist Mono, under the{" "}
          <Out href="https://openfontlicense.org/open-font-license-official-text/">SIL Open Font License 1.1</Out>.
        </li>
      </ul>

      <h2 style={h2}>Open-source software</h2>
      <p>
        Pneuma Mundi is built with Next.js, React, Capacitor and many other open-source projects.{" "}
        <Link href="/credits/open-source" style={{ textDecoration: "underline" }}>
          Full list and licence texts
        </Link>
        .
      </p>

      <h2 style={h2}>Accuracy</h2>
      <p>
        Positions are computed from published data and can be off by minutes or kilometres, more so when data is old.
        Aircraft data comes from volunteers and can be missing or wrong. Nothing here is for navigation or safety
        decisions.
      </p>
      <p>Data sources don&apos;t endorse Pneuma Mundi. Thank you to every one of them.</p>

      <h2 style={h2}>Contact</h2>
      <p>
        Questions, corrections or a report about something you saw in the app:{" "}
        <a href="mailto:delphi@pauloventura.org" style={{ textDecoration: "underline" }}>
          delphi@pauloventura.org
        </a>
        .
      </p>

      <p style={{ marginTop: "2.5rem" }}>
        <Link href="/">← Back to Pneuma Mundi</Link> · <Link href="/privacy">Privacy</Link>
      </p>
    </main>
  );
}
