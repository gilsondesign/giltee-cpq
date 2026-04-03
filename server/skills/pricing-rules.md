---
name: giltee-pricing-rules
description: >
  Giltee Custom Apparel pricing calculation engine. Use this skill whenever a quote
  needs to be priced — after intake is complete. This skill encodes all of Giltee's
  pricing logic: per-unit profit margins by quantity tier, decoration costs from OSP
  and Redwall, S&S garment cost lookup, and all add-on fees. Always use this skill
  when calculating any quote total. Never estimate or interpolate — use the exact
  tables encoded here.
---

# Giltee Pricing Rules

You are the calculation engine of the Giltee Quote Generation Agent. Your job is to
take a completed intake record and produce a precise, fully-itemized price breakdown
that a reviewer can trust without re-deriving anything from scratch.

Accuracy is everything here. A wrong price either costs Giltee money or costs them
a customer. Use the tables below verbatim. Never round mid-calculation — round only
the final per-unit and total figures to the nearest cent.

## Pricing Architecture

The total customer price per unit is the sum of three layers:

```
Total per-unit price = S&S garment cost + decoration cost + profit margin
```

All three are calculated independently and then summed. See each section below.

---

## Layer 1: Profit Margin by Quantity Tier

Apply the margin for the tier that matches the total order quantity. Use the lowest
tier break the quantity meets or exceeds.

| Quantity (total units) | Profit per unit |
|------------------------|----------------|
| 24–47                  | $6.67           |
| 48–95                  | $4.69           |
| 96–143                 | $3.13           |
| 144–299                | $2.26           |
| 300+                   | $1.67           |

> Orders below 24 units: Screen print is not permitted. Use DTF or DTG. Profit margin
> for sub-24 orders should be confirmed with Lisa — flag it for reviewer.

---

## Layer 2: Garment Cost (S&S Activewear API)

Garment cost comes from the S&S Activewear REST API in real time. Do not use
hardcoded garment prices.

**Credentials file:** `/sessions/loving-nice-mendel/mnt/Claude Cowork/Quote Generator/Config/ss-activewear.json`

Always read credentials from that file — never hardcode the API key in a script.

### How to call the API

Run the following Python to look up a style. Replace `STYLE_ID` and `COLOR_NAME` with
the values from the intake record:

```python
import json, urllib.request, base64

# Load credentials
with open("/sessions/loving-nice-mendel/mnt/Claude Cowork/Quote Generator/Config/ss-activewear.json") as f:
    creds = json.load(f)

token = base64.b64encode(f"{creds['account_number']}:{creds['api_key']}".encode()).decode()
headers = {"Authorization": f"Basic {token}", "Accept": "application/json"}

def ss_get(path):
    req = urllib.request.Request(f"https://api.ssactivewear.com/v2{path}", headers=headers)
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())

# 1. Pull all SKUs for the style
STYLE_ID   = "3719"       # e.g. Bella+Canvas 3719
COLOR_NAME = "Navy"       # from intake record

skus = ss_get(f"/products/?style={STYLE_ID}&mediatype=json")

# 2. Filter to requested color
color_skus = [s for s in skus if COLOR_NAME.lower() in s.get("colorName","").lower()]

# 3. Get prices and check availability
for sku in color_skus:
    print(sku["gtin"], sku["sizeName"], sku["colorName"],
          "price:", sku["customerPrice"], "qty:", sku["qty"])

# 4. Identify extended-size surcharge: compare 2XL+ customerPrice vs standard sizes
std_price  = min(s["customerPrice"] for s in color_skus if s.get("sizePriceCodeName","") not in ["2XL","3XL","4XL"])
ext_sizes  = [s for s in color_skus if s.get("sizePriceCodeName","") in ["2XL","3XL","4XL"]]
```

### Lookup rules

1. **Confirm color availability** — if the requested color returns zero SKUs, suggest
   alternatives using `colorFamily`. Flag for reviewer.

2. **Confirm size availability** — if any requested size has `qty = 0`, flag as
   "check availability before confirming with customer."

3. **Price to use:** `customerPrice` is Giltee's wholesale cost for standard orders.
   For orders where quantity is a multiple of `caseQty`, compare `casePrice` and use
   whichever is lower.

4. **Extended size surcharges** — sizes 2XL and above typically have a higher
   `customerPrice`. Calculate a weighted average wholesale cost if the order mixes
   standard and extended sizes, and note the blended rate in the quote flags.

> The S&S `customerPrice` is Giltee's **wholesale cost**. The customer never sees
> this number. It is the input to the pricing formula — not the output.

---

## Layer 3: Decoration Cost

Decoration cost depends on the method. Use the appropriate table below.

### 3A. Screen Print — OSP (Orchard Street Press)

OSP is one option for screen print. Per-unit decoration cost by quantity and ink color count:

| Qty     | 1c    | 2c    | 3c    | 4c    | 5c    | 6c    | 7c    | 8c    |
|---------|-------|-------|-------|-------|-------|-------|-------|-------|
| 12–23   | $6.00 | $9.20 | $12.40| $15.60| $18.80| $22.00| $25.20| $28.40|
| 24–47   | $3.00 | $4.60 | $6.20 | $7.80 | $9.40 | $11.00| $12.60| $14.20|
| 48–95   | $1.58 | $2.24 | $2.90 | $3.56 | $4.22 | $4.88 | $5.54 | $6.20 |
| 96–143  | $1.50 | $2.07 | $2.64 | $3.21 | $3.78 | $4.35 | $4.92 | $5.49 |
| 144–299 | $1.28 | $1.73 | $2.18 | $2.63 | $3.08 | $3.53 | $3.98 | $4.43 |
| 300–499 | $0.97 | $1.24 | $1.51 | $1.78 | $2.05 | $2.32 | $2.59 | $2.86 |
| 500–749 | $0.86 | $1.03 | $1.20 | $1.37 | $1.54 | $1.71 | $1.88 | $2.05 |
| 750–999 | $0.81 | $0.96 | $1.11 | $1.26 | $1.41 | $1.56 | $1.71 | $1.86 |
| 1000–2499| $0.73| $0.86 | $0.99 | $1.12 | $1.25 | $1.38 | $1.51 | $1.64 |
| 2500–7499| $0.71| $0.83 | $0.95 | $1.07 | $1.19 | $1.31 | $1.43 | $1.55 |

OSP supports up to 12 colors. See `references/osp-extended-colors.md` for 9–12c columns.

**OSP Screen / Setup Fees (one-time, not per-unit):**
- Screen fee: $20 per color *(waived at 96+ pieces)*
- Repeat screen (reorder, same artwork): $10 per color
- Ink switch fee: $20 per change *(max 1 per 25 pieces)*
- Custom PMS ink color: $20 per color

**OSP Print Size Upcharges:**
- Standard (up to 12"×15"): no charge
- Oversized (up to 13"×22"): +15% on per-unit rate + $15 screen fee
- Jumbo (up to 17"×28"): +50% on per-unit rate + $20 screen fee
- All-over printing: call for quote

**OSP Specialty Inks (per-unit adder):**

| Ink Type              | 24–47 | 48–95 | 96–143 | 144–499 | 500–999 | 1000+ |
|-----------------------|-------|-------|--------|---------|---------|-------|
| Discharge / Puff      | +100% | +75%  | +50%   | +25%    | +25%    | +25%  |
| Foil (+ 1-color base) | $5.25 | $5.15 | $5.00  | $4.90   | $4.75   | $4.50 |
| Metallic / Neon / Glow| $0.63 | $0.50 | $0.44  | $0.31   | $0.20   | $0.15 |
| Glitter (per color)   | $1.50 | $1.00 | $0.75  | $0.65   | $0.60   | $0.50 |
| Polyester/Spandex     | $0.50 | $0.25 | $0.20  | $0.15   | $0.12   | $0.10 |

*Discharge/Puff: $15 mixing fee per color. Metallic/Neon/Glow may require additional screens.*

---

### 3B. Screen Print — Redwall (2025 rates)

Redwall is the alternative screen print supplier. Per-unit decoration cost:

| Qty      | 1c   | 2c   | 3c   | 4c   | 5c   | 6c   | 7c   | 8c   |
|----------|------|------|------|------|------|------|------|------|
| 6–11     | 7.88 | 9.43 |10.93 |12.47 |14.00 |15.52 |17.04 |18.57 |
| 12–23    | 4.49 | 5.58 | 6.80 | 7.79 | 9.09 |10.49 |11.87 |13.25 |
| 24–47    | 2.99 | 3.74 | 4.60 | 5.10 | 5.89 | 7.27 | 8.65 |10.03 |
| 48–95    | 2.37 | 3.22 | 3.91 | 4.49 | 5.29 | 6.67 | 8.04 | 8.81 |
| 96–143   | 2.07 | 2.69 | 3.29 | 3.98 | 4.60 | 5.22 | 6.05 | 6.89 |
| 144–299  | 1.70 | 2.36 | 2.92 | 3.32 | 3.81 | 4.38 | 4.86 | 5.34 |
| 300–499  | 1.24 | 1.47 | 1.80 | 2.03 | 2.33 | 2.48 | 2.71 | 2.86 |
| 500–999  | 1.01 | 1.17 | 1.36 | 1.52 | 1.73 | 1.81 | 2.05 | 2.24 |
| 1000–2499| 0.85 | 1.01 | 1.07 | 1.14 | 1.31 | 1.45 | 1.56 | 1.68 |
| 2500–4999| 0.70 | 0.77 | 0.84 | 0.89 | 1.00 | 1.06 | 1.13 | 1.21 |

Redwall supports up to 14 colors. See `references/redwall-extended-colors.md` for 9–14c columns.

**Redwall Setup Fees:**
- Under 144 pieces: $32.00 per color per location
- Reorders (exact same artwork): $26.00 per color
- **Free setup at 144+ pieces**
- Ink change: $24.00 per color per design location

**Redwall Print Size Upcharges:**
- Normal (up to 14"×17"): no charge
- Oversized (up to 15"×20", min 12 pcs): +35% on print + $53 screens (no free screens)
- Jumbo (up to 17"×23", min 48 pcs): +75% on print + $79 screens
- JumboXL (up to 21"×24", min 96 pcs): +150% on print + $105 screens
- JumboTALL (up to 17"×27", min 96 pcs): +150% on print + $105 screens

**Redwall notes:**
- Price includes underbase if necessary (built in — no separate charge)
- Polyester garments: add $0.30/unit + 1 extra color/screen
- Custom names (up to 2"): $6.50 each
- Custom numbers (up to 8", 2-digit max): $6.50 each
- Names + numbers together: $12.00 each
- Rush: Same day +50% | Next day +30% | 2 business days +15%

---

### 3C. DTF — Direct-to-Film (Redwall)

Per-unit cost includes transfer printing and application:

| Print Size             | 1–5   | 6–11  | 12–23 | 24–47 | 48–95 | 96–143 | 144–299 | 300–599 | 600+  |
|------------------------|-------|-------|-------|-------|-------|--------|---------|---------|-------|
| Small (up to 5"×5")    | $4.50 | $4.00 | $3.75 | $3.50 | $3.25 | $3.00  | $2.75   | $2.50   | $2.25 |
| Standard (up to 12"×12")| $7.25| $6.95 | $6.75 | $6.50 | $6.25 | $6.00  | $5.75   | $5.50   | $5.00 |
| Oversized (up to 15"×19")| $11.25|$10.75|$10.25|$10.00| $9.75 | $9.50  | $9.25   | $9.00   | $8.75 |

**DTF Fees:**
- Setup (one-time per design): $35.00
- Caps/Hats: add $0.50/unit
- Fleece: add $0.50/unit
- Sleeves: add $1.00/unit
- Minimum order charge: $75.00

---

### 3D. DTG — Direct-to-Garment (Redwall)

| Print Size                    | 1–5   | 6–11  | 12–23 | 24–47 | 48–95 | 96–143 | 144–299 | 300–599 | 600+ |
|-------------------------------|-------|-------|-------|-------|-------|--------|---------|---------|------|
| Standard (up to 13"w × 15"h)  | $7.25 | $6.95 | $6.75 | $6.50 | $6.25 | $6.00  | $5.75   | $5.50  | $5.00|
| Oversized (up to 15"w × 17"h) | $8.75 | $8.45 | $8.25 | $8.00 | $7.75 | $7.50  | $7.25   | $7.00  | $6.50|

**DTG Fees:**
- Setup (one-time per design): $35.00
- No white ink/underbase: subtract $1.00/unit
- Fleece: add $1.00/unit
- Sleeves: add $1.00/unit
- Minimum order charge: $75.00

---

### 3E. Embroidery (Bayview Threadworks)

**⚠️ Bayview pricing sheet not yet received.** Use Redwall embroidery rates below as
a reference, but **flag every embroidery quote for manual pricing review by Lisa.**

**Redwall Embroidery Reference Rates (net, per unit):**

| Stitch Count   | 6–11  | 12–23 | 24–47 | 48–95 | 96–143 | 144–299 | 300–599 | 600+  |
|----------------|-------|-------|-------|-------|--------|---------|---------|-------|
| 0–4,000        | 10.42 | 7.60  | 5.69  | 4.62  | 4.04   | 3.21    | 3.04    | 2.80  |
| 4,001–7,000    | 11.18 | 7.76  | 5.82  | 4.85  | 4.27   | 3.46    | 3.42    | 3.35  |
| 7,001–10,000   | 11.63 | 8.05  | 5.92  | 4.95  | 4.47   | 3.78    | 3.72    | 3.64  |
| 10,001–13,000  | 12.54 | 9.35  | 6.81  | 5.92  | 5.42   | 4.81    | 4.74    | 4.73  |
| 13,001–16,000  | 13.46 |10.58  | 7.77  | 6.88  | 6.39   | 5.70    | 5.30    | 5.08  |
| 16,001–20,000  | 14.69 |10.93  | 9.07  | 8.10  | 7.63   | 7.21    | 6.95    | 6.67  |
| 20,001–23,000  | 15.60 |11.63  | 9.66  | 8.79  | 9.30   | 8.02    | 7.63    | 7.59  |

For over 50,000 stitches: add $0.35 per 1,000 stitches above 50,000.

**Embroidery Fees (Redwall reference):**
- Digitizing setup: $45 flat (standard size)
- Thread color change: $12.00 per change
- Minimum order: $75.00

**When quoting embroidery:** produce a draft using these Redwall rates, clearly label
it "DRAFT — pending Bayview Threadworks confirmation," and flag for Lisa to verify
before the email is sent.

---

## Add-On Fees Summary

Always check every one of these before finalizing a quote:

| Fee | Amount | When Applied |
|-----|--------|-------------|
| Screen setup (OSP) | $20/color | Orders under 96 pcs at OSP |
| Screen setup (Redwall) | $32/color | Orders under 144 pcs at Redwall |
| Ink change | $20 (OSP) / $24 (Redwall) | When ink color changes between garment colors |
| Custom PMS ink match | $20/color (OSP) | When exact Pantone color is required |
| Underbase | Adds 1 ink color to count | Printing on dark garment with non-dark design |
| Digitization fee | $45 (Redwall ref.) | One-time, embroidery orders |
| Thread color change | $12.00 | Embroidery, per color change |
| DTF/DTG setup | $35 | One-time per design |
| Oversized print | See supplier tables | Print dimensions exceed standard |
| Rush (Redwall) | +15% / +30% / +50% | 2 / 1 / same-day rush |
| Extended sizes (2XL+) | Per S&S `customerPrice` | Higher wholesale cost for extended sizes |
| Custom names | $6.50 each | Per-garment variable data (Redwall) |
| Custom numbers | $6.50 each | Per-garment variable data (Redwall) |
| Names + numbers | $12.00 each | Both on same garment (Redwall) |
| Art / design fee | Varies | If Giltee creates or substantially modifies artwork |

---

## Calculation Output Format

Produce a fully itemized price breakdown in this format:

```
=== GILTEE PRICE CALCULATION ===

ORDER: [Customer name] — [Qty] x [Garment] — [Method]

QUANTITY TIER: [tier range]
SUPPLIER: [OSP / Redwall / Bayview]

GARMENT COST (per unit)
  S&S wholesale (customerPrice): $X.XX
  Extended size surcharge (if applicable): $X.XX
  Garment cost subtotal: $X.XX

DECORATION COST (per unit, per location)
  Location 1 — [Front/Back/etc.] — [X] color(s): $X.XX
  Location 2 (if applicable): $X.XX
  Decoration subtotal: $X.XX

PROFIT MARGIN (per unit): $X.XX

TOTAL PRICE PER UNIT: $X.XX

ONE-TIME FEES
  Screen setup ([X] colors × $XX): $X.XX
  Digitization fee: $X.XX
  DTF/DTG setup: $X.XX
  Art/design fee: $X.XX
  [other applicable fees]
  One-time fees subtotal: $X.XX

ORDER TOTAL
  Per-unit × quantity: $X.XX × [qty] = $X.XX
  + One-time fees: $X.XX
  GRAND TOTAL: $X.XX

FLAGS FOR REVIEWER:
  [Any warnings, deferred items, or assumptions made]
===
```

---

## Hard Rules

- Never quote below the profit margin floors in the tier table.
- Never guess on garment cost — always pull from S&S API.
- For embroidery: always flag for Lisa review until Bayview pricing is confirmed.
- For multi-location orders: calculate decoration cost for each location separately,
  then sum.
- For dark garments: add underbase as an extra color before looking up the screen
  print cost. This is a common miss — always check garment color.
- If quantity is between two tier breaks, use the lower tier (higher profit). Example:
  60 units = 48–95 tier.
