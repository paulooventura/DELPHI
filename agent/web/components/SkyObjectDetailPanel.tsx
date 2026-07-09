"use client";

export type SkyObjectDetail = {
  id: string;
  kind: string;
  name: string;
  az: number;
  alt: number;
  emoji: string;
  accent: string;
  lines: Array<{ label: string; value: string }>;
};

export function SkyObjectDetailPanel({
  detail,
  onClose,
}: {
  detail: SkyObjectDetail;
  onClose: () => void;
}) {
  return (
    <div className="cp-sky-object-panel" role="dialog" aria-label={`${detail.name} details`}>
      <div className="cp-sky-object-panel-backdrop" onClick={onClose} aria-hidden />
      <article
        className="cp-sky-object-panel-card"
        style={{ borderColor: `${detail.accent}55`, boxShadow: `0 20px 60px rgba(0,0,0,0.55), 0 0 40px ${detail.accent}18` }}
      >
        <header className="cp-sky-object-panel-header">
          <span className="cp-sky-object-panel-emoji" aria-hidden>{detail.emoji}</span>
          <div className="cp-sky-object-panel-title-wrap">
            <p className="cp-sky-object-panel-kind">{detail.kind}</p>
            <h3 className="cp-sky-object-panel-name">{detail.name}</h3>
          </div>
          <button type="button" className="cp-sky-object-panel-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="cp-sky-object-panel-coords">
          <span>{Math.round(detail.az)}° azimuth</span>
          <span>{Math.round(detail.alt)}° elevation</span>
        </div>

        <dl className="cp-sky-object-panel-facts">
          {detail.lines.map(line => (
            <div key={line.label} className="cp-sky-object-panel-fact">
              <dt>{line.label}</dt>
              <dd>{line.value}</dd>
            </div>
          ))}
        </dl>
      </article>
    </div>
  );
}
