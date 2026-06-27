# DELPHI on pauloventura.org

The app is served at **https://delphi.pauloventura.org** (subdomain of your Wix site **https://www.pauloventura.org**).

**The app itself runs on Vercel.** Wix only owns the domain name and points the `delphi` subdomain at Vercel with DNS. Your main site stays on Wix; DELPHI stays on Vercel.

## 1. Vercel — project settings (fixes 404 NOT_FOUND)

Use **one** of these modes. Mixing them causes **404 NOT_FOUND** on every URL.

### Mode A — repo root (recommended for `delphi-wine.vercel.app`)

1. Open [Vercel](https://vercel.com) → project **delphi**.
2. **Settings → General → Root Directory** → **leave empty** (repo root `/`).
3. **Build & Development Settings** → turn **OFF** every override (Install, Build, Output, Development Command).  
   The repo root `vercel.json` supplies the commands.
4. **Deployments → Redeploy** latest `main`.

### Mode B — app subdirectory (alternative)

1. **Root Directory** → **`agent/web`** only.
2. **All build overrides OFF** — especially **Output Directory** (must stay empty; do **not** use `agent/web/.next`).
3. Redeploy.

If you set Root Directory to `agent/web` **and** Output Directory to `agent/web/.next`, Vercel looks in the wrong folder and every route returns **404 NOT_FOUND**.

## 2. Vercel — custom domain

1. **Settings → Domains** → Add **`delphi.pauloventura.org`** (optional until DNS is ready).
2. Copy the **exact CNAME value** Vercel shows — do not guess.

## 3. DNS at Wix (required — fixes “placeholder” / blank page)

**Wix** → **Domains** → **pauloventura.org** → **Manage DNS Records**

### Delete the old record

If you see a CNAME for **`delphi`** pointing at **`paulooventura.github.io`** (or any `github.io` host), **delete it**. That was an old GitHub Pages placeholder and is why the link shows a blank or “Site not found” page instead of the app.

### Add the Vercel record

| Type  | Host / Name | Value (from your Vercel Domains screen) |
|-------|-------------|-------------------------------------------|
| CNAME | `delphi`    | `3e5a4f8bbd18a872.vercel-dns-017.com`     |

Use the value **exactly** as shown in Vercel (yours may differ). Trailing dot is optional.

### Also check GitHub (optional cleanup)

If you ever added `delphi.pauloventura.org` under **GitHub** → repo **Settings → Pages → Custom domain**, remove it there too so nothing re-adds the old DNS.

## 3. Wix site — menu link

On [www.pauloventura.org](https://www.pauloventura.org), add a menu button or banner:

- **Label:** DELPHI · Cosmic Clock  
- **URL:** `https://delphi.pauloventura.org`

## 4. Verify

After DNS propagates (often 15–60 minutes, sometimes up to a few hours):

```text
nslookup delphi.pauloventura.org
```

Should **not** show `paulooventura.github.io`. It should resolve to Vercel (`vercel-dns` / Vercel edge).

Then:

- `https://delphi.pauloventura.org` loads the DELPHI PWA (same app as `delphi-wine.vercel.app`).
- In Vercel → Domains, `delphi.pauloventura.org` shows **Valid Configuration** (green).
- Add to Home Screen on iPhone — icon opens on `delphi.pauloventura.org`.

### Until DNS is fixed

The app is already live at **https://delphi-wine.vercel.app** — use that URL on Wix temporarily if needed.

## Troubleshooting: “placeholder” or GitHub Pages error

| Symptom | Cause | Fix |
|---------|--------|-----|
| Blank page, “Site not found”, GitHub styling | DNS still points `delphi` → `paulooventura.github.io` | Delete that CNAME in Wix; add Vercel CNAME (step 2) |
| Vercel shows “Invalid Configuration” | Wix DNS not updated yet | Add CNAME in Wix; wait; click Refresh in Vercel |
| Old UI / cache | Browser or CDN cache | Hard refresh; or open in private window |
| App works on `delphi-wine.vercel.app` but not custom domain | DNS only — Vercel deploy is fine | Fix Wix DNS as above |
| Build: *No Next.js version detected* | Root Directory is repo root, not `agent/web` | Vercel → Settings → General → Root Directory → **`agent/web`** → Redeploy |
| Build: `npm --prefix agent/web ci` exited with 1 | Stale install override or strict `npm ci` from repo root | Set Root Directory to **`agent/web`**, turn **off** Install Command override, redeploy |
| **404 NOT_FOUND** on `delphi-wine.vercel.app` | Output Directory override `agent/web/.next` with Root Directory already `agent/web` | Turn **off** Output Directory override; redeploy. Use `delphi-wine.vercel.app` until custom DNS works |
| Push to GitHub but site unchanged | Vercel Git not linked or deploy failed | Check Deployments tab; fix Root Directory; add GitHub `VERCEL_*` secrets |

## Environment (optional)

In Vercel → **Settings → Environment Variables**:

```
NEXT_PUBLIC_SITE_URL=https://delphi.pauloventura.org
```
