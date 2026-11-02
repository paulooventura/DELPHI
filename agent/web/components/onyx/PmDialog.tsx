"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

export type PmDialogSize = "s" | "m" | "l";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The one dialog: a solid night panel with a thin gold keyline and a centred title band.
 * Widths S 320 / M 420 / L 560, always centred. Esc and the backdrop close it; focus stays inside.
 */
export function PmDialog({
  title,
  size = "m",
  onClose,
  children,
  footer,
  closeLabel = "Close",
  className,
}: {
  title: ReactNode;
  size?: PmDialogSize;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const panel = panelRef.current;
    const before = document.activeElement as HTMLElement | null;
    const first = panel?.querySelector<HTMLElement>(`.pm-dialog-body ${FOCUSABLE}`) ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const head = items[0];
      const tail = items[items.length - 1];
      if (e.shiftKey && document.activeElement === head) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault();
        head.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      before?.focus?.({ preventScroll: true });
    };
  }, []);

  return (
    <div className="pm-dialog-wrap" onClick={onClose}>
      <div
        ref={panelRef}
        className={`pm-dialog pm-dialog-${size}${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={e => e.stopPropagation()}
      >
        <PmDialogHead titleId={titleId} title={title} closeLabel={closeLabel} onClose={onClose} />
        <div className="pm-dialog-body">{children}</div>
        {footer && <div className="pm-dialog-foot">{footer}</div>}
      </div>
    </div>
  );
}

function PmDialogHead({
  titleId,
  title,
  sub,
  closeLabel,
  onClose,
}: {
  titleId: string;
  title: ReactNode;
  sub?: ReactNode;
  closeLabel: string;
  onClose?: () => void;
}) {
  return (
    <div className="pm-dialog-head">
      <span aria-hidden className="pm-dialog-head-spacer" />
      <div className="pm-dialog-head-text">
        <h2 id={titleId} className="pm-dialog-title">
          {title}
        </h2>
        {sub ? <p className="pm-dialog-sub">{sub}</p> : null}
      </div>
      {onClose ? (
        <button type="button" className="pm-dialog-close" aria-label={closeLabel} onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <path d="M2 2 L12 12 M12 2 L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      ) : (
        <span aria-hidden className="pm-dialog-head-spacer" />
      )}
    </div>
  );
}

/**
 * The same panel as PmDialog, without the backdrop: for cards that sit beside a live view the
 * person keeps touching (Orrery measurements, a cast reading in the page).
 */
export function PmPanel({
  title,
  sub,
  size = "m",
  onClose,
  closeLabel = "Close",
  children,
  footer,
  className,
  live,
}: {
  title: ReactNode;
  sub?: ReactNode;
  size?: PmDialogSize;
  onClose?: () => void;
  closeLabel?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  live?: boolean;
}) {
  const titleId = useId();
  return (
    <section
      className={`pm-dialog pm-panel pm-dialog-${size}${className ? ` ${className}` : ""}`}
      aria-labelledby={titleId}
      aria-live={live ? "polite" : undefined}
    >
      <PmDialogHead titleId={titleId} title={title} sub={sub} closeLabel={closeLabel} onClose={onClose} />
      {children ? <div className="pm-dialog-body">{children}</div> : null}
      {footer && <div className="pm-dialog-foot">{footer}</div>}
    </section>
  );
}
