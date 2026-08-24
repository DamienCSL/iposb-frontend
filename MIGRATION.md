# Frontend migration notes

## Why a new project

PHP FMS pages are tightly coupled to sessions and server-rendered HTML. A Vite SPA can:

- ship independently (S3 + CloudFront)
- share `/api` with Flutter
- be rewritten to Laravel Sanctum without moving PHP files

## Rules

- One capability per route (same as `Rbac.php`).
- New screens call JSON APIs only — no scraping PHP HTML.
- Until an API exists, show placeholder + legacy link.
- When Laravel lands, change `src/api/client.js` base URL / version prefix, not every page.

## Auth

| Now | Later |
|---|---|
| Demo users in `src/auth/rbac.js` | `POST /api/v1/auth/login` (staff) + Sanctum |

## Two apps

| Host | App |
|---|---|
| ops.iposb.com | this repo |
| www.iposb.com | future `iposb-portal` (public track + customer self-service) |
