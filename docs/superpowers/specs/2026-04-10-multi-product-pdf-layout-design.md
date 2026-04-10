# Multi-Product PDF Quote Layout

**Date:** 2026-04-10
**Status:** Approved

## Problem

When a quote contains two or more products, the current PDF layout is confusing. Product 1 owns clearly-named sections ("Order Summary", "Print Locations", "Pricing") that read like global quote sections. Products 2+ are labeled "Product 2", "Print Locations", "Pricing — Product 2" — the section labels don't consistently anchor to their product, making it easy to lose track of which detail belongs to which item.

## Solution

Use different PDF layouts depending on product count:

- **1 product** → current flat layout, unchanged.
- **2+ products** → each product's content is wrapped in a bordered card with a labeled header.

## Layout Specification

### Single-Product Quotes

No changes. The current flat layout (Order Summary → Print Locations → Pricing, followed by the page break and page 2 content) remains exactly as-is.

### Multi-Product Quotes

Each product's sections are wrapped in a **bordered product card**:

**Card header** (full-width row, green background `#104F42`, white text):
- Left: `"Product N"` — bold, 9pt
- Right: `"X units"` — right-aligned, 7pt, slightly dimmed (opacity/color)

**Card border:** 1.5pt solid `#104F42` on all four sides.

**Card body:** the existing Order Summary, Print Locations, and Pricing content — content is unchanged, only the container is new.

Cards appear sequentially on the page. After the last card, the existing **Combined Order Total** row is shown (already present for multi-product quotes — no change needed).

### What Is Not Changed

- Page 2 content: Decoration Details, Garment Availability, Production Timeline, Notes, Terms & Conditions, Approval/Signature block — all unchanged, including the existing "Decoration Details — Product N" per-product labeling.
- All pricing logic, profit calculations, supplier comparison tables.
- Data model (`intake_record`, `garment_data`, `pricing_osp`, `pricing_redwall` arrays).
- `normalizeIntakeRecord` backward-compatibility path for legacy single-product quotes.
- Single-product layout.

## Implementation Notes

The change is confined to `server/services/pdfService.js`, specifically `buildDocDefinition`. The existing code already has a loop for products 2+ (starting at index 1); the refactor will:

1. Extract the per-product content builder into a shared helper that returns a pdfmake content array (Order Summary stack, Print Locations table, Pricing table).
2. For single-product quotes (`products.length === 1`): call the helper and inline the result directly into the document — no wrapper.
3. For multi-product quotes (`products.length > 1`): call the helper for each product and wrap each result in a card table (two-row pdfmake table: header row + body row).

The card is implemented as a pdfmake `table` with a custom `layout` object that sets border color to `#104F42` on all sides and removes inner lines.

## Files Affected

| File | Change |
|------|--------|
| `server/services/pdfService.js` | Refactor `buildDocDefinition` to branch on product count; extract per-product content helper; add card wrapper for multi-product |
| `server/__tests__/pdfService.test.js` | Add/update tests for multi-product card rendering |
