# IPOSB FMS — UI/UX Redesign Brief (Ant Design v5)

Use this document as the build spec. It covers the design language, information architecture, page-by-page specs, motion/loading rules, and technical setup for rebuilding the IPOSB Freight Management System frontend in Ant Design.

---

## 1. Context

IPOSB FMS is an internal, back-office logistics platform (order booking → hub sorting → dispatch → last-mile delivery → billing/COD/agent settlement). Users are ops staff, dispatchers, finance clerks, and admins — not consumers. The current React app is a 1:1 port of a legacy PHP menu structure: **46+ flat sidebar links**, no grouping, no filters, no visual hierarchy. Goal: consolidate into **6 primary modules**, modernize every screen, and make the whole app feel fast, calm, and purpose-built for daily operational use — not a generic admin template.

Audience is expert, repeat users doing high-volume data entry and lookups all day. Optimize for density, scan speed, and keyboard-friendly workflows over decorative polish.

---

## 2. Design Language

### 2.1 Principle
This is a **control-tower tool**, not a marketing SaaS product. Avoid the generic admin-template look (identical rounded white cards, one soft grey shadow on everything, gradient washes, all-caps eyebrow labels). Structure should come from typography, spacing, and status color — not from stacking cards.

### 2.2 Color tokens

| Token | Hex | Use |
|---|---|---|
| `colorPrimary` | `#1B8A5A` | Brand green (refined from the IPOSB logo, deeper/less neon than the current button green). Primary actions, active nav, focus states. |
| `colorBgLayout` | `#0F1B2D` | Deep slate-navy sidebar/shell background — replaces flat near-black. |
| `colorBgContainer` | `#FFFFFF` | Content surfaces. |
| `colorBgBase` (canvas) | `#F4F6F8` | Page background behind content surfaces. |
| `colorInfo` | `#1668DC` | In-transit / linehaul states. |
| `colorWarning` | `#D97706` | Awaiting pickup / pending / aging COD. |
| `colorSuccess` | `#1B8A5A` | Delivered / POD / reconciled. |
| `colorError` | `#D4380D` | Failed delivery / exceptions / import errors. |
| `colorTextSecondary` | `#5B6B7C` | Meta text, table sub-labels. |

Status colors are **semantic, not decorative** — they map directly to the SOP chain (see §4.3) so a user can scan a table and read shipment health from color alone.

### 2.3 Iconography
- **No 3D, skeuomorphic, or emoji-style icons anywhere** (sidebar, empty states, cards, buttons) — no gradients, drop shadows, or glossy bevels on icons. This is a control-tower tool, not a mobile app store.
- Use **Ant Design Icons** exclusively, in the `Outlined` variant for default states and `Filled` only for the active/selected state (e.g. sidebar item selected). Keep every icon the same stroke weight and optical size (default 14–16px inline, 18–20px in the sidebar).
- Icons are always paired with a text label in navigation — never icon-only nav items, except the collapsed icon rail.
- See §5.3 for the exact icon set and import syntax to use per module.

### 2.4 Typography
- UI font: **Inter** (or IBM Plex Sans) — swap out Ant's default to avoid the "default Ant Design" look. Set via `ConfigProvider` `token.fontFamily`.
- Monospace (**JetBrains Mono** or `ui-monospace`) for CN numbers, route codes, tracking IDs, driver UIDs — this is a legitimate functional use (fixed-width scanning of codes), not decoration.
- Type scale: 12 / 13 / 14 (base) / 16 / 20 / 24. Table body stays at 13px for density; page titles at 20–24px, weight 600.
- No all-caps labels anywhere except single-letter status chips where space is genuinely constrained.

### 2.5 Layout concept

```
┌───────────────┬─────────────────────────────────────────────┐
│  IPOSB        │  [breadcrumb]              [global search]  │
│  (collapsible)│───────────────────────────────────────────  │
│               │                                              │
│ [Inbox] Shipments │ Page title          [+ New] [Export]    │
│ [Car] Dispatch    │ ┌ tabs: All / Issues / Tracking ──────┐ │
│ [Cluster] Network │ │ filter bar (search, date range, ...)│ │
│ [Dollar] Finance  │ ├──────────────────────────────────────┤│
│ [Team] Agents     │ │  dense table, sticky header          ││
│ [Headset] Support │ │                                       ││
│ [Setting] Settings│ └──────────────────────────────────────┘ │
└───────────────┴─────────────────────────────────────────────┘
```

- Sidebar: **6 top-level items only**, dark slate, collapsible to icon rail. No nested always-visible sub-lists — clicking a module opens that module's page, which has its own internal tabs.
- Content area: light canvas, flat sectioning with hairline dividers (`colorSplit`) instead of nested cards. Use elevation (shadow) only for transient surfaces — modals, drawers, dropdowns — never for static page sections.
- Forms open in a **right-side Drawer** (create/edit) rather than navigating to a separate "Entry" page. This alone removes ~20 of the 46 legacy links (every `X Entry` page becomes a drawer on top of `X List`).
- Left-aligned text throughout; numeric/currency columns right-aligned in tables.

---

## 3. Information Architecture — 46 links → 6 modules

| # | Icon (`@ant-design/icons`) | Module (sidebar item) | Replaces | Internal structure |
|---|---|---|---|---|
| 1 | `InboxOutlined` | **Shipments** | Consignment Entry, List, Import Error Log, Tracking (4 links) | Tabs: `All` · `Issues` · `Tracking`. Search by CN number in top bar jumps straight to a shipment's timeline. `+ New Shipment` opens a Drawer form (with a "Bulk Import" secondary action for CSV). |
| 2 | `CarOutlined` | **Dispatch & Fleet** | Driver Assignment, Remote/3PL Pickup (2 links) | Split view: pending jobs list (left) + available drivers/3PL panel (right), with drag-to-assign or an "Assign" button per row. Driver Management (from your screenshot) becomes a tab here: `Jobs` · `Drivers` · `3PL Partners`. |
| 3 | `ClusterOutlined` | **Network & Analytics** | 9 Summary-by-X links + Hub/Branch/Drop Point admin | One dashboard: date-range picker + a single "Group by" dropdown (Status / Agent / Consignee / Shipper / Manifest / Branch / Date) driving one chart + one table. Export button. Hubs/Branches/Drop Points live under a `Network Setup` tab. |
| 4 | `DollarCircleOutlined` | **Finance & Billing** | 13 Billing links (Invoice/DO/Receipt/Credit-Debit Note × Entry/List/Tracking) + COD | Single table with type tabs: `Invoices` · `Delivery Orders` · `Receipts` · `Credit/Debit Notes` · `COD Reconciliation`. One `+ Create Document` button opens a Drawer whose fields adapt to the selected tab's document type. |
| 5 | `TeamOutlined` | **Agents** | 9 Agent Money In/Out links | Tab: `Overview` (balance cards, sparkline) + `Ledger` (single table with a Money In / Money Out filter toggle instead of separate menus). |
| 6 | `SettingOutlined` | **Settings & Masters** | 12 Admin links (Hubs, Branches, Drop Points, Coverage, Drivers registry, Users, RBAC, Routes) | One Settings page, left-hand sub-tab switcher (not sidebar items): `Branches` · `Hubs` · `Drop Points` · `Routes` · `Drivers` · `Users & Roles`. |

Standalone items keep their own icons: **Dashboard** → `DashboardOutlined` (landing page, KPI overview) and **Customer Service** → `CustomerServiceOutlined` (ticket list + detail), since both are already single-purpose.

Net result: sidebar goes from 46+ items to **8 items** (Dashboard, Shipments, Dispatch & Fleet, Network & Analytics, Finance & Billing, Agents, Support, Settings), each with 2–5 tabs instead of a wall of links.

---

## 4. Page Specs

### 4.1 Login page (redesign of current screenshot)
Current: centered white card on a flat mint gradient, plain Ant-default inputs, generic "Office login" helper text exposed to end users (debug info like `/api/ops/auth/login` and seeded passwords should never render in production UI).

Redesign:
- Split-screen layout: left 60% is a **brand panel** — deep slate `colorBgLayout` background with a subtle, single animated motif (e.g. a slow-moving dotted route line / map-pin path — one deliberate moment, not decorative noise) plus the IPOSB wordmark and a one-line value statement ("Track every shipment, end to end."). Right 40% is the login form on white.
- Form: floating labels or top-aligned labels (not placeholder-as-label), `Input.Password` with visibility toggle, primary button full-width, subtle `Form` validation with inline error text (no browser alerts).
- Remove all seed-credential/debug text from the rendered page. If needed for QA, gate it behind an env flag, not always-on copy.
- Micro-interaction: on submit, button shows Ant `loading` spinner state and the brand panel motif briefly pulses once — that's the one motion moment for this screen.

### 4.2 App shell
- Collapsible dark sidebar (`Layout.Sider`) with the 6 modules + icons, active item gets a left accent bar in `colorPrimary`, not a full color-block highlight.
- Top header: breadcrumb (auto-derived from route), global CN/tracking search (`Input.Search` with debounce), notifications bell, user avatar menu.
- Page transitions: content fades/slides up 8px over 150ms on route change — subtle, single treatment, respecting `prefers-reduced-motion`.

### 4.3 Shipment lifecycle as a real stepper
The SOP chain (BDE → ACC → PKU → ARR/SRT/GWD → INB/HUB → SHB → OFD → POD) is a genuine sequence, so this is the one place a numbered/stepped visual is justified. Use Ant `Steps` (or a compact custom horizontal tracker) inside the shipment detail Drawer/page:

```
BDE ──● ACC ──● PKU ──○ ARR/SRT/GWD ──○ INB/HUB ──○ SHB ──○ OFD ──○ POD
Order      Awaiting     Picked Up      Origin Hub      Linehaul     Station    Out for      Delivered
Confirmed  Pickup                                                                Delivery
```
Filled/colored steps = completed (green), current step pulses gently once on load, future steps stay neutral grey. Reuse this component in the tracking tab, the shipment detail view, and customer-facing tracking if applicable.

### 4.4 Generic list page pattern (applies to Drivers, Shipments, Billing docs, Agents ledger, etc.)
Replace the current raw `<table>` + top filter-row-of-inputs pattern (see Driver Management screenshot) with:

1. **Filter bar**: `Input.Search`, relevant `Select`s (e.g. Location, Route code), collapsed into a "More filters" popover if more than 4 fields — don't lay out every filter input permanently across the header.
2. **Action bar**: primary `+ New` button (opens Drawer), secondary actions (Export, Bulk import) as a `Dropdown` menu to avoid button clutter.
3. **Table** (`Table` / `ProTable` if using `@ant-design/pro-components`):
   - Sticky header, resizable/reorderable columns, row density toggle.
   - Status/route/location columns rendered as `Tag` with the semantic colors from §2.2, not plain text.
   - Row actions (Edit/Delete) collapsed into a `Dropdown` "···" menu once there are more than 2 actions, matching Ant conventions and avoiding a wall of buttons per row.
   - Pagination bottom-right, page size selector.
4. **Empty state**: when no rows, show an icon + one sentence explaining what the screen is for + the same `+ New` action — not a bare empty table.

### 4.5 Loading states
- **Skeleton screens**, not spinners, for anything with known layout: `Skeleton` matching the table's column/row shape on first load, `Skeleton.Avatar` + lines for cards.
- Spinners (`Spin`) only for actions with unknown duration (form submit, export generation) — shown inside the triggering button, not as a full-page overlay, unless it's an initial route load.
- Optimistic UI for quick actions (status toggles, marking POD) — update the row immediately, roll back with a toast if the request fails.
- Route-level: a thin top-of-page progress bar (like Nprogress) on navigation, instead of blanking the screen.

### 4.6 Motion rules (deliberate, not scattered)
- One orchestrated entrance per page (content fade/slide-up on load) — not a separate animation on every card/row.
- Drawers and modals slide/fade in using Ant's built-in motion — don't override with extra bounce/spring.
- Hover states: subtle background tint on table rows and sidebar items only; no shadow-pop or scale-up "SaaS card" hover effects.
- Status changes (e.g., a shipment moving to the next SOP step) animate the stepper fill — this is motion that shows what changed, which is the good kind.

---

## 5. Technical Setup (Ant Design v5)

```tsx
// theme.ts
import type { ThemeConfig } from 'antd';

export const iposbTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1B8A5A',
    colorInfo: '#1668DC',
    colorWarning: '#D97706',
    colorError: '#D4380D',
    colorSuccess: '#1B8A5A',
    colorBgLayout: '#0F1B2D',
    colorBgContainer: '#FFFFFF',
    fontFamily: "Inter, -apple-system, 'Segoe UI', sans-serif",
    borderRadius: 6,
    fontSize: 13,
  },
  components: {
    Layout: { siderBg: '#0F1B2D', headerBg: '#FFFFFF' },
    Menu: {
      darkItemBg: '#0F1B2D',
      darkItemSelectedBg: 'rgba(27,138,90,0.16)',
      darkItemColor: '#C7D2DB',
      darkItemSelectedColor: '#FFFFFF',
    },
    Table: { headerBg: '#F4F6F8', rowHoverBg: '#F0FBF6' },
  },
};
```

Recommended packages:
- `antd` v5 (theme via `ConfigProvider` as above)
- `@ant-design/pro-components` for `ProTable` / `ProForm` if you want built-in filter-bar + table wiring instead of hand-rolling it
- `@ant-design/icons` (see §5.3 below)
- Optional: `framer-motion` only for the login-panel motif and page-transition wrapper; everything else should lean on Ant's built-in motion to stay consistent

### 5.3 Iconography — implementation
Do not use 3D/skeuomorphic icon packs, emoji, or flat-color "sticker" icon sets anywhere in the app. Use **Ant Design Icons** only, MIT licensed ([github.com/ant-design/ant-design-icons](https://github.com/ant-design/ant-design-icons)), so every icon shares the same stroke weight, grid, and optical size as the rest of the Ant components.

Two equivalent ways to import them, pick one and stay consistent across the codebase:

**Option A — official package (recommended, already a peer dependency of `antd`):**
```tsx
import {
  InboxOutlined,
  CarOutlined,
  ClusterOutlined,
  DollarCircleOutlined,
  TeamOutlined,
  SettingOutlined,
  DashboardOutlined,
  CustomerServiceOutlined,
} from '@ant-design/icons';

<Menu.Item key="shipments" icon={<InboxOutlined />}>Shipments</Menu.Item>
```

**Option B — via `react-icons`' Ant Design set (`Ai` prefix), if the project already standardizes on `react-icons` for other icon families:**
```tsx
import {
  AiOutlineInbox,
  AiOutlineCar,
  AiOutlineCluster,
  AiOutlineDollarCircle,
  AiOutlineTeam,
  AiOutlineSetting,
  AiOutlineDashboard,
  AiOutlineCustomerService,
} from 'react-icons/ai';

<Menu.Item key="shipments" icon={<AiOutlineInbox />}>Shipments</Menu.Item>
```

Module → icon reference (Outlined for default, Filled for active/selected sidebar state):

| Module | `@ant-design/icons` | `react-icons/ai` equivalent |
|---|---|---|
| Dashboard | `DashboardOutlined` / `DashboardFilled` | `AiOutlineDashboard` / `AiFillDashboard` |
| Shipments | `InboxOutlined` / `InboxFilled` | `AiOutlineInbox` / `AiFillInbox` |
| Dispatch & Fleet | `CarOutlined` / `CarFilled` | `AiOutlineCar` / `AiFillCar` |
| Network & Analytics | `ClusterOutlined` | `AiOutlineCluster` |
| Finance & Billing | `DollarCircleOutlined` / `DollarCircleFilled` | `AiOutlineDollarCircle` / `AiFillDollarCircle` |
| Agents | `TeamOutlined` | `AiOutlineTeam` |
| Support | `CustomerServiceOutlined` | `AiOutlineCustomerService` |
| Settings & Masters | `SettingOutlined`/ `SettingFilled` | `AiOutlineSetting` / `AiFillSetting` |

Don't mix the two import sources for the same icon family within one screen — pick Option A or B project-wide so stroke widths stay consistent.

Suggested folder structure:
```
src/
  app-shell/         # Sider, Header, route transition wrapper
  modules/
    shipments/
    dispatch/
    network-analytics/
    finance-billing/
    agents/
    support/
    settings/
  components/
    StatusTag.tsx
    ShipmentStepper.tsx
    ListPageLayout.tsx   # shared filter-bar + action-bar + table + drawer shell
  theme.ts
```

`ListPageLayout` is the key reusable piece — every one of the 40+ collapsed legacy pages becomes a config object (columns, filters, create-form fields) passed into this one layout component, rather than a bespoke page each time.

---

## 6. Acceptance Checklist
- [ ] Sidebar reduced to 8 top-level items (6 modules + Dashboard + Support), no nested always-visible link lists
- [ ] Every "Entry" page converted to a Drawer/modal on its matching "List" page
- [ ] Every "Summary by X" page merged into one Analytics dashboard with a group-by control
- [ ] Status values rendered as color-coded `Tag`s tied to the SOP chain palette everywhere they appear
- [ ] Skeleton loading on all list/table pages; spinners only inside buttons or full-route loads
- [ ] One page-load motion treatment, applied consistently; respects `prefers-reduced-motion`
- [ ] Login page has no debug/seed-credential text visible to end users
- [ ] Shipment lifecycle rendered as a `Steps` tracker in shipment detail view
- [ ] Custom Ant theme tokens applied globally via `ConfigProvider` (no default Ant blue/font left in place)
- [ ] No 3D/skeuomorphic/emoji icons anywhere; all icons come from Ant Design Icons (`@ant-design/icons` or `react-icons/ai`), Outlined by default, Filled only for active/selected states