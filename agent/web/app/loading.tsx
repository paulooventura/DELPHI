/** Instant black shell while the page chunk streams — never the old cp-launch chrome. */
export default function Loading() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        zIndex: 9999,
      }}
      aria-hidden
    />
  );
}
