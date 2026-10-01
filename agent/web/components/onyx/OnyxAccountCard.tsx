"use client";

/**
 * Optional account on Psyche: email sign-in + encrypted backup of the chart,
 * held casts, and reading prefs. The app works fully without it.
 */

import { useCallback, useEffect, useState } from "react";
import { accountsEnabled, supabase } from "../../lib/vault/supabase";
import {
  createVault,
  deleteAccount,
  sendSignInCode,
  signOutHere,
  unlockVault,
  vaultStatus,
  verifySignInCode,
  type VaultStatus,
} from "../../lib/vault/sync";
import { trackEvent } from "../../lib/telemetry/client";

function when(iso: string | null): string {
  if (!iso) return "not yet";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function OnyxAccountCard() {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState("");
  const [shownKey, setShownKey] = useState<string | null>(null);
  const [savedIt, setSavedIt] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus(await vaultStatus());
  }, []);

  useEffect(() => {
    if (!accountsEnabled()) return;
    let alive = true;
    void vaultStatus().then(s => {
      if (alive) setStatus(s);
    });
    const sub = supabase()?.auth.onAuthStateChange(() => {
      void vaultStatus().then(s => {
        if (alive) setStatus(s);
      });
    });
    return () => {
      alive = false;
      sub?.data.subscription.unsubscribe();
    };
  }, []);

  if (!accountsEnabled() || !status || status.kind === "off") return null;

  const act = async (fn: () => Promise<string | null | void>) => {
    setBusy(true);
    setMsg(null);
    try {
      const err = await fn();
      if (err) setMsg(err);
    } catch {
      setMsg("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const headline =
    status.kind === "ready"
      ? "Backed up · encrypted"
      : status.kind === "locked"
        ? "Unlock this phone"
        : status.kind === "no-vault"
          ? "Turn on backup"
          : "Keep your chart across devices";

  return (
    <div className="onyx-account" data-pm-private>
      <button
        type="button"
        className="onyx-row"
        aria-expanded={open || !!shownKey}
        data-pm="account-toggle"
        onClick={() => setOpen(v => !v)}
      >
        <span>Account · {headline}</span>
        <span className="onyx-row-r">{open || shownKey ? "▴" : "▾"}</span>
      </button>

      {shownKey ? (
        <div className="onyx-account-body">
          <p className="onyx-eyebrow">YOUR RECOVERY KEY</p>
          <p className="onyx-account-key" aria-label="Recovery key">
            {shownKey}
          </p>
          <p className="onyx-layer-meta">
            This is the only key that opens your backup. Save it somewhere safe: a password manager, a
            screenshot, or on paper. It won&apos;t be shown again, and nobody (not even Pneuma Mundi) can
            recover it for you.
          </p>
          <div className="onyx-account-actions">
            <button
              type="button"
              className="onyx-ghost-btn"
              data-pm="account-copy-key"
              onClick={() => void navigator.clipboard?.writeText(shownKey).then(() => setMsg("Copied."))}
            >
              Copy
            </button>
          </div>
          <label className="onyx-check-row onyx-account-check">
            <input type="checkbox" checked={savedIt} onChange={e => setSavedIt(e.target.checked)} />
            I saved my recovery key
          </label>
          <button
            type="button"
            className="onyx-primary-btn"
            disabled={!savedIt}
            data-pm="account-key-saved"
            onClick={() => {
              setShownKey(null);
              setSavedIt(false);
              void refresh();
            }}
          >
            Done
          </button>
          {msg && <p className="onyx-account-msg">{msg}</p>}
        </div>
      ) : (
        open && (
          <div className="onyx-account-body">
            {status.kind === "signed-out" && (
              <>
                <p className="onyx-layer-meta">
                  Optional. Sign in with your email to back up your chart, held draws, and reading choices.
                  They&apos;re encrypted on this phone before they leave, with a key only you hold.
                </p>
                <form
                  className="onyx-form"
                  onSubmit={e => {
                    e.preventDefault();
                    if (!codeSent) {
                      void act(async () => {
                        const err = await sendSignInCode(email.trim().toLowerCase());
                        if (!err) {
                          setCodeSent(true);
                          trackEvent("account_code_sent");
                        }
                        return err;
                      });
                    } else {
                      void act(async () => {
                        const err = await verifySignInCode(email.trim().toLowerCase(), code);
                        if (!err) trackEvent("account_signed_in");
                        await refresh();
                        return err;
                      });
                    }
                  }}
                >
                  <label className="onyx-form-wide">
                    Email
                    <input
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      disabled={codeSent}
                      required
                    />
                  </label>
                  {codeSent && (
                    <label className="onyx-form-wide">
                      Code from the email (or just tap the link in it)
                      <input
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={code}
                        onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                        required
                      />
                    </label>
                  )}
                  <button type="submit" className="onyx-primary-btn" disabled={busy}>
                    {codeSent ? "Sign in" : "Email me a sign-in link"}
                  </button>
                  {codeSent && (
                    <button
                      type="button"
                      className="onyx-ghost-btn"
                      onClick={() => {
                        setCodeSent(false);
                        setCode("");
                      }}
                    >
                      Use a different email
                    </button>
                  )}
                </form>
              </>
            )}

            {status.kind === "no-vault" && (
              <>
                <p className="onyx-layer-meta">
                  Signed in as {status.email}. Turn on backup to encrypt what&apos;s on this phone and keep a copy
                  you can open on any device. You&apos;ll get a recovery key to save.
                </p>
                <button
                  type="button"
                  className="onyx-primary-btn"
                  disabled={busy}
                  data-pm="account-create-vault"
                  onClick={() =>
                    void act(async () => {
                      const key = await createVault();
                      trackEvent("vault_created");
                      setShownKey(key);
                    })
                  }
                >
                  Turn on encrypted backup
                </button>
              </>
            )}

            {status.kind === "locked" && (
              <>
                <p className="onyx-layer-meta">
                  Signed in as {status.email}. Your backup is locked on this phone. Enter the recovery key you
                  saved when you turned it on.
                </p>
                <form
                  className="onyx-form"
                  onSubmit={e => {
                    e.preventDefault();
                    void act(async () => {
                      const r = await unlockVault(recoveryInput);
                      if (!r.ok) return r.message;
                      trackEvent("vault_unlocked");
                      setRecoveryInput("");
                      await refresh();
                    });
                  }}
                >
                  <label className="onyx-form-wide">
                    Recovery key
                    <input
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      value={recoveryInput}
                      onChange={e => setRecoveryInput(e.target.value)}
                      placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                      required
                    />
                  </label>
                  <button type="submit" className="onyx-primary-btn" disabled={busy}>
                    Unlock
                  </button>
                </form>
                <p className="onyx-layer-meta">
                  Lost it? You can start a fresh backup from this phone instead. The old one can&apos;t be opened
                  and will be replaced.
                </p>
                <button
                  type="button"
                  className="onyx-ghost-btn"
                  disabled={busy}
                  data-pm="account-replace-vault"
                  onClick={() =>
                    void act(async () => {
                      const key = await createVault();
                      trackEvent("vault_replaced");
                      setShownKey(key);
                    })
                  }
                >
                  Start a fresh backup
                </button>
              </>
            )}

            {status.kind === "ready" && (
              <>
                <p className="onyx-layer-meta">
                  Signed in as {status.email}. Your chart, held draws, and reading choices are encrypted on this
                  phone and backed up. Last synced {when(status.syncedAt)}.
                </p>
                <div className="onyx-account-actions">
                  <button
                    type="button"
                    className="onyx-ghost-btn"
                    disabled={busy}
                    data-pm="account-new-key"
                    onClick={() =>
                      void act(async () => {
                        const key = await createVault();
                        trackEvent("vault_rekeyed");
                        setShownKey(key);
                      })
                    }
                  >
                    New recovery key
                  </button>
                  <button
                    type="button"
                    className="onyx-ghost-btn"
                    disabled={busy}
                    data-pm="account-sign-out"
                    onClick={() =>
                      void act(async () => {
                        await signOutHere();
                        await refresh();
                      })
                    }
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}

            {status.kind === "error" && <p className="onyx-account-msg">{status.message}</p>}

            {status.kind !== "signed-out" && (
              <div className="onyx-account-danger">
                {!confirmDelete ? (
                  <button
                    type="button"
                    className="onyx-ghost-btn"
                    data-pm="account-delete"
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete account
                  </button>
                ) : (
                  <>
                    <p className="onyx-layer-meta">
                      This deletes your account and the encrypted backup for good. What&apos;s on this phone stays
                      here.
                    </p>
                    <div className="onyx-account-actions">
                      <button
                        type="button"
                        className="onyx-ghost-btn"
                        disabled={busy}
                        data-pm="account-delete-confirm"
                        onClick={() =>
                          void act(async () => {
                            const err = await deleteAccount();
                            if (!err) {
                              trackEvent("account_deleted");
                              setConfirmDelete(false);
                              await refresh();
                            }
                            return err;
                          })
                        }
                      >
                        Yes, delete it
                      </button>
                      <button type="button" className="onyx-ghost-btn" onClick={() => setConfirmDelete(false)}>
                        Keep it
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {msg && <p className="onyx-account-msg">{msg}</p>}
          </div>
        )
      )}
    </div>
  );
}
