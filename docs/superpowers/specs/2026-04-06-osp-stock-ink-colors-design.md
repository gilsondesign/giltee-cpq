# OSP Stock Ink Colors — Design Spec

**Date:** 2026-04-06  
**Status:** Approved

## Overview

OSP (One Stop Prints) offers a palette of 83 stock Pantone Coated ink colors at no extra charge. When a customer selects stock colors for a print location, the custom PMS ink upcharge is waived. Custom (non-stock) PMS colors incur a fee configured per manufacturer (`customPmsInk` in `pricing_config`).

This feature adds per-location ink color selection to the quote form, updates pricing to calculate the custom PMS fee per custom color (not flat per order), and displays selected colors in the quote view.

---

## Data Model

No schema migration required. `intake_record` is JSONB. Each location object in `products[n].decoration.locations` gains an optional `ink_colors` array:

```json
{
  "name": "Front Chest",
  "color_count": 2,
  "print_size": "STANDARD",
  "ink_colors": [
    { "name": "PANTONE 286 C", "custom": false },
    { "name": "PMS Crimson Red", "custom": true }
  ]
}
```

- `custom: false` — color is in the manufacturer's stock palette; no upcharge
- `custom: true` — color is not in stock; upcharge applies
- `ink_colors` is optional. Absent or empty means colors unspecified; no fee is applied.

### Stock Color List

The 83 OSP stock Pantone Coated colors are hardcoded in two places:
- `client/src/constants/ospStockColors.js` — used by `InkColorSelect` and `QuoteForm`
- `server/constants/ospStockColors.js` — used by `pricingService` to validate whether a color name is stock

Both files export the same array `[{ name, hex }]`. Colors were extracted from `osp-stock-colors.ase`.

The list includes (non-exhaustive): PANTONE Warm Red C, PANTONE 485 C, PANTONE 286 C, PANTONE Yellow C, PANTONE 354 C, PANTONE Reflex Blue C, PANTONE Violet C, PANTONE 427–432 C (grays), and 70+ others spanning the full spectrum.

---

## UI Changes

### `InkColorSelect` component (`client/src/components/InkColorSelect.jsx`)

New reusable component. Props:

| Prop | Type | Description |
|---|---|---|
| `value` | `Array<{name, custom}>` | Currently selected colors |
| `onChange` | `Function` | Called with updated array |
| `stockColors` | `Array<{name, hex}> \| null` | Stock palette to show; null = no stock palette |
| `customFee` | `number` | Fee per custom color (0 = no warning shown) |

Behavior:
- Renders a trigger button showing selected colors as chips (swatch + name + remove ×)
- Click opens a searchable dropdown listing all stock colors with hex swatches
- Multi-select: clicking a color toggles it; selected colors show a checkmark
- "Custom PMS…" entry at the bottom of the dropdown; typing a name and pressing Enter adds it as `{ custom: true }`
- If `customFee > 0`, custom color chips show an amber warning; if `customFee === 0`, no fee language shown
- If `stockColors` is null/empty, the dropdown shows only the custom PMS entry
- Field is fully optional; no validation required

### `QuoteForm.jsx`

- Add `InkColorSelect` after the print size dropdown in each location row
- Pass `stockColors={OSP_STOCK_COLORS}` when `preferred_manufacturer === 'OSP'`, otherwise `stockColors={null}`
- Pass `customFee` as a hardcoded constant per manufacturer (e.g. OSP: `20`, REDWALL: `0`). The fee display in the UI is informational; the authoritative calculation uses the server-side `pricing_config` value.
- `ink_colors` included in the serialized location object sent to the API

### `ViewQuote.jsx`

- In edit mode: render `InkColorSelect` same as QuoteForm
- In read-only mode: render color chips (swatch + name) inline with the location row; custom colors shown in amber

---

## Pricing Logic

### Current behavior (replaced)

`customPmsInk` was applied as a flat fee if `special_inks` contained "PMS". This logic is removed.

### New behavior

```
customPmsTotal = (count of ink_colors entries where custom === true, summed across all locations of all products)
                 × manufacturer.fees.customPmsInk
```

- Applied per manufacturer independently (OSP calc uses OSP's fee, Redwall uses Redwall's fee)
- If `ink_colors` is absent or empty on a location, contributes 0 custom colors
- If `customPmsInk === 0` for a manufacturer, result is always $0
- Replaces the flat `customPmsInk` line item in `setupFees`

### Pricing result flags

When `customPmsTotal > 0`, append to `flags`:
```
"N custom PMS color(s) (+$XX)"
```
e.g. `"2 custom PMS colors (+$40)"`

---

## Testing

### `InkColorSelect` (unit)
- Renders stock palette swatches when `stockColors` provided
- Renders custom-only when `stockColors` is null
- Selecting a stock color adds it to value; deselecting removes it
- Entering a custom name and pressing Enter adds `{ custom: true }` entry
- Fee warning visible when `customFee > 0` and a custom color is present
- No fee warning when `customFee === 0`
- Remove × on chip removes the color from value

### `pricingService` (unit)
- 0 custom colors → $0 custom PMS fee
- 1 custom color, fee $20 → +$20
- 2 custom colors across 2 locations, fee $20 → +$40
- All stock colors → $0
- 2 custom colors, Redwall (fee $0) → $0
- `ink_colors` absent on location → treated as 0 custom colors

### `QuoteForm` (integration)
- Serialized location includes `ink_colors` array when colors selected
- `ink_colors` absent from serialized location when none selected

### `ViewQuote` (integration)
- Color chips render in read-only mode
- `InkColorSelect` renders in edit mode with correct stock palette based on selected supplier
