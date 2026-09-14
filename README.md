# IPOSB FMS (office web)

React + Vite front end for IPOSB operations staff. Talks to **iposb-api** (Laravel).

## Requirements

- Node.js 18+ and npm

## Local development

```powershell
cd iposb-web
npm install
copy .env.example .env
npm run dev
```

Open http://localhost:5173 - API proxied to `http://127.0.0.1:8000` (start **iposb-api** first).

## Deploy to cPanel

| Guide | Use case |
|-------|----------|
| [docs/CPANEL_STRATAAIOPS.md](docs/CPANEL_STRATAAIOPS.md) | **iposb.strataaiops.com** - FMS-only build/upload |
| [docs/CPANEL_DEPLOYMENT.md](docs/CPANEL_DEPLOYMENT.md) | General cPanel static deploy |

**First-time full stack** (API + DB + FMS, no SSH): use `iposb-api/docs/CPANEL_STRATAAIOPS.md`.

```powershell
# FMS package only
$env:VITE_DISPATCH_KEY = "IPOSB_dispatch"
.\scripts\prepare-cpanel-deploy.ps1 -SingleHost "https://iposb.strataaiops.com" -Zip
```

Upload `deploy/cpanel/fms/` via cPanel File Manager.

## Demo login

Password **`admin123`** for all office demo users (when API has `032_demo_office_users.sql` applied). See iposb-api README for usernames.
