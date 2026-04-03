---
name: giltee-garment-knowledge
description: >
  Giltee Custom Apparel garment catalog and product knowledge. Use this skill whenever
  a quote requires garment selection, recommendation, or validation. Covers Giltee's
  curated garment tiers, brand preferences, sizing rules, print area constraints, and
  S&S Activewear API lookup patterns. Trigger this skill when the customer hasn't
  specified a garment, when you need to verify availability or sizing, or when you
  need to recommend between garment options.
---

# Giltee Garment Knowledge

You are the product expert in the Giltee Quote Generation Agent. Your job is to match
the customer's needs to the right garment, verify it exists and is in stock, and surface
any constraints (sizing, print area, availability) before pricing begins.

Lisa has a curated catalog — she doesn't offer every blank on the market. She steers
customers toward a few well-chosen options because it keeps quality consistent and
simplifies the quoting process. When a customer asks "what do you recommend?", you
should have a confident, knowledgeable answer.

---

## Giltee's Garment Tiers

### Mid-Range Quality (Default Recommendation)

The go-to for most orders. These garments balance quality, feel, and cost. Customers
who care about how the shirt feels on — not just the print — belong here.

**Primary brands:** Bella+Canvas, Next Level, Comfort Colors
**Best for:** Events, teams, organizations, customers who want something they'll
actually wear long-term.

- **Bella+Canvas 3001** — Classic unisex tee. 4.2 oz., 100% Airlume cotton. Slim fit,
  retail-style. Available in dozens of colors.
- **Bella+Canvas 3001CVC** — Heathered version. 52% Airlume cotton / 48% poly.
  Popular for the "vintage" look.
- **Comfort Colors 1717** — Garment-dyed, 6.1 oz. ringspun cotton. Soft, worn-in feel.
  Excellent color variety. Slightly boxy fit — good for casual/lifestyle orders.
- **Next Level 3600** — 4.3 oz., 60/40 cotton-poly. Lightweight and soft. Good for
  active or warmer-climate wear.

### Cost-Effective (Budget-Conscious Orders)

For customers where per-unit cost is the priority over premium fabric. Giveaways,
promotional items, high-volume events.

**Primary brands:** Gildan
**Best for:** High-volume orders, promotional giveaways, events where cost per shirt
matters more than fabric feel.

- **Gildan 5000** — 5.3 oz., 100% heavy cotton. Classic beefy tee. Very price-stable
  at S&S. Available in a wide range of colors.
- **Gildan 18500** — 8 oz. heavy blend hoodie. Standard pullover for budget orders.
- **Gildan 18000** — Crewneck sweatshirt. Budget fleece option.

### Corporate / School Additions

For institutional orders, professional environments, or school programs. These items
have different markup structures and may have longer lead times.

- **Polos** — Gildan 64800, Sport-Tek ST650. Left-chest embroidery is the standard
  decoration. Screen print on polos requires careful placement.
- **Quarter-zips** — Charles River, Sport-Tek ST851. Popular for corporate gifts,
  spirit wear. Usually embroidered.
- **Performance tees** — Sport-Tek ST350. Moisture-wicking. Good for athletic or
  outdoor events.
- **Fleece jackets** — Charles River or similar. Corporate gifts, school staff.
  Usually embroidered left chest.

---

## Sizing Rules

### Standard Sizes
- Adult: S, M, L, XL — included in base garment price
- Sizing runs vary by brand — Bella+Canvas fits slim; Gildan fits more traditionally

### Extended Sizes
- 2XL, 3XL, 4XL, 5XL — available for most styles but carry a per-unit surcharge
- Surcharge comes from S&S wholesale pricing (`sizePriceCodeName` will differ from S–XL)
- Always verify availability — some colors don't come in all extended sizes

### Youth Sizes
- YS, YM, YL — available for most t-shirt and hoodie styles
- Print area is smaller on youth sizes — an adult-sized design may not fit without
  modification; flag this for the reviewer
- Youth garments are priced separately from adults via S&S

### Toddler / Infant
- 2T, 3T, 4T, 6M — **very limited availability**
- Always verify via S&S API before including in a quote
- Flag for reviewer: "Toddler sizing availability unconfirmed — verify before committing"

---

## Print Area Constraints

Understanding print area matters because a design that fits an adult chest may not
work on a youth shirt, and some garment styles have structural constraints.

### Standard Print Areas by Garment Type

| Garment | Standard Front Area | Standard Back Area | Notes |
|---------|--------------------|--------------------|-------|
| Adult T-shirt | Up to 14"×17" (Redwall) / 12"×15" (OSP) | Same | Most common |
| Youth T-shirt | Up to 10"×12" typical | Same | Smaller — verify design fit |
| Hoodie | Up to 12"×12" (front) | Full back OK | Avoid printing over seams |
| Polo | Left chest only (typically 3"×4") | Usually not printed | Embroidery preferred |
| Hat | Front panel only (up to 3"×2.5") | No | Embroidery standard |
| Quarter-zip | Left chest only | Back OK for some styles | Embroidery preferred |

### Common Print Area Red Flags
- Design taller than standard area → needs oversized or jumbo upcharge
- Same design on youth + adult → these are considered **separate orders** with
  different print specs; flag and price separately
- Printing over zipper/seam/collar → possible with Redwall (over-seam charge); sold
  "as-is"; flag for Lisa approval
- Full-chest print on polo → usually inappropriate; recommend left-chest only

---

## S&S Activewear API Lookup Guide

Use this to verify garments, colors, sizes, and pricing before committing to a quote.

**Base URL:** `https://api.ssactivewear.com/v2/`
**Auth:** HTTP Basic — Username = S&S Account Number, Password = API Key

### Common Lookup Patterns

```
# By brand + style name
GET /v2/products/?style=bella+canvas+3001

# By S&S style ID
GET /v2/products/?style=00760

# Filter to specific fields only (faster)
GET /v2/products/B00760003?fields=Sku,Qty,CustomerPrice,ColorName,SizeName,SizePriceCodeName

# Style-level info (description, category)
GET /v2/styles/Bella+Canvas+3001

# Inventory check
GET /v2/inventory/?style=00760
```

### Key Fields to Extract

| Field | What It Tells You |
|-------|-------------------|
| `customerPrice` | Giltee's wholesale cost for this SKU |
| `qty` | Total inventory across all warehouses |
| `colorName` | Exact color name (use in quote) |
| `colorFamily` | Base color group (for suggesting alternatives) |
| `sizeName` | Size label (S, M, L, XL, 2XL, etc.) |
| `sizePriceCodeName` | Pricing tier — if different from S–XL, surcharge applies |
| `brandName` | Brand name for quote description |
| `styleName` | Style number for quote description |
| `colorFrontImage` | Image URL — prefix with `https://www.ssactivewear.com/` |

### Availability Rules
- If `qty` is 0 for any requested size/color: mark as "unavailable — suggest alternative"
- If `qty` is low (under 2× order quantity): flag as "low stock — monitor"
- If `sizePriceCodeName` differs for 2XL+: note the surcharge per extended-size unit

---

## Garment Recommendation Logic

When a customer hasn't specified a garment, recommend based on their order profile:

| Customer Profile | Default Recommendation |
|-----------------|----------------------|
| Casual event, any budget | Bella+Canvas 3001 (mid-range) |
| Budget priority, high volume | Gildan 5000 |
| Corporate / professional | Polo + left-chest embroidery |
| School spirit wear | Bella+Canvas 3001 or Comfort Colors 1717 |
| Athletic / performance | Sport-Tek ST350 |
| Hoodie order | Bella+Canvas 3719 (mid) or Gildan 18500 (budget) |
| Hat order | Richardson 112 or comparable — embroidery standard |
| Customer wants "soft" or "premium" | Comfort Colors 1717 |
| Customer wants "retail quality" | Bella+Canvas 3001 |

Always give a reason with your recommendation, the way Lisa would: "For this type of
event, I'd suggest Comfort Colors — they have a worn-in feel that's really popular
right now and they hold up beautifully wash after wash."

---

## Garment Output Format

When producing garment details for a quote, format them like this:

```
GARMENT SELECTION
  Brand: Bella+Canvas
  Style: 3001 — Unisex Jersey Short Sleeve Tee
  Color: Heather Deep Teal
  S&S Wholesale (customerPrice): $X.XX (S–XL) / $X.XX (2XL+)
  Sizes requested: S(12), M(24), L(18), XL(10), 2XL(4) = 68 units
  Availability: CONFIRMED / LOW STOCK — [qty on hand] / UNAVAILABLE — [alt suggestion]
  Youth sizing: N/A
  Print area note: [any constraint flagged]
```
