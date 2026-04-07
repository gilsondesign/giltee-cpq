# Pricing Matrix Admin UI — Design Spec

## Goal

Allow admin users to view and edit the screen print decoration cost tables for OSP and Redwall manufacturers through a Settings UI, with values persisted in the database and loaded at runtime by the pricing service.

## Architecture

Pricing config is stored in a new `pricing_config` table (one row per manufacturer, full config as JSONB). The pricing service loads from the DB at startup, falls back to hardcoded constants if no row exists. The admin UI PUTs the full config on save. No changes to the pipeline or quote calculation interface.

## Tech Stack

- **Backend:** Express.js, PostgreSQL (JSONB), existing `requireAuth` + admin role check middleware
- **Frontend:** React 18, TailwindCSS with existing design tokens, Vitest + @testing-library/react

---

## Data Model

### Table: `pricing_config`

```sql
CREATE TABLE pricing_config (
  manufacturer  VARCHAR(20) PRIMARY KEY,  -- 'OSP', 'REDWALL'
  config        JSONB NOT NULL,
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by    VARCHAR(255)
);
```

### Config JSONB shape (screen print)

```json
{
  "tiers": [
    {
      "min": 12,
      "max": 23,
      "costs": [6.00, 9.20, 12.40, 15.60, 18.80, 22.00, 25.20, 28.40, null, null, null, null]
    }
  ],
  "fees": {
    "screenFeePerColor": 20,
    "repeatScreenPerColor": 10,
    "inkSwitch": 20,
    "customPmsInk": 20,
    "screenFeeWaivedAt": 96
  },
  "printSizes": {
    "oversized": { "surchargePercent": 15, "screenFee": 15 },
    "jumbo":     { "surchargePercent": 50, "screenFee": 20 }
  }
}
```

- `tiers` array always has costs with 12 elements (1c–12c). `null` means n/a (not applicable at that quantity tier for that color count).
- The `7500+` tier is display-only ("call") and is not stored — the UI renders it as a static read-only row.
- `max: null` represents infinity (open-ended top tier, i.e. 2500+).

### Hardcoded fallback

`pricingService.js` currently defines `OSP_SCREEN_PRINT` and `REDWALL_SCREEN_PRINT` as module-level constants. These remain as fallbacks. If no DB row exists for a manufacturer, the service uses the hardcoded values. Once a row is saved from the UI, the DB values take over.

---

## Backend

### New file: `server/db/pricingQueries.js`

Two functions:

```js
getPricingConfig(manufacturer)
// SELECT * FROM pricing_config WHERE manufacturer = $1
// Returns row or null

upsertPricingConfig(manufacturer, config, updatedBy)
// INSERT INTO pricing_config (manufacturer, config, updated_by, updated_at)
// VALUES ($1, $2, $3, NOW())
// ON CONFLICT (manufacturer) DO UPDATE SET config = $2, updated_by = $3, updated_at = NOW()
// RETURNING *
```

### New file: `server/routes/pricing.js`

Admin-only routes (middleware: `requireAuth`, then check `req.user.role === 'admin'`):

**`GET /api/pricing/:manufacturer`**
- Validates `:manufacturer` is one of `['OSP', 'REDWALL']` — 400 otherwise
- Calls `getPricingConfig(manufacturer)`
- If null, returns the hardcoded fallback config (converted to the JSONB shape) with `{ source: 'default' }`
- If found, returns `{ manufacturer, config, updated_at, updated_by, source: 'db' }`

**`PUT /api/pricing/:manufacturer`**
- Validates `:manufacturer`
- Validates `req.body.config` has `tiers` (array, non-empty), `fees` (object), `printSizes` (object) — 400 if missing
- Calls `upsertPricingConfig(manufacturer, config, req.user.email)`
- Invalidates the in-memory cache in `pricingService` by calling `pricingService.invalidateCache(manufacturer)`
- Returns the saved row

### Modified: `server/services/pricingService.js`

- Add a module-level cache: `const _cache = { OSP: null, REDWALL: null }`
- Add `async function loadPricingConfig(manufacturer)`: checks cache, queries DB, falls back to hardcoded, stores in cache
- Add `function invalidateCache(manufacturer)`: sets `_cache[manufacturer] = null`
- `getOspDecorationCost` and `getRedwallDecorationCost` become async, call `loadPricingConfig` to get tiers
- `calculateScreenPrintQuote` becomes async accordingly
- `calculateQuote` becomes async
- Export `invalidateCache`

### Modified: `server/index.js`

Register: `app.use('/api/pricing', require('./routes/pricing'))`

---

## Frontend

### Settings layout

The existing `/admin/users` page (Admin.jsx) is refactored into a shared Settings shell with two tab links:
- **Users** — existing content, unchanged
- **Manufacturers** — new pricing page

The Settings shell renders the NavBar, a page heading "Settings", and a horizontal tab row. Each tab is a `<NavLink>` to its route. Active tab gets an underline indicator.

Routes:
- `/admin/users` — existing Admin.jsx content (moved inside the shell)
- `/admin/pricing` — new AdminPricing.jsx

The NavBar gear icon continues to link to `/admin/users`.

### New file: `client/src/pages/AdminPricing.jsx`

**Manufacturer tabs:** OSP | Redwall — clicking switches which manufacturer's config is loaded and displayed. Both use the same rendering logic.

**On mount / tab switch:** `GET /api/pricing/:manufacturer` → populate local state with the config.

**Printing Cost Grid:**

Matches the layout in the reference screenshot:

```
PRINTING  | 1c  | 2c  | 3c  | ... | 12c
----------|-----|-----|-----|-----|-----
12-23     | $   | $   | $   |     | n/a
24-47     | $   | $   | $   |     | n/a
...
2500-7499 | $   | $   | ... | $   | $
7500+     |call |call |call |call |call   ← static read-only row
```

- Each editable cell is `<input type="number" step="0.01" min="0">` styled to look like a table cell
- `null` cells render as grey `n/a` text (non-editable)
- The 7500+ row is fully static, renders "call" in every cell, no inputs
- Column headers: "PRINTING" label + "1c" through "12c"
- Row labels: "12-23", "24-47", etc. (derived from `tier.min`–`tier.max`)

**Fees panel (right side of grid):**

| Label | Field | Input |
|---|---|---|
| Screen fee per color* | `screenFeePerColor` | number |
| Repeat screen per color* | `repeatScreenPerColor` | number |
| Ink switch (limit 1 per 25pc) | `inkSwitch` | number |
| Custom PMS ink color | `customPmsInk` | number |
| *Screen fees waived at | `screenFeeWaivedAt` | number |

**Print Sizes panel (below fees):**

| Size | Surcharge % | Screen Fee |
|---|---|---|
| Standard (up to 12x15") | — | — |
| Oversized (up to 13x22") | `oversized.surchargePercent` | `oversized.screenFee` |
| Jumbo (up to 17x28") | `jumbo.surchargePercent` | `jumbo.screenFee` |

Standard row is read-only (no surcharge). Oversized and Jumbo have editable inputs.

**Save button:**
- `PUT /api/pricing/:manufacturer` with full config
- Shows inline success message with timestamp on success
- Shows inline error on failure
- Button disabled while saving

**Last updated line:**
- Shows `updated_at` formatted as date + time and `updated_by` email when `source === 'db'`
- Shows "Using default values" when `source === 'default'`

### Modified: `client/src/pages/Admin.jsx`

Refactored to extract the existing user management content into the shared Settings shell. The shell is a layout component defined inside Admin.jsx (not a separate file — it's only used here). `AdminPricing.jsx` imports and uses the same shell.

The shell renders:
```jsx
<div className="min-h-screen bg-surface">
  <NavBar />
  <div className="max-w-5xl mx-auto px-6 py-10">
    <h1>Settings</h1>
    <div className="tab row">
      <NavLink to="/admin/users">Users</NavLink>
      <NavLink to="/admin/pricing">Manufacturers</NavLink>
    </div>
    <div className="tab content">
      {children}
    </div>
  </div>
</div>
```

Export the shell as a named export `SettingsShell` from `Admin.jsx` so `AdminPricing.jsx` can import it without a circular dependency.

### Modified: `client/src/App.jsx`

Add route:
```jsx
<Route path="/admin/pricing" element={<AuthGuard adminOnly><AdminPricing /></AuthGuard>} />
```

---

## Error Handling

- Invalid manufacturer key → 400
- Missing/malformed config body on PUT → 400
- Non-admin user hitting `/api/pricing` → 403
- DB error → 500 (existing error middleware handles)
- Frontend: load error shows an error banner; save error shows inline below Save button

---

## Testing

**Backend:**
- `GET /api/pricing/OSP` with no DB row → returns hardcoded config with `source: 'default'`
- `PUT /api/pricing/OSP` with valid config → saves and returns row
- `PUT /api/pricing/BADKEY` → 400
- `PUT /api/pricing/OSP` with missing `tiers` → 400
- Non-admin request → 403

**Frontend:**
- AdminPricing renders OSP tab by default
- Switching to Redwall tab loads Redwall config
- Editing a cell updates local state
- Save button calls PUT with updated config
- "Using default values" shown when source is 'default'
- Last updated shown when source is 'db'
