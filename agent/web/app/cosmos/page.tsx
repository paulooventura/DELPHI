// ───────────────────────────────────────────────────────────────
// DELPHI · app/cosmos/page.tsx
// Route entry. Server component that renders the client shell.
// ───────────────────────────────────────────────────────────────

import CosmosShell from '@/components/CosmosShell';

export const metadata = {
  title: 'COSMOS · Cosmic Clock',
  description: 'Cross-cultural time synthesis, live sky, and the essence of the moment.',
};

// Lock to the device frame; no document scroll behind the app.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover' as const,
};

export default function CosmosPage() {
  return <CosmosShell />;
}
