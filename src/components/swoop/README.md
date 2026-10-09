# Swoop design system v1 (locked 2026-10-09)

Uber's structure with Swoop's attitude. **Mini and dense**, white ground, royal blue for action, ink for weight, real photos.
Reference canvas: https://claude.ai/artifact/5UR1mJqa6t4eoLnuJYRg8h (Home, Marketplace, logo, design system boards).

## Tokens (Tailwind classes — defined in `app/globals.css`)
| Role | Class | Hex |
|---|---|---|
| Primary / action / active tab | `bg-royal` `text-royal` | #0055FF |
| Selected state fill | `bg-royal-tint` | #E8EFFF |
| Royal on dark (sparks, icons on ink) | `text-royal-soft` | #6E9BFF |
| Text, dock, logo tape | `text-ink` `bg-ink` | #101828 |
| Ground / cards | `bg-white` | #FFFFFF |
| Tiles, search, chips, inputs | `bg-surface` | #F2F3F5 |
| Dividers, card edges | `border-line` | #EEF0F3 |
| Secondary text | `text-slate` (meta) · `text-text-secondary` (#52525B, body-ish) | #71717A |
| Open / ready | `bg-go` `text-go-text` `bg-go-tint` | #22C55E / #15803D / #DCFCE7 |
| Category accents | `text-canteen bg-canteen-tint` · `text-market bg-market-tint` · `text-girls bg-girls-tint` | |
| Illustration only | `cream` | #FCF6B1 |

No gradients. No cream outside illustrations. No emoji. Replace old palette: `#F4F5F7`/`bg-[#F4F5F7]` → `bg-white` (screens) or `bg-surface` (tiles); `zinc-*`/`slate-*`/`gray-*` text → `text-slate` / `text-text-secondary`; `blue-*` → `royal`; `bg-cream` chips → `bg-surface`/`bg-royal-tint`; `rounded-[20px+]` → `rounded-[14px]`.

## Type
- `font-sans` (default): **Figtree** for body, labels and buttons. Sizes 10–13px. Row titles `text-[12.5px] font-bold`, meta `text-[11px]–[11.5px] text-slate`.
- `font-heading`: **Bricolage Grotesque 700, 88% width**, headings only. Page title **16px**, section and tile title **14.5px**, item title (shop/listing name) **12.5px**. App headings never go above 16px (one exception: a single hero number like a pickup code).
- Caps tags: `text-[8.5px]–[9.5px] font-extrabold uppercase tracking-[0.06em]` (use `<Tag>`).
- `font-logo`: Archivo Black Italic, **logo and SOLD tape only**.
- Retired: `font-quinn`, `font-poster`, `font-coolvetica` (temporarily aliased). Migrate to `font-heading` / `font-sans`. Uppercase poster headlines become sentence case.

## Shape & density
Radii: `rounded-full` pills · `rounded-[14px]` cards/tiles · `rounded-[12px]` small tiles/listing photos · `rounded-[10px]` thumbs/buttons · 9 dock.
Screen gutter `px-3` (12px). Gaps `gap-1.5`/`gap-2`. Sections separated by `pt-3`–`pt-3.5`. Rows 48px, search 40–42px, chips 26px, buttons 32–40px.

## Icons
`@/components/swoop/icons`: filled duotone (solid + 32% layer), `currentColor`, 20–24px in UI. Replace `lucide-react` in student UI.
If something is missing, add it to your feature folder (e.g. `src/components/upload/icons.tsx`) using the same pattern. Don't edit the shared file, because other people are working in parallel.

## Components (`@/components/swoop/primitives`, `@/components/swoop/Logo`)
`swButton({variant: primary|ink|surface|white|ghost|danger, size: sm|md|lg|pill|icon})` (cva class helper) ·
`SectionHeader` (title + optional kicker + "See all") · `PageHeader` (back · kicker/title · actions; for sub-screens) · `IconButton` (round surface) ·
`SearchPill` (`big` for the Home "What do you need?") · `Chip` (ink when selected) · `Segmented` · `Tag` · `StatusLine` (● Open • Ready by …) ·
`IconTile` · `ListRow` (inset divider) · `ServiceTile` (royal or surface, 74px) · `SmallTile` (icon tile + label below) · `EmptyState` · `Card` ·
`SwoopLogo` (tape, never rotate) · `TapeStrip` (**only** for SOLD across a sold listing).

## Shell (already done, don't re-implement)
- `RootShell` renders the app header (`SwoopNavbar`: logo, campus chip, inbox, account) on every student screen except `/marketplace*`, `/girls-space*` and `/upload*`. Those screens render their own `PageHeader`.
- The **Dock** (live slot + 5 tabs: Home, Print, Market, Housing, Orders) is global and fixed, and the shell adds the bottom spacer. **Remove page-level bottom navs and big bottom paddings** (`pb-24`/`pb-28` etc.). Keep normal content padding (~`pb-3`).
- `useDockSlot({ id, title, subtitle, tone: 'go'|'royal'|'white', icon, action: { label, href } })` from `@/lib/stores/dockStore` shows a contextual ink bar above the tabs while your screen is mounted (e.g. Market: "Got something to sell?" → Post). Use it only where there's one obvious action or live status.
- `useHideDock()`: for screens that own a sticky bottom bar (checkout, forms with submit bars).

## Rules
1. Presentation only. **Don't change data fetching, API calls, routes, stores, business logic or props contracts** used by other files.
2. Dense, not cramped: fit more, and keep hierarchy through weight and colour, not size.
3. Tape is the logo, not a UI pattern. The only in-product tape is SOLD.
4. Real photos when data has them. Otherwise a `bg-surface` tile with a duotone icon.
5. Accessibility: real `<button>`/`<Link>`, `aria-label` on icon-only buttons, text contrast ≥ 4.5:1 (use `text-slate`, never lighter, for readable text).
