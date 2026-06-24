# DELPHI on pauloventura.org

The app is served at **https://delphi.pauloventura.org** (subdomain of your Wix site **https://www.pauloventura.org**).

## 1. Vercel — add the custom domain

1. Open [Vercel](https://vercel.com) → project **delphi** (`music-mecca-records/delphi`).
2. **Settings → Domains** → Add **`delphi.pauloventura.org`**.
3. Set **Root Directory** to `agent/web` if not already set.
4. Vercel will show the DNS record to create (usually a **CNAME**).

## 2. DNS (Wix or your registrar)

Where `pauloventura.org` DNS is managed (Wix Domains or external):

| Type  | Name    | Value                    |
|-------|---------|--------------------------|
| CNAME | `delphi` | `cname.vercel-dns.com` |

Remove or disable the old **GitHub Pages** mapping for `delphi.pauloventura.org` if it still points at `gh-pages` (it was a placeholder).

## 3. Wix — link to the app

On [www.pauloventura.org](https://www.pauloventura.org), add a menu button or banner:

- **Label:** DELPHI · Cosmic Clock  
- **URL:** `https://delphi.pauloventura.org`

## 4. Verify

After DNS propagates (minutes to a few hours):

- `https://delphi.pauloventura.org` loads the PWA.
- `https://delphi-wine.vercel.app` redirects to the custom domain.
- Add to Home Screen on iPhone — icon should open on `delphi.pauloventura.org`.

## Environment (optional)

In Vercel → **Settings → Environment Variables**:

```
NEXT_PUBLIC_SITE_URL=https://delphi.pauloventura.org
```
