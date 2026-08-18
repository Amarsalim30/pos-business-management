# Design System: Modern POS & Business Management

> Single source of truth for POS UI tokens, typography, component behaviors, and layout rules.
> Focused on a **clean, light/white-token foundation** for high-efficiency cashier & owner workflows in bright retail store environments.

---

## 1. Visual Atmosphere & Philosophy

- **Vibe:** Clean, clinical, modern, high-contrast, distraction-free retail counter system.
- **Density:** High-Efficiency (Cockpit: 7.5/10) — fast scanning of product rows, clear prices, crisp numeric readouts, zero unnecessary ornamentation.
- **Tone:** Premium European industrial / Swiss-inspired light interface. Ultra-crisp borders, warm paper/slate backgrounds, pure white cards, and amber-gold accent for actionable triggers.
- **Motion:** Subtle, tactile feedback (100–150ms spring transitions, no lagging animations that slow down cashier keystrokes).

---

## 2. Color Palette & Semantic Tokens (White / Light Theme)

### Surface & Canvas Tokens
- **Canvas Base (`bg-canvas`):** `#F8FAFC` (Slate-50) — Soft, eye-resting neutral foundation.
- **Card / Panel Surface (`bg-surface`):** `#FFFFFF` (Pure White) — Elevated work surfaces, POS receipt tables, modal dialogs.
- **Subtle Row Fill (`bg-subtle`):** `#F1F5F9` (Slate-100) — Alternating table rows, input backgrounds, disabled chips.
- **Border Subtle (`border-subtle`):** `#E2E8F0` (Slate-200) — 1px crisp structural dividers.
- **Border Focused (`border-focus`):** `#0F172A` (Slate-900) or `#D97706` (Amber-600) — High contrast focus states.

### Typography & Text Tokens
- **Primary Ink (`text-primary`):** `#0F172A` (Slate-900) — High contrast headings, active prices, quantities.
- **Secondary Ink (`text-secondary`):** `#475569` (Slate-600) — Labels, SKU badges, category tags.
- **Muted Ink (`text-muted`):** `#94A3B8` (Slate-400) — Placeholders, inactive breadcrumbs, timestamps.

### Semantic & Accent Tokens
- **Primary Brand Accent:** `#D97706` / `#B45309` (Amber-600 / 700) — Primary CTAs, active POS tabs, checkout highlight.
- **Success / In-Stock:** `#16A34A` (Green-600) / `#DCFCE7` (Green-50) — Full stock badges, completed invoices, paid status.
- **Warning / Low-Stock:** `#CA8A04` (Yellow-600) / `#FEF9C3` (Yellow-50) — Reorder alerts, partial payment badges.
- **Danger / Void / Loss:** `#DC2626` (Red-600) / `#FEE2E2` (Red-50) — Void transactions, stock discrepancy, expense totals.
- **Info / Roll Conversion:** `#0284C7` (Sky-600) / `#E0F2FE` (Sky-50) — Roll unit indicators, meter conversions.

---

## 3. Typography Architecture

- **Primary Sans:** Modern geometric sans font stack (`Outfit`, `Satoshi`, or system `system-ui, -apple-system, Segoe UI, Roboto, sans-serif`).
- **Numeric & Price Monospace:** `JetBrains Mono`, `Geist Mono`, or `ui-monospace, SFMono-Regular, Menlo, monospace` — **All prices, stock counts, KES figures, and SKUs must use tabular monospace numbers for perfect column alignment.**
- **Scale Hierarchy:**
  - `Display / KPI`: `text-2xl` to `text-3xl` (`font-bold`, `tracking-tight`)
  - `Section Title`: `text-lg` (`font-semibold`, `text-slate-900`)
  - `Table Headings / Form Labels`: `text-xs` (`font-bold`, `uppercase`, `tracking-wider`, `text-slate-500`)
  - `Body / Row Text`: `text-sm` (`font-normal`, `text-slate-800`)
  - `Badges & Micro Metadata`: `text-[11px]` (`font-semibold`)

---

## 4. Component Standards (POS & Management)

### Buttons & Quick Actions
- **Primary Action (Checkout / Save):** Solid Amber-600 (`#D97706`) with text-white, hover Amber-500, active slight scale down (`active:scale-[0.98]`).
- **Secondary Action (Void / Clear / New):** White surface with Slate-200 border, text-slate-700, hover bg-slate-50.
- **Danger Action (Void Invoice):** White surface with Red-200 border, text-red-600, hover bg-red-50.
- **Keycap Badges:** Visual keyboard hints `[F2]`, `[Enter]`, `[Esc]` in light gray pill badges for fast cashier navigation.

### POS Table & Product Rows
- Clean white rows with border-b `border-slate-200`.
- Quantity counters with 1-tap `+` / `-` buttons and direct numeric input.
- Editable selling price cell with subtle dotted underline indicator.
- Roll conversion indicator pill: e.g., `4 rolls + 85m` in Sky-50 pill with Sky-700 text.

### Form Inputs & Search Bars
- Clean white background (`#FFFFFF`), 1px `border-slate-300`, rounded-lg (`rounded-lg`), text-slate-900.
- Focus ring: `ring-2 ring-amber-500/20 border-amber-600`.
- Search icon on left, keyboard shortcut tag on right (e.g. `⌘K` or `/`).

### Badges & Status Chips
- Rounded pill format (`rounded-full px-2.5 py-0.5 text-xs font-semibold`).
- `Paid` → `bg-emerald-50 text-emerald-700 border border-emerald-200`
- `Partial` → `bg-amber-50 text-amber-700 border border-amber-200`
- `Unpaid` → `bg-rose-50 text-rose-700 border border-rose-200`
- `ETR Sale` → `bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold`

---

## 5. Layout Architecture

- **POS Quick-Sales Screen (`/sales/new`):**
  - **Left 65% (Transaction & Line Items):** Fast search box at top → Tabular items list with live price & BP margin floor → Totals & discount.
  - **Right 35% (Payment & Checkout):** Customer selector → Payment method buttons (Cash / Mpesa / Bank / Credit) → Large numeric total due → Big "Complete & Print [Enter]" button.
- **Dashboard & Management Screens:**
  - Standard top navigation bar (White surface, border-b slate-200) with store name, active user badge, and quick module links.
  - Responsive grid layout: KPI summary cards on top, analytical tables and quick forms below.

---

## 6. Anti-Patterns (Explicit Bans)

- 🚫 **NO Dark-Only Lock-in:** The POS is primarily used in bright store lighting; dark muddy backgrounds are banned for counter work. Clean, bright, high-contrast white tokens are standard.
- 🚫 **NO Pure Black `#000000` text:** Use Slate-900 (`#0F172A`) for soft, deep contrast without harsh pixel edges.
- 🚫 **NO Flashing/Bouncing animations:** POS is a tool of speed; animations must never delay state updates.
- 🚫 **NO Neon or Gradient glow buttons:** Clean, solid tactile buttons only.
- 🚫 **NO Hidden Prices or Margins for Cashier:** BP (buying price) and margin calculations must be accessible where configured.
