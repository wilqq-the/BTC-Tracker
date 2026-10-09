# BTC Tracker — Design System & UI Conventions

How the interface looks and the rules behind it. **Read this before building or
changing any page, component or widget.** Tokens live in `src/app/globals.css`
(CSS variables) and `tailwind.config.js` (radii, tints, animations).

## 1. Direction

Friendly, solid and calm. Solid cards on a warm grey canvas, generous radii,
Bitcoin orange used with intent, one typeface (Plus Jakarta Sans). Numbers are
the content — give them size and weight; keep everything around them quiet.

What we deliberately avoid (they make an app look templated):
- identical cards with icon tiles in a row ("stat card kit"), gradients as decoration;
- emoji in the UI — **use lucide-react icons instead**;
- ALL-CAPS labels, Title Case Labels, `A · B · C` meta strings, `→` appended to links;
- entrance animations on every card, hover lifts on things you can't click;
- showing the same number in several places on one screen.

## 2. Layout: the shell

- `AppShell` (root layout) renders the persistent `AppLayout` on every route except
  `/auth/*`, so the header and portfolio sidebar never remount. **Pages must not
  render `<AppLayout>`** — they return content only.
- `AppLayout`: header card on top, `PortfolioSidebar` on the left (hidden on
  Settings, where the settings menu takes that role), content area scrolls.
  Gutters are 16px (`p-4`, `gap-4`), 8px on phones.
- Page content: `space-y-4 pb-6`, no own padding / max-width / background.
- **No page title rows.** The header nav already shows where you are, and a title
  row would push the content below the sidebar's top edge. Every page starts with
  its first card (or its tab row) level with the sidebar. Page actions live inside
  that first card (e.g. Import/Export on the transactions summary row, Export tax
  report in the performance card); Settings puts the tab title and actions at the
  top of its content column, beside its own menu. Rare actions can sit under the
  content (dashboard "Customize dashboard").

## 3. Surfaces

| Class / component | Use | Look |
|---|---|---|
| `<Card>` (`.surface`) | every content panel | solid `bg-card`, `rounded-2xl` (24px), hairline edge + tiny shadow |
| `bg-secondary rounded-2xl` | nested tiles inside a card (stats, list groups) | soft grey, no border, no shadow |
| `bg-tint-*` + `text-tint-*-fg` | chips, badges, the one highlighted tile | soft tint with readable text |
| `.card-solid` | cards inside a modal | solid with a 1px border |

Radii: 24px cards, 16–20px inner tiles, `rounded-full` for buttons/chips/pills.
Legacy `.glass-float/.glass-widget/.glass` now map to the solid surfaces — don't use
them in new code.

## 4. Colour

- **Orange = `primary`** (`#F7931A`). Text on orange is dark (`primary-foreground`).
  Orange *text/icons* on light surfaces use **`text-primary-strong`** (readable).
  Use orange for the primary action, the active state and BTC amounts — not decoration.
- **Tints** (`tailwind.config.js` → `tint`): `orange`, `green/green-fg`, `red/red-fg`,
  `blue/blue-fg`, `purple/purple-fg`. Pair bg with its `-fg`.
- **Gains/losses:** positive `text-tint-green-fg`, negative `text-tint-red-fg`,
  **exactly zero `text-muted-foreground`** (never show €0 or "0 sells" in red).
  Always include the sign: `+€1,234` / `-€1,234` (`formatCurrency` drops the minus —
  add it yourself).
- Cold storage reads **blue**, hot wallets read **orange**. Render wallets with
  `<WalletTypeIcon type={wallet.type} />` (snowflake / flame), never the emoji.
- Theme presets in `src/lib/theme-presets.ts` override tokens at runtime; the
  default light/dark presets apply nothing (the CSS tokens *are* the default).

## 5. Type

- One family: **Plus Jakarta Sans** (`font-sans`, loaded in `app/layout.tsx`).
- Scale: 12 caption · 13 secondary · 14–15 body · 17 card title (`font-bold`) ·
  18 page title · 22–30 figures · 40–60 hero figures (`font-extrabold`, `tracking-tight`).
- Figures use `tabular-nums` (on by default via `body`). No monospace for numbers.
- Sentence case everywhere: "Add transaction", "No goals yet", "Export tax report".
- Labels are plain words in muted colour above the value — not uppercase, not tracked.

## 6. Copy

Plain, specific, from the user's side. A button says what happens ("Create a goal",
"Move to cold storage"). Empty states say what will appear and offer the action.
Errors say what happened and how to fix it. Join facts with words/commas, not `·`.

## 7. Motion

- **One orchestrated moment per page**, e.g. the dashboard hero: value counts up
  (`useCountUp`), chart draws in, P&L chip pops. Everything else appears at once
  (the grid fades in once).
- Motion that answers an action is welcome: sliding `SegmentedControl` pill,
  pressed buttons/tiles, the dragged widget being "picked up", modals opening.
- Cards don't lift on hover. Clickable tiles may (`hover:-translate-y-0.5`).
- Always respect `prefers-reduced-motion` (handled globally in `globals.css`).

## 8. Shared components (reuse them)

- `SegmentedControl` (`ui/segmented-control`) — any small exclusive choice (ranges, modes).
- `RingChart` (`ui/ring-chart`) — score rings and allocation donuts.
- `WidgetCard` (`ui/widget-card`) — dashboard widgets: text-only title, optional
  header link via `badge`, `WidgetEmptyState` for empty data.
- `WalletTypeIcon` (`ui/wallet-type-icon`) — wallet markers.
- `useCountUp`, `usePortfolioMetrics` (`src/hooks`), `emitTransactionsChanged` /
  `onTransactionsChanged` (`lib/app-events`) to refresh after adding a transaction.
- Feedback: `toast` (`@/hooks/use-toast`) and `confirm` (`@/components/ui/confirm-dialog`)
  — never native `alert()` / `confirm()`.

## 9. Accessibility & quality floor

- Visible keyboard focus (global orange `:focus-visible` ring) — don't remove outlines.
- Text contrast ≥ 4.5:1; real `<button>`/`<a>`; `aria-label` on icon-only buttons.
- Works at phone width: grids stack, tables scroll inside their card, touch targets ≥ 40px.
- Check light **and** dark before calling a UI change done.

## 10. Checklist for a new page or component

- [ ] Content only (no `<AppLayout>`), no title row, first card level with the sidebar, `space-y-4`.
- [ ] `<Card>` panels; tiles in `bg-secondary`; no gradients, no icon-tile stat rows.
- [ ] Orange only for primary action / active / BTC; zero values muted; signed money.
- [ ] Icons from lucide-react, no emoji; sentence case; no `·`/`→` tells.
- [ ] Reuse the shared components above; `tabular-nums` figures.
- [ ] One deliberate motion moment at most; reduced motion respected.
- [ ] Light + dark + phone checked.
