"use client";

import { PAULO_VENTURA_LINKS, SITE_URL, WIX_HOME } from "../lib/site";

/** Links back to the Paulo Ventura Wix hub + this app. */
export function PauloVenturaHub({ className = "" }: { className?: string }) {
  return (
    <section className={`cp-pv-hub${className ? ` ${className}` : ""}`}>
      <div className="cp-pv-hub-head">
        <h2 className="cp-pv-hub-title">Paulo Ventura</h2>
        <p className="cp-pv-hub-sub">
          DELPHI runs at{" "}
          <a href={SITE_URL} className="cp-pv-hub-link">
            delphi.pauloventura.org
          </a>
          {" · "}music &amp; art at{" "}
          <a href={WIX_HOME} className="cp-pv-hub-link" target="_blank" rel="noopener noreferrer">
            pauloventura.org
          </a>
        </p>
      </div>
      <div className="cp-pv-hub-grid">
        {PAULO_VENTURA_LINKS.map(link => (
          <a
            key={link.id}
            href={link.href}
            className="cp-pv-hub-tile"
            target={link.id === "home" ? undefined : "_blank"}
            rel={link.id === "home" ? undefined : "noopener noreferrer"}
          >
            <span className="cp-pv-hub-glyph" aria-hidden>{link.glyph}</span>
            <span className="cp-pv-hub-label">{link.label}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
