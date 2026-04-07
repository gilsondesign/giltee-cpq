# Product Type & Sizing Design Spec

## Goal

Replace the "Include youth sizes" checkbox on quote products with a **Product Type** selector (Adult / Youth / Toddler / Headwear). Each type shows the appropriate size inputs. Youth and Toddler products validate the entered S&S garment style and warn the user if it appears to be an adult-only style.

---

## Data Model

### `product_type` field

Each product gains a `product_type` field stored in the quote's `intake_record.products[]` array:

```
'adult' | 'youth' | 'toddler' | 'headwear'
```

**Replaces** the existing `youth_sizes: boolean` flag. On read, `youth_sizes: true` maps to `product_type: 'youth'`. On write, only `product_type` is persisted — `youth_sizes` is never written for new/updated products.

### Size inputs per type

| Type | Size options | Notes |
|---|---|---|
| Adult | XS, S, M, L, XL, 2XL, 3XL, 4XL, 5XL | Current behavior, unchanged |
| Youth | YXS, YS, YM, YL, YXL | Replaces youth checkbox |
| Toddler | 2T, 4T, 6T | New |
| Headwear | _(none)_ | Quantity field only, no size breakdown |

Changing product type clears all size quantities.

### `size_breakdown` string format

Unchanged. For apparel types, serialized as `"XS:10, S:20, YS:5"` etc. Headwear products leave `size_breakdown` empty.

---

## Frontend — QuoteForm.jsx

### New constants

```js
export const TODDLER_SIZES = ['2T', '4T', '6T']
export const PRODUCT_TYPES = ['adult', 'youth', 'toddler', 'headwear']
```

### Product Type selector

A segmented button group (or `<select>`) near the top of each product card, above the size inputs. Labels: **Adult | Youth | Toddler | Headwear**.

- Default for new products: `adult`
- Changing type: clears all size quantities in state, re-renders size grid
- Headwear: hides size grid entirely; quantity field remains

### Style mismatch warning

Fires when:
- `product_type` is `'youth'` or `'toddler'`, AND
- `brand_style` is non-empty

Mechanism: when `brand_style` changes on a Youth or Toddler product, call `GET /api/ss/lookup?style=<brand_style>&color=<color>` (same call already used for garment cost). Inspect the returned `skus` array:

- If **no SKU** has a `size` value matching any youth size (`YXS, YS, YM, YL, YXL`) or toddler size (`2T, 4T, 6T`) → show warning
- If at least one SKU matches → no warning
- If lookup fails or returns no results → no warning (don't block on S&S downtime)

Warning text (inline below the style field, error styling):
> "Youth sizes require a youth garment style (e.g. 3001YCVC). Update the style or change the product type."

For Toddler:
> "Toddler sizes require a toddler garment style. Update the style or change the product type."

The save button remains enabled — warning is advisory, not a hard block.

No validation is performed for Adult or Headwear products.

### Backwards compatibility

In `buildEditFields` (called when loading an existing product into the form):
- If `product.product_type` is set → use it directly
- Else if `product.youth_sizes === true` → `product_type = 'youth'`
- Else → `product_type = 'adult'`

In `serializeProduct` (called when saving):
- Write `product_type` to the serialized object
- Do **not** write `youth_sizes`

### `parseSizeBreakdown`

Already accepts any size key that appears in `ADULT_SIZES` or `YOUTH_SIZES`. Extend to also accept `TODDLER_SIZES` (`2T, 4T, 6T`).

---

## Backend

### `pipelineService.js` — Claude intake prompt

Two changes to the prompt that Claude uses to parse raw customer inquiries:

1. Add `2T, 4T, 6T` to the list of valid size codes
2. Replace `youth_sizes: boolean` with `product_type: 'adult' | 'youth' | 'toddler' | 'headwear'` in the product schema context

### `pdfService.js`

Replace the current `youth_sizes` flag display:

**Before:** Shows "Youth Sizes: Yes — youth sizing included"

**After:** Shows product type label when not adult:
- Youth product → "Product Type: Youth"
- Toddler product → "Product Type: Toddler"
- Headwear product → "Product Type: Headwear"
- Adult product → no product type row (default, no need to state it)

### `ssService.js`

No changes. Already returns `skus[]` with `size` codes per SKU. The frontend reads those size codes to perform style validation.

---

## Error Handling

- S&S lookup failure → silently skip validation, no warning shown
- Empty `brand_style` → no validation triggered
- `product_type` missing on old data → defaults to `'adult'`

---

## Testing

**Frontend (Vitest + @testing-library/react):**
- Product type selector renders with 4 options
- Changing type clears size quantities
- Headwear hides size grid
- Youth product with adult-only S&S response shows warning
- Youth product with youth S&S response shows no warning
- Toddler product with adult-only S&S response shows toddler warning
- Old product with `youth_sizes: true` loads as `product_type: 'youth'`
- `parseSizeBreakdown` handles `2T, 4T, 6T` keys

**Backend:**
- `pipelineService` Claude prompt includes `2T, 4T, 6T` and `product_type` field
