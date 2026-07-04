# Forgotten Letters — Design System conventions

**"The War Room at Night."** This is a **dark-only** design system: a near-black tinted
field, steel-blue instrument primary, and a rare oxblood-rust accent for destructive
intent. Every component assumes it sits on the dark field.

## Setup — render on the dark field (required)

There is **no provider or theme wrapper** — all theming is plain CSS custom properties
from the shipped stylesheet. But the components use near-white ink on transparent/dark
surfaces, so they are **unreadable on a light background**. Paint the app surface with
the DS background before placing components:

```jsx
import { Card, CardHeader, CardTitle, CardDescription, CardFooter, Badge, Button } from 'forgotten-letters';

// App shell: establish the dark field once.
<div style={{ background: 'var(--color-bg)', color: 'var(--color-ink)', minHeight: '100vh', fontFamily: 'var(--font-body)' }}>
  <Card interactive>
    <CardHeader>
      <Badge variant="accent">Official</Badge>
      <CardTitle>The Vörä Correspondence</CardTitle>
      <CardDescription>A night infiltration built around intercepted letters.</CardDescription>
    </CardHeader>
    <CardFooter>
      <Button variant="primary" size="sm">Open briefing</Button>
    </CardFooter>
  </Card>
</div>
```

## Styling idiom — Tailwind utilities backed by DS tokens

Components are styled with Tailwind classes that resolve to DS tokens. For your own
layout glue, prefer these **token-backed utilities** (they keep you on-brand):

| Purpose | Utilities |
|---|---|
| Surfaces (darkest → lightest) | `bg-bg`, `bg-surface`, `bg-elevated` |
| Ink | `text-ink` (primary), `text-muted` (secondary), `text-faint` (tertiary) |
| Borders | `border-border`, `border-border-strong` |
| Primary (steel-blue) | `bg-primary`, `text-primary`, `text-primary-ink`, `bg-primary-soft` |
| Accent (oxblood — destructive only) | `bg-accent`, `text-accent`, `bg-accent-soft` |
| Status | `text-success`, `text-warning`, `text-danger` |
| Radius | `rounded-[var(--radius-sm)]` (3px), `rounded-[var(--radius-md)]` (5px), `rounded-[var(--radius-lg)]` (8px) |
| Fonts | `font-display` (Oswald — headings), `font-mono` (JetBrains Mono — labels/badges). Body text (Inter) is the default — no class needed, or use `var(--font-body)` |

The same values are available as CSS variables for arbitrary styles:
`var(--color-bg | --color-surface | --color-elevated | --color-ink | --color-muted |
--color-primary | --color-accent | --color-border-strong)`, `var(--radius-md)`,
`var(--font-display | --font-body | --font-mono)`. Never hardcode hex — the palette is
OKLCH and tuned for contrast on the dark field.

## Component notes

- **Button** — `variant`: `primary` (default) · `secondary` · `outline` · `ghost` ·
  `link` · `danger` (oxblood, reserve for destructive actions). `size`: `sm|md|lg|icon`.
  Text is uppercase by design. Pass `asChild` to render a link as a button.
- **Card** — flat-field surface (tonal step + border, **no drop shadow**). Set
  `interactive` for hover-lift. Compose with the exported sub-parts **CardHeader,
  CardTitle, CardDescription, CardContent, CardFooter** (importable; not separate cards here).
- **Badge** — mono uppercase pill. `variant`: `default` · `neutral` · `accent` ·
  `success` · `warning`.
- **Tabs** — compound; compose **Tabs + TabsList + TabsTrigger + TabsContent** (all
  exported). `Tabs` takes `defaultValue`; each `TabsTrigger`/`TabsContent` takes `value`.
- **Input / Textarea / Label** — form primitives. Pair a `Label` (`htmlFor`) with a
  field; set `aria-invalid` on the field for the danger border.
- **Avatar** — initials from `name` (first two alphanumerics). `size`: `sm|md|lg`.
- **Skeleton** — tonal pulse (never a bright shimmer); size it via `className`/`style`.

## Where the truth lives

Read `styles.css` and its `@import`ed `_ds_bundle.css` for the full token + utility set,
and each component's `<Name>.d.ts` (props) and `<Name>.prompt.md` (usage) before styling.
