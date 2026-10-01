"use client";

import { useCallback, useEffect, useState } from "react";
import { accountsEnabled, supabase } from "../../lib/vault/supabase";
import { sendSignInCode, verifySignInCode } from "../../lib/vault/sync";
import type { UsageSummary } from "../../lib/telemetry/summary";

type Enrollment = {
  id: string;
  created_at: string;
  status: "pending" | "approved" | "rejected";
  kind: string;
  display_name: string;
  contact_email: string;
  phone: string;
  city: string;
  link: string;
  headline: string;
  about: string;
  details: string;
  source: string;
  notes: string;
};

const card = "rounded-2xl border border-white/10 bg-white/[0.03] p-5";
const btn = "rounded-full border border-white/20 px-4 py-1.5 text-sm hover:bg-white/10 disabled:opacity-40";
const input = "w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/40";

async function token(): Promise<string | null> {
  const { data } = (await supabase()?.auth.getSession()) ?? { data: { session: null } };
  return data.session?.access_token ?? null;
}

async function api<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: T | null }> {
  const t = await token();
  const res = await fetch(path, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    cache: "no-store",
  }).catch(() => null);
  if (!res) return { ok: false, status: 0, body: null };
  return { ok: res.ok, status: res.status, body: (await res.json().catch(() => null)) as T | null };
}

function Table({ title, rows }: { title: string; rows: { key: string; count: number }[] }) {
  return (
    <div className={card}>
      <h3 className="mb-3 text-xs uppercase tracking-[0.18em] text-white/50">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-white/40">No data yet</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {rows.map((r) => (
            <li key={r.key} className="flex justify-between gap-4">
              <span className="truncate text-white/80">{r.key}</span>
              <span className="tabular-nums text-white/50">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Usage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<UsageSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void api<{ summary: UsageSummary }>(`/api/admin/usage?days=${days}`).then((r) => {
      if (!alive) return;
      if (r.ok && r.body) {
        setData(r.body.summary);
        setErr(null);
      } else setErr("Couldn't load usage.");
    });
    return () => {
      alive = false;
    };
  }, [days]);

  if (err) return <p className="text-sm text-red-300">{err}</p>;
  if (!data) return <p className="text-sm text-white/40">Loading…</p>;

  const stats: [string, string][] = [
    ["Visitors", String(data.visitors)],
    ["Returning", String(data.returningVisitors)],
    ["Visits", String(data.visits)],
    ["Avg min / visit", data.avgMinutesPerVisit.toFixed(1)],
    ["Hours in app", data.totalHours.toFixed(1)],
    ["Taps", String(data.taps)],
  ];

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {[7, 30, 90].map((d) => (
          <button key={d} className={`${btn} ${d === days ? "bg-white/15" : ""}`} onClick={() => setDays(d)}>
            {d} days
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(([k, v]) => (
          <div key={k} className={card}>
            <div className="text-2xl font-light tabular-nums">{v}</div>
            <div className="mt-1 text-xs uppercase tracking-[0.14em] text-white/45">{k}</div>
          </div>
        ))}
      </div>
      <div className={card}>
        <h3 className="mb-3 text-xs uppercase tracking-[0.18em] text-white/50">Time per screen</h3>
        <ul className="space-y-2 text-sm">
          {data.screens.map((s) => (
            <li key={s.screen}>
              <div className="flex justify-between">
                <span className="capitalize text-white/80">{s.screen}</span>
                <span className="tabular-nums text-white/50">
                  {s.minutes.toFixed(1)} min · {(s.share * 100).toFixed(0)}%
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-white/5">
                <div className="h-1.5 rounded-full bg-white/40" style={{ width: `${Math.max(2, s.share * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Table title="Visits per day" rows={data.perDay.map((d) => ({ key: d.day, count: d.count }))} />
        <Table title="Most-tapped" rows={data.buttons} />
        <Table title="Feature events" rows={data.features} />
        <Table title="Who (?from= links)" rows={data.from} />
        <Table title="Came from" rows={data.referrers} />
        <Table title="Cities" rows={data.cities} />
        <Table title="Devices" rows={data.devices} />
      </div>
    </div>
  );
}

function Enrollments() {
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [rows, setRows] = useState<Enrollment[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ entries: Enrollment[] }>(`/api/admin/enrollments?status=${status}`);
    setRows(r.ok && r.body ? r.body.entries : []);
  }, [status]);

  useEffect(() => {
    let alive = true;
    void api<{ entries: Enrollment[] }>(`/api/admin/enrollments?status=${status}`).then((r) => {
      if (alive) setRows(r.ok && r.body ? r.body.entries : []);
    });
    return () => {
      alive = false;
    };
  }, [status]);

  const setRow = async (id: string, next: Enrollment["status"]) => {
    setBusy(id);
    await api("/api/admin/enrollments", { method: "PATCH", body: JSON.stringify({ id, status: next }) });
    setBusy(null);
    void load();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["pending", "approved", "rejected"] as const).map((s) => (
          <button key={s} className={`${btn} capitalize ${s === status ? "bg-white/15" : ""}`} onClick={() => setStatus(s)}>
            {s}
          </button>
        ))}
      </div>
      {!rows ? (
        <p className="text-sm text-white/40">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-white/40">Nothing {status}.</p>
      ) : (
        rows.map((r) => (
          <div key={r.id} className={card}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <span className="text-lg">{r.display_name}</span>
                <span className="ml-2 text-xs uppercase tracking-[0.14em] text-white/45">
                  {r.kind} · {r.city}
                </span>
              </div>
              <span className="text-xs text-white/40">{new Date(r.created_at).toLocaleString()}</span>
            </div>
            {r.headline && <p className="mt-1 text-sm text-white/70">{r.headline}</p>}
            <p className="mt-2 text-sm text-white/60">
              <a className="underline" href={`mailto:${r.contact_email}`}>
                {r.contact_email}
              </a>
              {r.phone && <> · {r.phone}</>}
              {r.link && (
                <>
                  {" · "}
                  <a className="underline" href={r.link} target="_blank" rel="noreferrer noopener">
                    link
                  </a>
                </>
              )}
              <span className="text-white/35"> · via {r.source}</span>
            </p>
            {r.about && <p className="mt-3 whitespace-pre-wrap text-sm text-white/75">{r.about}</p>}
            {r.details && <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-white/55">{r.details}</pre>}
            <div className="mt-4 flex gap-2">
              {r.status !== "approved" && (
                <button className={btn} disabled={busy === r.id} onClick={() => void setRow(r.id, "approved")}>
                  Approve
                </button>
              )}
              {r.status !== "rejected" && (
                <button className={btn} disabled={busy === r.id} onClick={() => void setRow(r.id, "rejected")}>
                  Reject
                </button>
              )}
              {r.status !== "pending" && (
                <button className={btn} disabled={busy === r.id} onClick={() => void setRow(r.id, "pending")}>
                  Back to pending
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

type Phase = "loading" | "signed-out" | "denied" | "ok";

async function resolvePhase(): Promise<Phase> {
  if (!(await token())) return "signed-out";
  const r = await api("/api/admin/enrollments?status=pending");
  return r.ok ? "ok" : "denied";
}

export default function AdminPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<"usage" | "agon">("usage");

  useEffect(() => {
    if (!accountsEnabled()) return;
    let alive = true;
    const run = () =>
      resolvePhase().then((p) => {
        if (alive) setPhase(p);
      });
    const sub = supabase()?.auth.onAuthStateChange(() => void run());
    void run();
    return () => {
      alive = false;
      sub?.data.subscription.unsubscribe();
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#07070a] px-5 py-8 text-white sm:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/40">Pneuma Mundi</p>
            <h1 className="text-2xl font-light">Admin</h1>
          </div>
          {phase === "ok" && (
            <div className="flex gap-2">
              <button className={`${btn} ${tab === "usage" ? "bg-white/15" : ""}`} onClick={() => setTab("usage")}>
                Usage
              </button>
              <button className={`${btn} ${tab === "agon" ? "bg-white/15" : ""}`} onClick={() => setTab("agon")}>
                Agon enrollments
              </button>
              <button className={btn} onClick={() => void supabase()?.auth.signOut()}>
                Sign out
              </button>
            </div>
          )}
        </header>

        {!accountsEnabled() && <p className="text-white/60">Supabase isn&apos;t configured on this deployment yet.</p>}
        {accountsEnabled() && phase === "loading" && <p className="text-white/40">Checking…</p>}
        {phase === "denied" && (
          <div className={card}>
            <p className="text-white/70">This account isn&apos;t on the admin list.</p>
            <button className={`${btn} mt-4`} onClick={() => void supabase()?.auth.signOut()}>
              Sign out
            </button>
          </div>
        )}
        {phase === "signed-out" && (
          <form
            className={`${card} max-w-sm space-y-3`}
            onSubmit={async (e) => {
              e.preventDefault();
              setMsg(null);
              const addr = email.trim().toLowerCase();
              const err = codeSent ? await verifySignInCode(addr, code) : await sendSignInCode(addr);
              if (err) setMsg(err);
              else if (!codeSent) setCodeSent(true);
            }}
          >
            <input className={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={codeSent} required />
            {codeSent && (
              <input className={input} inputMode="numeric" autoComplete="one-time-code" placeholder="Code from the email" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))} required />
            )}
            <button className={btn} type="submit">
              {codeSent ? "Sign in" : "Email me a code"}
            </button>
            {msg && <p className="text-sm text-red-300">{msg}</p>}
          </form>
        )}
        {phase === "ok" && (tab === "usage" ? <Usage /> : <Enrollments />)}
      </div>
    </main>
  );
}
