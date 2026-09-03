"use client";

export type ShareDest =
  | "copy"
  | "messages"
  | "email"
  | "facebook"
  | "x"
  | "whatsapp"
  | "more";

const LIVE = "https://delphi.pauloventura.org/";

export function destinationsFor(text: string): { id: ShareDest; label: string; href?: string }[] {
  const body = encodeURIComponent(text);
  const subj = encodeURIComponent("DELPHI");
  const page = encodeURIComponent(LIVE);
  const tweet = encodeURIComponent(`${text}\n${LIVE}`);
  const rows: { id: ShareDest; label: string; href?: string }[] = [
    { id: "copy", label: "Copy" },
    { id: "messages", label: "Messages", href: `sms:?&body=${body}` },
    { id: "email", label: "Email", href: `mailto:?subject=${subj}&body=${body}` },
    { id: "facebook", label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${page}&quote=${body}` },
    { id: "x", label: "X", href: `https://twitter.com/intent/tweet?text=${tweet}` },
    { id: "whatsapp", label: "WhatsApp", href: `https://wa.me/?text=${tweet}` },
  ];
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    rows.push({ id: "more", label: "More…" });
  }
  return rows;
}

export function OnyxShareSheet({
  text,
  onPick,
  onClose,
}: {
  text: string;
  onPick: (id: ShareDest) => void;
  onClose: () => void;
}) {
  const rows = destinationsFor(text);
  return (
    <div
      className="onyx-share-scrim"
      role="presentation"
      onPointerDown={e => {
        if (e.target === e.currentTarget) {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        className="onyx-share-sheet"
        role="dialog"
        aria-label="Share this reading"
        onPointerDown={e => e.stopPropagation()}
      >
        <p className="onyx-share-kicker">Share to</p>
        <div className="onyx-share-list">
          {rows.map(row => (
            <button
              key={row.id}
              type="button"
              className="onyx-share-row"
              onClick={() => onPick(row.id)}
            >
              {row.label}
            </button>
          ))}
        </div>
        <button type="button" className="onyx-share-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
