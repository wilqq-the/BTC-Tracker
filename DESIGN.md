# BTC Tracker — Design System & UI Conventions

This document captures the visual language and the non-obvious rules behind it.
**Read this before building any new page, component, or widget** so new work stays
consistent. The system is implemented in `src/app/globals.css` (utilities + tokens)
and `tailwind.config.js` (shadow/animation/color tokens).

## 1. Direction

Premium **dark-fintech** with an authentic **Bitcoin gold** accent, in a macOS-style
**floating-panel** layout. Restraint over decoration: subtle motion, one consistent
material, real depth from light/shadow — not borders.

## 2. Layout: the floating shell

- The app is a fixed shell: `AppShell` (`src/components/AppShell.tsx`) renders the
  persistent `AppLayout` for every route **except `/auth/*`**. It lives in the root
  layout (`src/app/layout.tsx`) so it **never remounts on navigation** — the header,
  `PortfolioSidebar`, and footer stay mounted (no refetch/flicker between pages).
  **Pages must NOT render `<AppLayout>` themselves** — just return their content.
- `AppLayout` is a one-screen shell (`h-screen overflow-hidden`) with `p-3`/`gap-3`
  gutters. Header, sidebar, and footer are **floating rounded panels** (`.glass-float`
  + `rounded-2xl`) on one shared ambient **canvas** (the blurred gold/sky orb wash).
  The content area is **open canvas** (transparent, scrollable) — page cards float on it.
- **Page content starts flush** (`pt-0`) and uses the 12px rhythm (`px-3`, `gap-3`,
  `space-y-3`). Do **not** add page-level `p-6`/`max-w-[…] mx-auto`/`min-h-screen` or
  your own background — the shell owns gutters and the canvas.

## 3. The material system (the core rule)

Four unlayered utilities in `globals.css`. **Unlayered = they beat Tailwind utilities**
(`bg-card`, `border`, `shadow-*`, `rounded-*` colors) in the cascade. This matters (§5).

| Utility | Use for | Look |
|---|---|---|
| `.glass-float` | App chrome: header, sidebar, footer | Opaque frost `bg-card/0.72`, blur, rim highlight, `shadow-lg`. The floating panels. |
| `.glass-widget` | **Content cards** (it's baked into the base `<Card>`) + standalone card-like divs | Same frost, `shadow-md`, `border:0`. The elevated layer that floats on canvas. |
| `.glass` | Lighter nested cards **inside** the sidebar/panels | More translucent; has its own hover lift. |
| `.card-solid` | Escape hatch: a `<Card>` that must stay opaque (inside a modal, etc.) | Solid `bg-card` + real border + `shadow-sm`. Defined *after* `.glass-widget` so it wins. |

- **The base `<Card>` (`src/components/ui/card.tsx`) is `.glass-widget rounded-2xl`.**
  So every shadcn Card is automatically frosted glass. Use `<Card>` for content panels.
- Toolbars / header bars are plain `<div className="glass-widget rounded-2xl">` (no
  `data-slot="card"`) so they get the material but **not** the card hover (§6).

## 4. Encapsulated page header (pattern)

Every page opens with its title in its own toolbar bar, matching the dashboard.
**Title is text-only — no leading icon** (`text-xl font-semibold tracking-tight`).
In-page tab bars use `TabNavigation`, which is a glass segmented control with the
same gooey/ferrofluid sliding indicator as the header menu — reuse it, don't roll your own.

```tsx
<div className="px-3 pt-0 pb-6 space-y-3">
  <div className="glass-widget rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
    <h1 className="text-xl font-semibold tracking-tight">Title</h1>
    {/* optional actions on the right */}
  </div>
  {/* page content cards float below */}
</div>
```

## 5. Gotchas (these WILL bite you)

1. **`.glass-widget` sets `border:0`.** Colored-border utilities on a `<Card>`
   (`border-profit/20`, `border-btc-500/20`, `border-yellow-200`) only set border
   *color* with no width → **they become invisible.** To convey state, use a **bg tint**
   (`bg-profit/5`) or a gradient, not a border. (Plain `<div>`s still show borders.)
2. **Never put a `<Card>` inside a modal/`DialogContent`** as frosted glass — it's
   glass-on-glass with pointless backdrop-blur. Add `className="card-solid"` to those.
3. **Theme presets override `globals.css` at runtime.** `applyThemePreset()` in
   `src/lib/theme-presets.ts` injects CSS variables via `root.style.setProperty()`,
   overriding the `.dark` tokens. Editing `globals.css` colors alone won't change a
   selected preset — update the presets too.
4. **There are two legacy color systems — do not use them in new code:**
   - `ThemedCard` / `ThemedText` / `ThemedButton` and `.btc-*` CSS vars
     (`bg-btc-bg-secondary`, `text-btc-text-primary`, `border-btc-border-primary`) — dead.
     Use shadcn `Card`/`Button`/`Input` + standard tokens.
   - `btc-500` / `bitcoin` Tailwind colors — legacy gold. Use **`primary`** instead
     (the one Bitcoin gold). The only intentional exception: semantic chart bars.

## 6. Motion & hover

- Subtle and consistent. Cards (`[data-slot="card"]`) get a `translateY(-2px)` lift +
  `shadow-lg` on hover (defined unlayered in `globals.css`). Dashboard grid widgets get
  the lift from `.react-grid-item:hover` instead — card-lift is suppressed inside the
  grid to avoid double-transform. Toolbar `<div>`s don't react (not cards).
- The header page-nav uses a gooey "ferrofluid" sliding indicator (`Navigation.tsx`):
  a single gold highlight that stretches to span old+new positions then contracts.
- Keyframes: `animate-fadeIn`, `animate-fadeInUp` (in `tailwind.config.js`).
- **Always respect `prefers-reduced-motion`** — `globals.css` zeroes transitions/animations
  for it; don't reintroduce motion that ignores it.
- **Avoid layout shift from async data.** Reserve space for content that loads late
  (e.g. the header reserves a fixed-width slot + skeleton for the username, and always
  renders the theme toggle so it can't pop in). A shifting row also knocks the nav
  indicator out of alignment.

## 7. Color & type

- **Gold accent = `primary`** (HSL hue ~33). Use `text-primary`, `bg-primary/10`,
  `ring-primary`, etc. Semantic colors are kept: `profit` (green), `loss` (red),
  amber for "paused"/warning status, `destructive` (red) for danger.
- Tokens are HSL CSS vars in `globals.css` (`--background`, `--card`, `--primary`,
  `--border`, `--muted-foreground`, shadow vars `--shadow-sm/md/lg/glow`, `--aura`).
- Financial figures use **`tabular-nums`** (also on in `body` via font-feature-settings).
  Headings use `tracking-tight`. Radii: `rounded-2xl` for panels/cards, `rounded-xl`
  or `rounded-full` for small chips/pills/icon tiles.

## 8. Dialogs & feedback — no native `alert()`/`confirm()`

- **Toasts:** `import { toast } from '@/hooks/use-toast'` (the `<Toaster/>` is mounted in
  the root layout). Variants: `default`, `destructive`, `success`. Pattern:
  `toast({ title: 'Saved', variant: 'success' })` /
  `toast({ title: 'Failed to X', description: err, variant: 'destructive' })`.
- **Confirmations:** `import { confirm } from '@/components/ui/confirm-dialog'` — a
  styled, promise-based drop-in for `window.confirm`. Make the handler `async`:
  `if (!(await confirm({ title: 'Delete X?', description: '…', confirmText: 'Delete', destructive: true }))) return;`
  (`ConfirmDialogHost` is mounted once in the root layout.)

## 9. New-feature checklist

- [ ] Render content only — don't wrap in `<AppLayout>`.
- [ ] Outer wrapper `px-3 pt-0 pb-6 space-y-3`; no own padding/max-width/background.
- [ ] Title in an encapsulated `glass-widget rounded-2xl` toolbar.
- [ ] Use `<Card>` for content (auto-glass); convey state with bg tints, not borders.
- [ ] `card-solid` for any card inside a modal.
- [ ] Gold = `primary` (never `btc-500`/`bitcoin`/blue/purple); semantic green/red/amber kept.
- [ ] `tabular-nums` for figures, `tracking-tight` headings, `rounded-2xl` cards.
- [ ] `toast` + `confirm` instead of native dialogs.
- [ ] Reserve space for async-loaded content; respect reduced-motion.
