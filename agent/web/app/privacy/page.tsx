import type { Metadata } from "next";
import Link from "next/link";
import { WIX_HOME } from "../../lib/site";

export const metadata: Metadata = {
  title: "Privacy · Pneuma Mundi",
  description: "What Pneuma Mundi keeps on your device, what it sends, and how to delete it.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "29 October 2026";

const h2 = { fontSize: "1.05rem", margin: "2rem 0 0.5rem", color: "#e8e4f4", fontWeight: 500 } as const;

/** Keep this page true to the code: lib/lore/birthStore, lib/vault, public/pm-telemetry.js, lib/native/skyAlerts. */
export default function PrivacyPage() {
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
      <h1 style={{ fontSize: "1.6rem", color: "#f4f1ff", fontWeight: 400, margin: "0.25rem 0 0" }}>Privacy</h1>
      <p style={{ fontSize: "0.8rem" }}>Updated {UPDATED}. Applies to delphi.pauloventura.org and the Pneuma Mundi iOS app.</p>

      <p>
        No ads, no tracking across other apps or websites, and nothing is sold. Most of Pneuma Mundi runs on your
        device. Below is everything that leaves it.
      </p>

      <h2 style={h2}>Stays on your device</h2>
      <ul>
        <li>Your birth date, hour and place (Psyche), your casts and your preferences, stored in the app&apos;s local storage.</li>
        <li>Sky alerts: the place you save for alerts (rounded to about 1 km) and the alert schedule. Notifications are planned and delivered by your phone.</li>
        <li>The sky, orrery and clock math. Your live location is used on the device to draw your sky.</li>
        <li>For offline use: the satellite orbits last downloaded, and the map pieces you&apos;ve viewed (up to 60 MB; the oldest are dropped first).</li>
      </ul>

      <h2 style={h2}>Sent to our servers, used only to answer the request</h2>
      <ul>
        <li>Your location, when you open the live sky or the world map, so we can return the aircraft and satellites near you. We don&apos;t store it; our host may keep ordinary request logs for a short time.</li>
        <li>For the daily phrase: derived numbers (the &quot;axis math&quot;), never your birth data. These may be passed to an AI provider (Anthropic, OpenAI or Google) to word the phrase.</li>
        <li>
          Questions you type into the Research console, which go to research and AI providers (Anthropic, OpenAI,
          Google, Perplexity, Exa, Serper and Valyu) to find sources. The app asks your permission once before the
          first question is sent, and sends nothing else with it.
        </li>
      </ul>

      <h2 style={h2}>Sent to Open-Meteo, for weather and place names</h2>
      <ul>
        <li>
          Your device&apos;s coordinates go from your phone to Open-Meteo&apos;s geocoding service to name the place
          you&apos;re in.
        </li>
        <li>
          For the weather and cycles on the home screen, our server passes your coordinates to Open-Meteo&apos;s
          forecast service. We don&apos;t store them.
        </li>
        <li>City names you type into place search go from your device to Open-Meteo&apos;s geocoding service.</li>
        <li>
          Open-Meteo answers under its own{" "}
          <a href="https://open-meteo.com/en/terms">terms</a>.
        </li>
      </ul>

      <h2 style={h2}>Stored by us</h2>
      <ul>
        <li>
          <b>Anonymous usage counts</b>, to tune Pneuma: time per screen, taps on buttons (labels with digits blanked), named
          feature events, entry page, the site that sent you, device type, OS, browser, screen size, build, a random visitor
          id, and the approximate city, region and country our host derives from your IP address (the IP itself isn&apos;t
          kept). Never typed text or birth data; on Psyche only the names of buttons. Turn it off on a device with{" "}
          <b>Don&apos;t share</b> under About, or by opening{" "}
          <Link href="/?notrack=1">delphi.pauloventura.org/?notrack=1</Link>; anything not yet sent is dropped. Global
          Privacy Control is honoured.
        </li>
        <li>
          <b>In the iPhone app, usage counts are off</b> unless you choose <b>Share</b> under About. If you do, each
          session is counted on its own: no lasting visitor id, no city, region or country, no referring site. Choose{" "}
          <b>Don&apos;t share</b> any time; anything not yet sent is dropped. Every feature works the same either way.
        </li>
        <li>
          <b>An optional account</b> (email sign-in code) for encrypted backup. Your data is encrypted on your device before
          upload, with a key only your recovery key can open; we hold only the ciphertext and your email.
        </li>
        <li>
          <b>Agon enrollment</b>, only if you submit it: the name, contact details and notes you enter. Your public card shows
          only the fields marked public, after review.
        </li>
      </ul>
      <p>Providers: Vercel (hosting), Supabase (database and sign-in) and Google Sheets (usage and enrollment log).</p>

      <h2 style={h2}>Delete it</h2>
      <ul>
        <li>Account and backup: Psyche → your account card → Delete account. It removes the account and its encrypted backup at once.</li>
        <li>On-device data: clear it in Psyche, or delete the app (or clear this site&apos;s data in your browser).</li>
        <li>Sky alerts: Orrery → Alerts → turn them off or Forget place. Pending notifications are removed.</li>
      </ul>

      <h2 style={h2}>Children</h2>
      <p>Pneuma Mundi isn&apos;t directed at children under 13 and doesn&apos;t knowingly collect their data.</p>

      <h2 style={h2}>Contact</h2>
      <p>
        Questions, requests or a report about something you saw in the app:{" "}
        <a href="mailto:delphi@pauloventura.org">delphi@pauloventura.org</a>. More about the studio:{" "}
        <a href={WIX_HOME}>pauloventura.org</a>. If this policy changes, the date at the top changes with it.
      </p>

      <p style={{ marginTop: "2.5rem" }}>
        <Link href="/">← Back to Pneuma Mundi</Link>
      </p>
    </main>
  );
}
