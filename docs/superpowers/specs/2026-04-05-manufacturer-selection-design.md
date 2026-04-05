# Manufacturer Selection for Quote Pricing & PDF/Email

**Date:** 2026-04-05
**Status:** Approved

## Overview

Users need to select which print manufacturer (OSP or Redwall) a quote references when generating a PDF and email draft. Customers frequently change their minds on print type, quantity, and size — so the selection must be editable and trigger a pipeline rerun to produce a fresh PDF and email.

The pipeline already calculates pricing for both manufacturers on every run. This feature adds a persisted user preference that controls which supplier's pricing is used for output generation.

---

## Database

Add one nullable `VARCHAR` column to the `quotes` table:

```sql
ALTER TABLE quotes ADD COLUMN selected_supplier VARCHAR;
-- Allowed values: 'OSP', 'REDWALL', NULL
```

- `NULL` means no explicit preference — fall back to `recommended_supplier`.
- No migration of existing rows required; `NULL` is the correct default and preserves current behavior.

**Effective supplier** (used throughout): `selected_supplier ?? recommended_supplier`

---

## Edit Form (ViewQuote)

In the existing edit panel on ViewQuote, add a **"Preferred Manufacturer"** field:

- **Two radio buttons: OSP | Redwall**
- Only rendered when `intake_record.decoration.method === 'SCREEN_PRINT'`. Hidden for DTF, DTG, and Embroidery (no supplier choice for those methods).
- Pre-selected to `recommended_supplier` (lowest price) when the edit panel opens and `selected_supplier` is null. If `selected_supplier` is already set, pre-select that value.
- On save, the PATCH request includes `selected_supplier: 'OSP'` or `selected_supplier: 'REDWALL'`.

**Pricing display (read-only, outside edit mode):**

- The existing "Recommended" badge on the pricing section remains and always reflects the lowest-price supplier — it is purely informational.
- When a manual override is active (`selected_supplier` is set and differs from `recommended_supplier`), show a small **"Selected"** indicator on the user's chosen supplier column.

---

## API

**PATCH `/api/quotes/:id`**
Add `selected_supplier` to the list of allowed update fields. Accepts `'OSP'`, `'REDWALL'`, or `null`.

**GET `/api/quotes/:id/pdf`**
No query parameter needed. Resolve effective supplier from the quote record before calling `pdfService`.

---

## Pipeline Changes

The pricing step (Step 3) is unchanged — both suppliers are always calculated.

**Step 5 — Email Draft**
Pass the effective supplier's pricing object (`pricing_osp` or `pricing_redwall`) to the Claude AI email prompt, instead of always using the recommended supplier's pricing.

**Step 6 — PDF Generation**
Resolve effective supplier before calling `pdfService`. Pass it as an explicit argument rather than reading `quote.recommended_supplier` inside the service.

```js
const effectiveSupplier = quote.selected_supplier ?? quote.recommended_supplier;
// pass effectiveSupplier to pdfService and email prompt
```

`pdfService` signature change: accept `supplier` as an explicit parameter instead of deriving it from `quote.recommended_supplier` internally.

---

## Behavior Matrix

| Decoration Method | Manufacturer Field Shown | Selection Logic |
|---|---|---|
| SCREEN_PRINT | Yes | User picks OSP or Redwall |
| DTF | No | Single pricing tier, no choice |
| DTG | No | Single pricing tier, no choice |
| EMBROIDERY | No | Bayview Threadworks, no choice |

---

## Out of Scope

- No changes to the pricing calculation logic.
- No admin interface for pricing rates.
- No per-action (non-persisted) supplier override — selection always goes through edit → save → rerun.
