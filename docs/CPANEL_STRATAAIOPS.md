# Deploy FMS to iposb.strataaiops.com

Static FMS only — **File Manager**, no server terminal.

For **first-time** deploy (API + database + FMS together), use **`iposb-api`** instead:

```powershell
cd "D:\iposb source code\iposb-api"
.\scripts\prepare-cpanel-deploy.ps1 -SingleHost "https://iposb.strataaiops.com" -Zip
```

Use **this** guide when you only need to build/upload the **web UI** (updates or separate FMS hosting).

---

## Build on your PC

```powershell
cd "D:\iposb source code\iposb-web"

$env:VITE_DISPATCH_KEY = "IPOSB_dispatch"

# API on same host at /api (typical for strataaiops combined setup)
.\scripts\prepare-cpanel-deploy.ps1 `
  -SingleHost "https://iposb.strataaiops.com" `
  -Zip
```

Output: `deploy/cpanel/fms/` and optional `deploy/cpanel-fms-*.zip`

---

## Where to upload

| Your setup | Upload target |
|--------------|---------------|
| **Combined** (API repo deploy) | `~/iposb-api/public/` — overwrite `index.html`, `assets/`, keep `index.php` and combined `.htaccess` |
| **FMS-only** on subdomain | `public_html` (or subdomain doc root) for `iposb.strataaiops.com` |

### Combined update (most common)

Upload **only** from `deploy/cpanel/fms/`:

- `index.html`
- `assets/` (replace entire folder)
- Do **not** replace `index.php` or the combined `.htaccess` in `public/`

### FMS-only hosting

Upload **everything** in `deploy/cpanel/fms/` including `.htaccess`.

---

## Verify

1. Open `https://iposb.strataaiops.com`
2. Log in — `admin` / `admin123` if demo users exist on API
3. DevTools → Network — requests go to `/api/...` and return 200

---

## Env template

`.env.cpanel.strataaiops.example`:

```
VITE_API_URL=/api
VITE_DISPATCH_KEY=IPOSB_dispatch
```

Copy to `.env.production.local` if building manually with `npm run build:production`.
