# Deploy IPOSB FMS to cPanel (static site)

The FMS is a **Vite + React** app. On cPanel you upload the **built** `dist/` output only — no Node.js on the server.

## Two deployment modes

| Mode | When to use | Build from |
|------|-------------|------------|
| **Combined** (recommended for strataaiops) | FMS + API on `iposb.strataaiops.com` | `iposb-api` → `prepare-cpanel-deploy.ps1 -SingleHost` |
| **FMS only** (this repo) | Update the web UI, or API is already live elsewhere | `iposb-web` → `scripts/prepare-cpanel-deploy.ps1` |

---

## Quick build (strataaiops.com)

### Same host as API (`/api`)

Use when the Laravel API is on the same domain (combined deploy or API at `/api`):

```powershell
cd "D:\iposb source code\iposb-web"

$env:VITE_DISPATCH_KEY = "same-as-api-DISPATCH_API_KEY"

.\scripts\prepare-cpanel-deploy.ps1 `
  -SingleHost "https://iposb.strataaiops.com" `
  -Zip
```

Upload `deploy/cpanel/fms/*` → only needed when updating the UI in a **combined** Laravel `public/` folder, or if your host serves FMS separately with API proxied on the same host.

### Separate API subdomain

```powershell
$env:VITE_DISPATCH_KEY = "same-as-api-DISPATCH_API_KEY"

.\scripts\prepare-cpanel-deploy.ps1 `
  -FmsUrl "https://iposb.strataaiops.com" `
  -ApiUrl "https://api.iposb.strataaiops.com" `
  -Zip
```

Upload `deploy/cpanel/fms/*` → **document root** for `iposb.strataaiops.com` (usually `public_html`).

---

## cPanel upload (no terminal)

1. **File Manager** → open FMS document root (`public_html` or subdomain folder)
2. Upload contents of `deploy/cpanel/fms/`:
   - `index.html`
   - `assets/`
   - `.htaccess` ← required for React routes
   - `favicon.svg`, `icons.svg`
3. **SSL** — enable AutoSSL for the domain
4. Test `https://your-fms-domain/` and log in

---

## Environment variables (build time)

Set before `npm run build` or in `.env.production.local`:

| Variable | Example | Purpose |
|----------|---------|---------|
| `VITE_API_URL` | `/api` or `https://api.example.com/api` | Laravel JSON API base |
| `VITE_DISPATCH_KEY` | long random string | Must match API `DISPATCH_API_KEY` |

Templates:

- `.env.cpanel.example` — generic
- `.env.cpanel.strataaiops.example` — `iposb.strataaiops.com` + `/api`

Copy to `.env.production.local` and run:

```powershell
npm run build:production
```

Or use `-UseEnvFile` with the prepare script:

```powershell
.\scripts\prepare-cpanel-deploy.ps1 -UseEnvFile -Zip
```

---

## Local development

```powershell
npm install
npm run dev
```

Uses Vite proxy `/api` → `http://127.0.0.1:8000` (see `.env.example`).

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Login fails / network errors | Wrong `VITE_API_URL` at build time — rebuild with correct API URL |
| CORS errors | API must allow your FMS origin; check API is reachable |
| 404 on page refresh | `.htaccess` missing from upload; enable `mod_rewrite` |
| Blank page | Upload `assets/` folder; check browser console |

---

## Related

- Full stack (API + DB, no SSH): `iposb-api/docs/CPANEL_STRATAAIOPS.md`
- Strata AI Ops FMS-only details: [CPANEL_STRATAAIOPS.md](CPANEL_STRATAAIOPS.md)
