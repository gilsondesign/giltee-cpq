# Giltee Quote Generator — Plan B: Backend Services + API Routes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build all backend services (S&S, pricing, Claude AI, PDF, Gmail/Drive) and all API routes (quotes, garments, gmail) — a fully working AI quote pipeline that Plan C's frontend wires up.

**Architecture:** All services in `server/services/`, each with a single responsibility. `pipelineService.js` orchestrates the full AI workflow. Routes in `server/routes/` consume services. All new routes mount under `/api/*`, already guarded by `requireAuth` from Plan A.

**Tech Stack:** Node.js 20 (native `fetch`), `@anthropic-ai/sdk` ^0.39, `googleapis` ^140, `pdfmake` ^0.2.9, Jest + Supertest

**Skill files location:** `c:\Users\gilson\OneDrive - Zywave Inc\Documents\Projects\Giltee\Claude Cowork\Quote Generator\Skills\`

**Prerequisites before starting:**
- `.env` must have `ANTHROPIC_API_KEY`, `SS_ACCOUNT_NUMBER`, `SS_API_KEY`
- `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_TARGET_ACCOUNT`, `GOOGLE_DRIVE_FOLDER_ID` (needed for Task 6 only — can be placeholder until then)

**This plan produces:** A running backend that accepts a raw customer inquiry, runs it through the AI pipeline (intake → garment lookup → pricing → QA → email draft → PDF → Gmail draft), and stores all results on the quote record. Plan C's frontend then displays the results.

**Subsequent plan:** Plan C — all frontend pages (Ledger, CreateQuote, ViewQuote) + integration wiring

---

## File Map

| File | Responsibility |
|------|----------------|
| `server/skills/intake.md` | Giltee quote intake skill (Claude system prompt) |
| `server/skills/garment.md` | Giltee garment knowledge skill (Claude system prompt) |
| `server/skills/pricing-rules.md` | Giltee pricing rules reference |
| `server/skills/qa.md` | Giltee QA skill (Claude system prompt) |
| `server/skills/email-drafting.md` | Giltee email drafting skill (Claude system prompt) |
| `server/skills/index.js` | Loads all skills from disk, strips frontmatter, exports as named string constants |
| `server/services/ssService.js` | S&S Activewear API: product lookup by style+color, availability check, pricing |
| `server/services/pricingService.js` | Pure pricing math: profit tiers, OSP/Redwall decoration tables, setup fees, grand totals |
| `server/services/claudeService.js` | Anthropic SDK wrapper: accepts system+user prompt, returns text |
| `server/services/pdfService.js` | pdfmake PDF generation: branded Giltee quote document, returns Buffer |
| `server/services/gmailService.js` | Gmail API: create draft with PDF attachment, get draft, delete draft |
| `server/services/driveService.js` | Google Drive API: upload PDF to configured folder, return shareable URL |
| `server/services/pipelineService.js` | Orchestrates full AI pipeline: intake→garment→pricing→QA→email→PDF→drive→gmail |
| `server/routes/quotes.js` | GET/POST/PATCH quotes + POST /api/quotes/:id/run |
| `server/routes/garments.js` | GET /api/garments/lookup — proxies ssService |
| `server/routes/gmail.js` | GET/DELETE /api/gmail/draft/:id |
| `server/index.js` | Uncomment 3 route registrations (minimal modification) |

---

## Task 1: Skill Files Setup

**Files:**
- Create: `server/skills/intake.md`
- Create: `server/skills/garment.md`
- Create: `server/skills/pricing-rules.md`
- Create: `server/skills/qa.md`
- Create: `server/skills/email-drafting.md`
- Create: `server/skills/index.js`

- [ ] **Step 1: Copy skill files into the project**

Run these commands (adjust the source path if needed — the Skills folder is adjacent to the app):

```bash
SKILLS_SRC="c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Skills"
APP="c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App"

mkdir -p "$APP/server/skills"
cp "$SKILLS_SRC/giltee-quote-intake/SKILL.md"      "$APP/server/skills/intake.md"
cp "$SKILLS_SRC/giltee-garment-knowledge/SKILL.md" "$APP/server/skills/garment.md"
cp "$SKILLS_SRC/giltee-pricing-rules/SKILL.md"     "$APP/server/skills/pricing-rules.md"
cp "$SKILLS_SRC/giltee-quote-qa/SKILL.md"           "$APP/server/skills/qa.md"
cp "$SKILLS_SRC/giltee-email-drafting/SKILL.md"    "$APP/server/skills/email-drafting.md"
```

Verify all 5 files exist:
```bash
ls "$APP/server/skills/"
```
Expected: `email-drafting.md  garment.md  intake.md  pricing-rules.md  qa.md`

- [ ] **Step 2: Create `server/skills/index.js`**

```js
const fs = require('fs')
const path = require('path')

// Strip YAML frontmatter (--- ... ---\n) before using as Claude system prompts
function loadSkill(filename) {
  const content = fs.readFileSync(path.join(__dirname, filename), 'utf-8')
  return content.replace(/^---[\s\S]*?---\n/, '')
}

module.exports = {
  INTAKE: loadSkill('intake.md'),
  GARMENT: loadSkill('garment.md'),
  PRICING_RULES: loadSkill('pricing-rules.md'),
  QA: loadSkill('qa.md'),
  EMAIL_DRAFTING: loadSkill('email-drafting.md'),
}
```

- [ ] **Step 3: Write the test**

Create `server/__tests__/skills.test.js`:

```js
jest.mock('../db/pool', () => ({ query: jest.fn(), on: jest.fn() }))

const skills = require('../skills/index')

describe('skills loader', () => {
  it('loads all 5 skills as non-empty strings', () => {
    expect(typeof skills.INTAKE).toBe('string')
    expect(typeof skills.GARMENT).toBe('string')
    expect(typeof skills.PRICING_RULES).toBe('string')
    expect(typeof skills.QA).toBe('string')
    expect(typeof skills.EMAIL_DRAFTING).toBe('string')
    expect(skills.INTAKE.length).toBeGreaterThan(100)
    expect(skills.QA.length).toBeGreaterThan(100)
  })

  it('strips YAML frontmatter from skill content', () => {
    // None of the exported skills should start with ---
    expect(skills.INTAKE.startsWith('---')).toBe(false)
    expect(skills.QA.startsWith('---')).toBe(false)
  })

  it('INTAKE skill includes required field names', () => {
    expect(skills.INTAKE).toContain('Decoration')
    expect(skills.INTAKE).toContain('Customer')
  })
})
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:server
```

Expected: All existing tests pass + 3 new skills tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/skills/
git commit -m "feat: add Giltee skill files and skills loader"
```

---

## Task 2: S&S Activewear Service

**Files:**
- Create: `server/services/ssService.js`
- Create: `server/__tests__/ssService.test.js`

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/ssService.test.js`:

```js
jest.mock('../db/pool', () => ({ query: jest.fn(), on: jest.fn() }))

// Mock global fetch
global.fetch = jest.fn()

const ssService = require('../services/ssService')

beforeEach(() => fetch.mockReset())

const MOCK_SKUS = [
  { sku: 'B3001NVY-S',  colorName: 'Navy',  sizeName: 'S',  sizePriceCodeName: 'S',   customerPrice: 4.50, qty: 500, colorFrontImage: '/images/navy.jpg' },
  { sku: 'B3001NVY-M',  colorName: 'Navy',  sizeName: 'M',  sizePriceCodeName: 'M',   customerPrice: 4.50, qty: 800, colorFrontImage: '/images/navy.jpg' },
  { sku: 'B3001NVY-2X', colorName: 'Navy',  sizeName: '2XL',sizePriceCodeName: '2XL', customerPrice: 6.25, qty: 200, colorFrontImage: '/images/navy.jpg' },
  { sku: 'B3001RED-S',  colorName: 'Red',   sizeName: 'S',  sizePriceCodeName: 'S',   customerPrice: 4.50, qty: 300, colorFrontImage: '/images/red.jpg'  },
]

function mockFetchSuccess(data) {
  fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => data
  })
}

describe('ssService.lookupGarment', () => {
  it('returns available garment data when color is found', async () => {
    mockFetchSuccess(MOCK_SKUS)
    const result = await ssService.lookupGarment({ style: 'bella+canvas+3001', color: 'Navy' })

    expect(result.available).toBe(true)
    expect(result.requestedColor).toBe('Navy')
    expect(result.standardPrice).toBe(4.50)
    expect(result.imageUrl).toContain('ssactivewear.com')
  })

  it('returns extended size SKUs separately', async () => {
    mockFetchSuccess(MOCK_SKUS)
    const result = await ssService.lookupGarment({ style: 'bella+canvas+3001', color: 'Navy' })

    expect(result.extendedSkus).toHaveLength(1)
    expect(result.extendedSkus[0].size).toBe('2XL')
    expect(result.extendedSkus[0].price).toBe(6.25)
  })

  it('returns available: false with alternatives when color not found', async () => {
    mockFetchSuccess(MOCK_SKUS)
    const result = await ssService.lookupGarment({ style: 'bella+canvas+3001', color: 'Purple' })

    expect(result.available).toBe(false)
    expect(Array.isArray(result.alternatives)).toBe(true)
    expect(result.alternatives.length).toBeGreaterThan(0)
  })

  it('throws when S&S API returns non-200', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(ssService.lookupGarment({ style: 'x', color: 'y' })).rejects.toThrow('S&S API error')
  })
})

describe('ssService.buildAuthHeader', () => {
  it('returns a Basic auth header', () => {
    process.env.SS_ACCOUNT_NUMBER = 'testacct'
    process.env.SS_API_KEY = 'testkey'
    const header = ssService.buildAuthHeader()
    expect(header).toMatch(/^Basic /)
    const decoded = Buffer.from(header.replace('Basic ', ''), 'base64').toString()
    expect(decoded).toBe('testacct:testkey')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:server -- --testPathPattern="ssService"
```

Expected: FAIL — `Cannot find module '../services/ssService'`

- [ ] **Step 3: Create `server/services/ssService.js`**

```js
const SS_BASE_URL = 'https://api.ssactivewear.com/v2'
const EXTENDED_SIZE_CODES = new Set(['2XL', '3XL', '4XL', '5XL'])

function buildAuthHeader() {
  const token = Buffer.from(
    `${process.env.SS_ACCOUNT_NUMBER}:${process.env.SS_API_KEY}`
  ).toString('base64')
  return `Basic ${token}`
}

async function fetchSS(path) {
  const response = await fetch(`${SS_BASE_URL}${path}`, {
    headers: {
      Authorization: buildAuthHeader(),
      Accept: 'application/json',
    },
  })
  if (!response.ok) throw new Error(`S&S API error: ${response.status} on ${path}`)
  return response.json()
}

/**
 * Look up a garment by style and color.
 * Returns structured availability + pricing data for use in the pipeline.
 *
 * @param {{ style: string, color: string }} params
 * @returns {Promise<GarmentData>}
 */
async function lookupGarment({ style, color }) {
  const skus = await fetchSS(`/products/?style=${encodeURIComponent(style)}&mediatype=json`)

  const colorSkus = skus.filter(
    s => s.colorName && s.colorName.toLowerCase().includes(color.toLowerCase())
  )

  if (!colorSkus.length) {
    const alternatives = [...new Set(skus.map(s => s.colorName))].slice(0, 5)
    return {
      style,
      requestedColor: color,
      available: false,
      alternatives,
      standardPrice: null,
      extendedSkus: [],
      imageUrl: null,
      skus: [],
    }
  }

  const standardSkus = colorSkus.filter(s => !EXTENDED_SIZE_CODES.has(s.sizePriceCodeName))
  const extendedSkus = colorSkus.filter(s => EXTENDED_SIZE_CODES.has(s.sizePriceCodeName))

  const standardPrice = standardSkus.length
    ? Math.min(...standardSkus.map(s => s.customerPrice))
    : null

  const outOfSizes = colorSkus.filter(s => s.qty === 0).map(s => s.sizeName)
  const lowStock = colorSkus.some(s => s.qty > 0 && s.qty < 50)

  const imageUrl = colorSkus[0]?.colorFrontImage
    ? `https://www.ssactivewear.com/${colorSkus[0].colorFrontImage}`
    : null

  return {
    style,
    requestedColor: color,
    available: true,
    lowStock,
    outOfSizes,
    standardPrice,
    extendedSkus: extendedSkus.map(s => ({
      size: s.sizeName,
      price: s.customerPrice,
      qty: s.qty,
    })),
    imageUrl,
    skus: colorSkus.map(s => ({
      sku: s.sku,
      size: s.sizeName,
      color: s.colorName,
      price: s.customerPrice,
      qty: s.qty,
      isExtended: EXTENDED_SIZE_CODES.has(s.sizePriceCodeName),
    })),
  }
}

module.exports = { lookupGarment, buildAuthHeader }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:server -- --testPathPattern="ssService"
```

Expected: All 5 ssService tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/ssService.js server/__tests__/ssService.test.js
git commit -m "feat: add S&S Activewear service with garment lookup"
```

---

## Task 3: Pricing Service

**Files:**
- Create: `server/services/pricingService.js`
- Create: `server/__tests__/pricingService.test.js`

This service is pure math — no external API calls. All data is from the Giltee pricing rules skill.

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/pricingService.test.js`:

```js
jest.mock('../db/pool', () => ({ query: jest.fn(), on: jest.fn() }))

const pricingService = require('../services/pricingService')

describe('getMarginForQuantity', () => {
  it('returns correct margin for each tier', () => {
    expect(pricingService.getMarginForQuantity(24)).toBe(6.67)
    expect(pricingService.getMarginForQuantity(47)).toBe(6.67)
    expect(pricingService.getMarginForQuantity(48)).toBe(4.69)
    expect(pricingService.getMarginForQuantity(95)).toBe(4.69)
    expect(pricingService.getMarginForQuantity(96)).toBe(3.13)
    expect(pricingService.getMarginForQuantity(144)).toBe(2.26)
    expect(pricingService.getMarginForQuantity(300)).toBe(1.67)
    expect(pricingService.getMarginForQuantity(500)).toBe(1.67)
  })

  it('returns null for quantities below 24', () => {
    expect(pricingService.getMarginForQuantity(23)).toBeNull()
    expect(pricingService.getMarginForQuantity(1)).toBeNull()
  })
})

describe('getOspDecorationCost', () => {
  it('returns correct OSP cost for 48-95 tier, 2 colors', () => {
    expect(pricingService.getOspDecorationCost(60, 2)).toBe(2.24)
  })
  it('returns correct OSP cost for 24-47 tier, 1 color', () => {
    expect(pricingService.getOspDecorationCost(36, 1)).toBe(3.00)
  })
  it('returns correct OSP cost for 144-299 tier, 4 colors', () => {
    expect(pricingService.getOspDecorationCost(150, 4)).toBe(2.63)
  })
  it('returns null when quantity is below minimum for OSP table (below 12)', () => {
    expect(pricingService.getOspDecorationCost(5, 1)).toBeNull()
  })
})

describe('getRedwallDecorationCost', () => {
  it('returns correct Redwall cost for 48-95 tier, 2 colors', () => {
    expect(pricingService.getRedwallDecorationCost(60, 2)).toBe(3.22)
  })
  it('returns correct Redwall cost for 96-143 tier, 3 colors', () => {
    expect(pricingService.getRedwallDecorationCost(100, 3)).toBe(3.29)
  })
})

describe('calculateScreenPrintQuote', () => {
  it('calculates correct per-unit and total for a 60-unit, 2-color, single-location order', () => {
    const result = pricingService.calculateScreenPrintQuote({
      quantity: 60,
      garmentCostPerUnit: 4.50,
      locations: [{ colorCount: 2, printSize: 'STANDARD' }],
      isDarkGarment: false,
      isReorder: false,
    })

    // OSP: garment 4.50 + decoration 2.24 (48-95 tier, 2c) + margin 4.69 = 11.43/unit
    // Setup fees: $20 × 2 colors = $40 (60 < 96 so fees apply)
    expect(result.osp.perUnitGarment).toBe(4.50)
    expect(result.osp.perUnitDecoration).toBe(2.24)
    expect(result.osp.perUnitProfit).toBe(4.69)
    expect(result.osp.perUnitTotal).toBe(11.43)
    expect(result.osp.setupFees.screenSetup).toBe(40)
    expect(result.osp.orderTotal).toBeCloseTo(60 * 11.43 + 40, 2)
  })

  it('waives OSP setup fees at 96+ pieces', () => {
    const result = pricingService.calculateScreenPrintQuote({
      quantity: 100,
      garmentCostPerUnit: 4.50,
      locations: [{ colorCount: 2, printSize: 'STANDARD' }],
      isDarkGarment: false,
      isReorder: false,
    })
    expect(result.osp.setupFees.screenSetup).toBe(0)
  })

  it('adds underbase color to count on dark garments', () => {
    const resultLight = pricingService.calculateScreenPrintQuote({
      quantity: 60, garmentCostPerUnit: 4.50,
      locations: [{ colorCount: 2, printSize: 'STANDARD' }],
      isDarkGarment: false, isReorder: false,
    })
    const resultDark = pricingService.calculateScreenPrintQuote({
      quantity: 60, garmentCostPerUnit: 4.50,
      locations: [{ colorCount: 2, printSize: 'STANDARD' }],
      isDarkGarment: true, isReorder: false,
    })
    // Dark garment: 2 colors + 1 underbase = 3 colors for pricing
    // OSP 48-95, 3c = 2.90 vs 2c = 2.24
    expect(resultDark.osp.perUnitDecoration).toBe(2.90)
    expect(resultLight.osp.perUnitDecoration).toBe(2.24)
  })

  it('waives Redwall setup fees at 144+ pieces', () => {
    const result = pricingService.calculateScreenPrintQuote({
      quantity: 150,
      garmentCostPerUnit: 4.50,
      locations: [{ colorCount: 3, printSize: 'STANDARD' }],
      isDarkGarment: false,
      isReorder: false,
    })
    expect(result.redwall.setupFees.screenSetup).toBe(0)
  })
})

describe('calculateDTFQuote', () => {
  it('calculates correct DTF quote for 60 units, standard print size', () => {
    const result = pricingService.calculateDTFQuote({
      quantity: 60,
      garmentCostPerUnit: 4.50,
      printSize: 'STANDARD',
    })
    // DTF 48-95 tier standard = $6.25/unit
    // Margin 48-95 = $4.69/unit
    // One-time setup = $35
    expect(result.perUnitDecoration).toBe(6.25)
    expect(result.perUnitProfit).toBe(4.69)
    expect(result.perUnitTotal).toBeCloseTo(4.50 + 6.25 + 4.69, 2)
    expect(result.setupFees.dtfSetup).toBe(35)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:server -- --testPathPattern="pricingService"
```

Expected: FAIL — `Cannot find module '../services/pricingService'`

- [ ] **Step 3: Create `server/services/pricingService.js`**

```js
// ─── Profit Margin Tiers ──────────────────────────────────────────────────────
// Source: Giltee pricing rules skill, Layer 1
const PROFIT_TIERS = [
  { min: 24,  max: 47,       profit: 6.67 },
  { min: 48,  max: 95,       profit: 4.69 },
  { min: 96,  max: 143,      profit: 3.13 },
  { min: 144, max: 299,      profit: 2.26 },
  { min: 300, max: Infinity, profit: 1.67 },
]

// ─── OSP Screen Print Decoration Costs ───────────────────────────────────────
// Source: Giltee pricing rules skill, Layer 3A
// costs array: [1c, 2c, 3c, 4c, 5c, 6c, 7c, 8c] per unit
const OSP_SCREEN_PRINT = [
  { min: 12,   max: 23,       costs: [6.00, 9.20, 12.40, 15.60, 18.80, 22.00, 25.20, 28.40] },
  { min: 24,   max: 47,       costs: [3.00, 4.60,  6.20,  7.80,  9.40, 11.00, 12.60, 14.20] },
  { min: 48,   max: 95,       costs: [1.58, 2.24,  2.90,  3.56,  4.22,  4.88,  5.54,  6.20] },
  { min: 96,   max: 143,      costs: [1.50, 2.07,  2.64,  3.21,  3.78,  4.35,  4.92,  5.49] },
  { min: 144,  max: 299,      costs: [1.28, 1.73,  2.18,  2.63,  3.08,  3.53,  3.98,  4.43] },
  { min: 300,  max: 499,      costs: [0.97, 1.24,  1.51,  1.78,  2.05,  2.32,  2.59,  2.86] },
  { min: 500,  max: 749,      costs: [0.86, 1.03,  1.20,  1.37,  1.54,  1.71,  1.88,  2.05] },
  { min: 750,  max: 999,      costs: [0.81, 0.96,  1.11,  1.26,  1.41,  1.56,  1.71,  1.86] },
  { min: 1000, max: 2499,     costs: [0.73, 0.86,  0.99,  1.12,  1.25,  1.38,  1.51,  1.64] },
  { min: 2500, max: Infinity, costs: [0.71, 0.83,  0.95,  1.07,  1.19,  1.31,  1.43,  1.55] },
]

// ─── Redwall Screen Print Decoration Costs ────────────────────────────────────
// Source: Giltee pricing rules skill, Layer 3B
const REDWALL_SCREEN_PRINT = [
  { min: 6,    max: 11,       costs: [7.88, 9.43, 10.93, 12.47, 14.00, 15.52, 17.04, 18.57] },
  { min: 12,   max: 23,       costs: [4.49, 5.58,  6.80,  7.79,  9.09, 10.49, 11.87, 13.25] },
  { min: 24,   max: 47,       costs: [2.99, 3.74,  4.60,  5.10,  5.89,  7.27,  8.65, 10.03] },
  { min: 48,   max: 95,       costs: [2.37, 3.22,  3.91,  4.49,  5.29,  6.67,  8.04,  8.81] },
  { min: 96,   max: 143,      costs: [2.07, 2.69,  3.29,  3.98,  4.60,  5.22,  6.05,  6.89] },
  { min: 144,  max: 299,      costs: [1.70, 2.36,  2.92,  3.32,  3.81,  4.38,  4.86,  5.34] },
  { min: 300,  max: 499,      costs: [1.24, 1.47,  1.80,  2.03,  2.33,  2.48,  2.71,  2.86] },
  { min: 500,  max: 999,      costs: [1.01, 1.17,  1.36,  1.52,  1.73,  1.81,  2.05,  2.24] },
  { min: 1000, max: 2499,     costs: [0.85, 1.01,  1.07,  1.14,  1.31,  1.45,  1.56,  1.68] },
  { min: 2500, max: Infinity, costs: [0.70, 0.77,  0.84,  0.89,  1.00,  1.06,  1.13,  1.21] },
]

// ─── DTF Decoration Costs ─────────────────────────────────────────────────────
// Source: Giltee pricing rules skill, Layer 3C
// qty breaks: 1-5, 6-11, 12-23, 24-47, 48-95, 96-143, 144-299, 300-599, 600+
const DTF_QTY_BREAKS = [1, 6, 12, 24, 48, 96, 144, 300, 600]
const DTF_COSTS = {
  SMALL:     [4.50, 4.00, 3.75, 3.50, 3.25, 3.00, 2.75, 2.50, 2.25],
  STANDARD:  [7.25, 6.95, 6.75, 6.50, 6.25, 6.00, 5.75, 5.50, 5.00],
  OVERSIZED: [11.25, 10.75, 10.25, 10.00, 9.75, 9.50, 9.25, 9.00, 8.75],
}

// ─── DTG Decoration Costs ─────────────────────────────────────────────────────
// Source: Giltee pricing rules skill, Layer 3D
// Same qty breaks as DTF
const DTG_COSTS = {
  STANDARD:  [7.25, 6.95, 6.75, 6.50, 6.25, 6.00, 5.75, 5.50, 5.00],
  OVERSIZED: [8.75, 8.45, 8.25, 8.00, 7.75, 7.50, 7.25, 7.00, 6.50],
}

// ─── Lookup helpers ───────────────────────────────────────────────────────────

function getMarginForQuantity(qty) {
  const tier = PROFIT_TIERS.find(t => qty >= t.min && qty <= t.max)
  return tier ? tier.profit : null
}

function getOspDecorationCost(qty, colorCount) {
  const row = OSP_SCREEN_PRINT.find(r => qty >= r.min && qty <= r.max)
  if (!row) return null
  const idx = Math.min(colorCount, 8) - 1
  return row.costs[idx] ?? null
}

function getRedwallDecorationCost(qty, colorCount) {
  const row = REDWALL_SCREEN_PRINT.find(r => qty >= r.min && qty <= r.max)
  if (!row) return null
  const idx = Math.min(colorCount, 8) - 1
  return row.costs[idx] ?? null
}

function getDTFDecorationCost(qty, printSize = 'STANDARD') {
  const tierIndex = DTF_QTY_BREAKS.filter(b => qty >= b).length - 1
  const costs = DTF_COSTS[printSize] || DTF_COSTS.STANDARD
  return costs[Math.min(tierIndex, costs.length - 1)]
}

function getDTGDecorationCost(qty, printSize = 'STANDARD') {
  const tierIndex = DTF_QTY_BREAKS.filter(b => qty >= b).length - 1
  const costs = DTG_COSTS[printSize] || DTG_COSTS.STANDARD
  return costs[Math.min(tierIndex, costs.length - 1)]
}

function round2(n) {
  return Math.round(n * 100) / 100
}

// ─── Screen Print Calculation ─────────────────────────────────────────────────

/**
 * Calculate screen print pricing for both OSP and Redwall.
 *
 * @param {{
 *   quantity: number,
 *   garmentCostPerUnit: number,
 *   locations: Array<{ colorCount: number, printSize: 'STANDARD'|'OVERSIZED'|'JUMBO' }>,
 *   isDarkGarment: boolean,
 *   isReorder: boolean,
 * }} params
 */
function calculateScreenPrintQuote({ quantity, garmentCostPerUnit, locations, isDarkGarment, isReorder }) {
  const margin = getMarginForQuantity(quantity)
  const flags = []

  if (margin === null) {
    flags.push(`Quantity ${quantity} is below the screen print minimum (24 units). Consider DTF or DTG.`)
  }

  // Sum decoration cost across all locations
  function sumDecoration(costFn) {
    return locations.reduce((sum, loc) => {
      // Add underbase color on dark garments (only for screen print)
      const effectiveColors = isDarkGarment ? loc.colorCount + 1 : loc.colorCount
      const cost = costFn(quantity, effectiveColors)
      return sum + (cost || 0)
    }, 0)
  }

  const totalOspDecoration = round2(sumDecoration(getOspDecorationCost))
  const totalRedwallDecoration = round2(sumDecoration(getRedwallDecorationCost))
  const perUnitProfit = margin || 0

  // Setup fees — OSP: $20/color waived at 96+; Redwall: $32/color/location waived at 144+
  const totalColors = locations.reduce((sum, loc) => {
    return sum + (isDarkGarment ? loc.colorCount + 1 : loc.colorCount)
  }, 0)

  const ospSetupFee = quantity >= 96 ? 0 : (isReorder ? 10 : 20) * totalColors
  const redwallSetupFee = quantity >= 144 ? 0 : locations.reduce((sum, loc) => {
    const colors = isDarkGarment ? loc.colorCount + 1 : loc.colorCount
    return sum + (isReorder ? 26 : 32) * colors
  }, 0)

  const ospPerUnit = round2(garmentCostPerUnit + totalOspDecoration + perUnitProfit)
  const redwallPerUnit = round2(garmentCostPerUnit + totalRedwallDecoration + perUnitProfit)

  const ospTotal = round2(ospPerUnit * quantity + ospSetupFee)
  const redwallTotal = round2(redwallPerUnit * quantity + redwallSetupFee)

  if (isDarkGarment) {
    flags.push('Dark garment: underbase added to color count for pricing.')
  }

  return {
    osp: {
      perUnitGarment: garmentCostPerUnit,
      perUnitDecoration: totalOspDecoration,
      perUnitProfit,
      perUnitTotal: ospPerUnit,
      setupFees: { screenSetup: ospSetupFee },
      orderTotal: ospTotal,
      flags,
    },
    redwall: {
      perUnitGarment: garmentCostPerUnit,
      perUnitDecoration: totalRedwallDecoration,
      perUnitProfit,
      perUnitTotal: redwallPerUnit,
      setupFees: { screenSetup: redwallSetupFee },
      orderTotal: redwallTotal,
      flags,
    },
    recommended: ospTotal <= redwallTotal ? 'OSP' : 'REDWALL',
  }
}

// ─── DTF Calculation ──────────────────────────────────────────────────────────

function calculateDTFQuote({ quantity, garmentCostPerUnit, printSize = 'STANDARD' }) {
  const perUnitDecoration = getDTFDecorationCost(quantity, printSize)
  const perUnitProfit = getMarginForQuantity(quantity) || 0
  const perUnitTotal = round2(garmentCostPerUnit + perUnitDecoration + perUnitProfit)
  const setupFees = { dtfSetup: 35 }
  const orderTotal = round2(perUnitTotal * quantity + 35)

  return {
    perUnitGarment: garmentCostPerUnit,
    perUnitDecoration,
    perUnitProfit,
    perUnitTotal,
    setupFees,
    orderTotal,
    flags: quantity < 24 ? ['Sub-24 unit order — confirm profit margin with Lisa.'] : [],
  }
}

// ─── DTG Calculation ──────────────────────────────────────────────────────────

function calculateDTGQuote({ quantity, garmentCostPerUnit, printSize = 'STANDARD' }) {
  const perUnitDecoration = getDTGDecorationCost(quantity, printSize)
  const perUnitProfit = getMarginForQuantity(quantity) || 0
  const perUnitTotal = round2(garmentCostPerUnit + perUnitDecoration + perUnitProfit)
  const setupFees = { dtgSetup: 35 }
  const orderTotal = round2(perUnitTotal * quantity + 35)

  return {
    perUnitGarment: garmentCostPerUnit,
    perUnitDecoration,
    perUnitProfit,
    perUnitTotal,
    setupFees,
    orderTotal,
    flags: quantity < 24 ? ['Sub-24 unit order — confirm profit margin with Lisa.'] : [],
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Calculate pricing for a quote based on decoration method.
 * For SCREEN_PRINT, returns both OSP and Redwall. For others, returns a single breakdown.
 */
function calculateQuote(params) {
  const { decorationMethod } = params
  switch (decorationMethod) {
    case 'SCREEN_PRINT':
      return calculateScreenPrintQuote(params)
    case 'DTF':
      return { single: calculateDTFQuote(params), recommended: 'REDWALL' }
    case 'DTG':
      return { single: calculateDTGQuote(params), recommended: 'REDWALL' }
    case 'EMBROIDERY':
      return {
        single: null,
        recommended: 'BAYVIEW',
        flags: ['EMBROIDERY: Draft pricing only — flag for Bayview Threadworks confirmation.'],
      }
    default:
      throw new Error(`Unknown decoration method: ${decorationMethod}`)
  }
}

module.exports = {
  getMarginForQuantity,
  getOspDecorationCost,
  getRedwallDecorationCost,
  getDTFDecorationCost,
  getDTGDecorationCost,
  calculateScreenPrintQuote,
  calculateDTFQuote,
  calculateDTGQuote,
  calculateQuote,
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:server -- --testPathPattern="pricingService"
```

Expected: All 10 pricingService tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/pricingService.js server/__tests__/pricingService.test.js
git commit -m "feat: add pricing service with OSP/Redwall/DTF/DTG tables"
```

---

## Task 4: Claude Service

**Files:**
- Create: `server/services/claudeService.js`
- Create: `server/__tests__/claudeService.test.js`

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/claudeService.test.js`:

```js
jest.mock('../db/pool', () => ({ query: jest.fn(), on: jest.fn() }))

// Mock the Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Hello from Claude' }]
      })
    }
  }))
})

const Anthropic = require('@anthropic-ai/sdk')
const claudeService = require('../services/claudeService')

beforeEach(() => {
  // Reset all mocks but keep the implementation
  jest.clearAllMocks()
  Anthropic.mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Hello from Claude' }]
      })
    }
  }))
})

describe('claudeService.callClaude', () => {
  it('calls Anthropic messages.create with correct params', async () => {
    const result = await claudeService.callClaude({
      systemPrompt: 'You are a helpful assistant.',
      userPrompt: 'Say hello.',
    })

    const instance = Anthropic.mock.results[0].value
    expect(instance.messages.create).toHaveBeenCalledWith(expect.objectContaining({
      system: 'You are a helpful assistant.',
      messages: [{ role: 'user', content: 'Say hello.' }],
    }))
    expect(result).toBe('Hello from Claude')
  })

  it('uses claude-opus-4-6 as default model', async () => {
    await claudeService.callClaude({ systemPrompt: 'x', userPrompt: 'y' })
    const instance = Anthropic.mock.results[0].value
    expect(instance.messages.create).toHaveBeenCalledWith(expect.objectContaining({
      model: 'claude-opus-4-6',
    }))
  })

  it('accepts model override', async () => {
    await claudeService.callClaude({
      systemPrompt: 'x',
      userPrompt: 'y',
      model: 'claude-sonnet-4-6',
    })
    const instance = Anthropic.mock.results[0].value
    expect(instance.messages.create).toHaveBeenCalledWith(expect.objectContaining({
      model: 'claude-sonnet-4-6',
    }))
  })

  it('throws when Anthropic SDK throws', async () => {
    Anthropic.mockImplementation(() => ({
      messages: {
        create: jest.fn().mockRejectedValue(new Error('API rate limit'))
      }
    }))
    await expect(
      claudeService.callClaude({ systemPrompt: 'x', userPrompt: 'y' })
    ).rejects.toThrow('API rate limit')
  })
})

describe('claudeService.parseJSONFromText', () => {
  it('parses raw JSON', () => {
    const result = claudeService.parseJSONFromText('{"foo": "bar"}')
    expect(result).toEqual({ foo: 'bar' })
  })

  it('extracts JSON from markdown code block', () => {
    const text = 'Here is the result:\n```json\n{"foo": "bar"}\n```\nDone.'
    const result = claudeService.parseJSONFromText(text)
    expect(result).toEqual({ foo: 'bar' })
  })

  it('throws on invalid JSON', () => {
    expect(() => claudeService.parseJSONFromText('not json')).toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:server -- --testPathPattern="claudeService"
```

Expected: FAIL — `Cannot find module '../services/claudeService'`

- [ ] **Step 3: Create `server/services/claudeService.js`**

```js
const Anthropic = require('@anthropic-ai/sdk')

/**
 * Call Claude with a system prompt and user prompt.
 * Returns the text content of the first response message.
 */
async function callClaude({
  systemPrompt,
  userPrompt,
  model = 'claude-opus-4-6',
  maxTokens = 4096,
}) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })
  return response.content[0].text
}

/**
 * Parse JSON from a Claude response that may be wrapped in a markdown code block.
 * Handles both raw JSON and ```json ... ``` wrapped responses.
 */
function parseJSONFromText(text) {
  // Try to extract JSON from a markdown code block first
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    return JSON.parse(codeBlockMatch[1].trim())
  }
  // Try direct parse
  return JSON.parse(text.trim())
}

module.exports = { callClaude, parseJSONFromText }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:server -- --testPathPattern="claudeService"
```

Expected: All 7 claudeService tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/claudeService.js server/__tests__/claudeService.test.js
git commit -m "feat: add Claude service wrapper with JSON response parser"
```

---

## Task 5: PDF Service

**Files:**
- Create: `server/services/pdfService.js`
- Create: `server/__tests__/pdfService.test.js`
- Place (manually): Giltee logo at `server/assets/giltee-logo-white.png` (optional — PDF renders with text header if missing)

**Note on Giltee logo:** Place the white Giltee script logo PNG at `server/assets/giltee-logo-white.png` for the PDF header. The service checks for its existence — if missing, the header renders as text only. The logo file can be found in the Brand Guidelines folder of your Claude Cowork storage.

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/pdfService.test.js`:

```js
jest.mock('../db/pool', () => ({ query: jest.fn(), on: jest.fn() }))

const pdfService = require('../services/pdfService')

const SAMPLE_QUOTE = {
  id: 'GL-00001',
  customer_name: 'Kohn Law',
  customer_email: 'info@kohnlaw.com',
  project_name: 'Staff Shirts 2026',
  intake_record: {
    customer: { name: 'Kohn Law', email: 'info@kohnlaw.com', event_purpose: 'Staff shirts' },
    product: { garment_type: 'T-shirt', brand_style: 'Bella+Canvas 3001', quantity: 60, colors: ['Navy'] },
    decoration: { method: 'SCREEN_PRINT', locations: [{ name: 'Front chest', colorCount: 2 }] },
  },
  garment_data: {
    style: 'Bella+Canvas 3001',
    requestedColor: 'Navy',
    standardPrice: 4.50,
    available: true,
  },
  pricing_osp: {
    perUnitTotal: 11.43,
    setupFees: { screenSetup: 40 },
    orderTotal: 725.80,
    flags: [],
  },
  pricing_redwall: {
    perUnitTotal: 13.02,
    setupFees: { screenSetup: 96 },
    orderTotal: 877.20,
    flags: [],
  },
  recommended_supplier: 'OSP',
  qa_report: { status: 'APPROVED', failed: [], reviewer_notes: '' },
  email_draft: 'Hi,\n\nHere is your quote.\n\nLisa',
  created_at: '2026-04-03T00:00:00Z',
}

describe('pdfService.generateQuotePDF', () => {
  it('returns a Buffer', async () => {
    const buffer = await pdfService.generateQuotePDF(SAMPLE_QUOTE)
    expect(Buffer.isBuffer(buffer)).toBe(true)
  })

  it('returns a non-empty buffer (>1KB)', async () => {
    const buffer = await pdfService.generateQuotePDF(SAMPLE_QUOTE)
    expect(buffer.length).toBeGreaterThan(1024)
  })

  it('does not throw when garment_data is null', async () => {
    const quote = { ...SAMPLE_QUOTE, garment_data: null }
    await expect(pdfService.generateQuotePDF(quote)).resolves.toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:server -- --testPathPattern="pdfService"
```

Expected: FAIL — `Cannot find module '../services/pdfService'`

- [ ] **Step 3: Create `server/assets/` directory**

```bash
mkdir -p "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App/server/assets"
```

If you have the `giltee-logo_white.png` file, copy it:
```bash
cp /path/to/giltee-logo_white.png server/assets/giltee-logo-white.png
```

If not, the PDF will render with text-only header — this is fine for Plan B.

- [ ] **Step 4: Create `server/services/pdfService.js`**

```js
const PdfPrinter = require('pdfmake')
const fs = require('fs')
const path = require('path')

const FOREST_GREEN = '#104F42'
const WHITE = '#FFFFFF'
const BLACK = '#000000'
const LIGHT_GRAY = '#E5E7EB'

const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
}

const printer = new PdfPrinter(fonts)

const LOGO_PATH = path.join(__dirname, '../assets/giltee-logo-white.png')

function getLogoContent() {
  if (fs.existsSync(LOGO_PATH)) {
    return { image: LOGO_PATH, width: 120, margin: [0, 4, 0, 4] }
  }
  return { text: 'Giltee', style: 'logoText', margin: [0, 8, 0, 8] }
}

function formatCurrency(n) {
  if (n == null) return '—'
  return `$${Number(n).toFixed(2)}`
}

function buildDocDefinition(quote) {
  const intake = quote.intake_record || {}
  const customer = intake.customer || {}
  const product = intake.product || {}
  const decoration = intake.decoration || {}
  const garment = quote.garment_data || {}
  const ospPricing = quote.pricing_osp || {}
  const redwallPricing = quote.pricing_redwall || {}
  const recommended = quote.recommended_supplier || 'OSP'
  const recommendedPricing = recommended === 'OSP' ? ospPricing : redwallPricing

  const quoteDate = new Date(quote.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  const validThrough = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return {
    defaultStyle: { font: 'Helvetica', fontSize: 10, color: BLACK },
    pageMargins: [40, 40, 40, 60],
    styles: {
      logoText: { fontSize: 22, bold: true, color: WHITE },
      headerMeta: { fontSize: 9, color: WHITE },
      sectionLabel: {
        fontSize: 8, bold: true, color: FOREST_GREEN,
        characterSpacing: 1.5, margin: [0, 12, 0, 4],
      },
      tableHeader: { fontSize: 9, bold: true, color: WHITE, fillColor: FOREST_GREEN },
      rowLabel: { fontSize: 9, color: '#6B7280' },
      rowValue: { fontSize: 10 },
      totalRow: { fontSize: 11, bold: true },
      disclaimer: { fontSize: 8, color: '#6B7280', italics: true },
      footer: { fontSize: 8, color: '#9CA3AF' },
    },

    content: [
      // ── Header band ──────────────────────────────────────────────────────────
      {
        canvas: [{ type: 'rect', x: -40, y: -40, w: 595, h: 80, color: FOREST_GREEN }],
        margin: [0, 0, 0, 0],
      },
      {
        columns: [
          { ...getLogoContent(), width: 140 },
          {
            stack: [
              { text: 'CUSTOM APPAREL QUOTE', style: 'logoText', fontSize: 14, alignment: 'right' },
              { text: `Quote #${quote.id}`, style: 'headerMeta', alignment: 'right' },
              { text: `Date: ${quoteDate}`, style: 'headerMeta', alignment: 'right' },
              { text: `Valid through: ${validThrough}`, style: 'headerMeta', alignment: 'right' },
            ],
            alignment: 'right',
          },
        ],
        margin: [0, -70, 0, 20],
      },

      // ── Customer information ─────────────────────────────────────────────────
      { text: 'CUSTOMER', style: 'sectionLabel' },
      {
        table: {
          widths: [120, '*'],
          body: [
            [{ text: 'Name / Organization', style: 'rowLabel' }, { text: customer.name || quote.customer_name || '—', style: 'rowValue' }],
            [{ text: 'Email', style: 'rowLabel' }, { text: customer.email || quote.customer_email || '—', style: 'rowValue' }],
            [{ text: 'Event / Purpose', style: 'rowLabel' }, { text: customer.event_purpose || quote.project_name || '—', style: 'rowValue' }],
          ],
        },
        layout: { hLineColor: LIGHT_GRAY, vLineColor: 'transparent', paddingTop: () => 4, paddingBottom: () => 4 },
      },

      // ── Order summary ────────────────────────────────────────────────────────
      { text: 'ORDER SUMMARY', style: 'sectionLabel' },
      {
        table: {
          widths: [120, '*'],
          body: [
            [{ text: 'Garment', style: 'rowLabel' }, { text: garment.style || product.brand_style || '—', style: 'rowValue' }],
            [{ text: 'Color', style: 'rowLabel' }, { text: garment.requestedColor || (product.colors || []).join(', ') || '—', style: 'rowValue' }],
            [{ text: 'Quantity', style: 'rowLabel' }, { text: String(product.quantity || '—'), style: 'rowValue' }],
            [{ text: 'Decoration Method', style: 'rowLabel' }, { text: decoration.method || '—', style: 'rowValue' }],
            [{ text: 'Print Locations', style: 'rowLabel' }, {
              text: (decoration.locations || []).map(l => `${l.name} (${l.colorCount || l.color_count} color${(l.colorCount || l.color_count) !== 1 ? 's' : ''})`).join(', ') || '—',
              style: 'rowValue',
            }],
          ],
        },
        layout: { hLineColor: LIGHT_GRAY, vLineColor: 'transparent', paddingTop: () => 4, paddingBottom: () => 4 },
      },

      // ── Pricing ──────────────────────────────────────────────────────────────
      { text: 'PRICING', style: 'sectionLabel' },
      {
        table: {
          widths: ['*', 80, 80, 80],
          headerRows: 1,
          body: [
            [
              { text: 'ITEM', style: 'tableHeader', margin: [4, 4, 4, 4] },
              { text: 'QTY', style: 'tableHeader', alignment: 'center', margin: [4, 4, 4, 4] },
              { text: 'UNIT PRICE', style: 'tableHeader', alignment: 'right', margin: [4, 4, 4, 4] },
              { text: 'TOTAL', style: 'tableHeader', alignment: 'right', margin: [4, 4, 4, 4] },
            ],
            [
              { text: `${garment.style || product.brand_style || 'Garment'} — ${decoration.method || ''}`, margin: [4, 4, 4, 4] },
              { text: String(product.quantity || ''), alignment: 'center', margin: [4, 4, 4, 4] },
              { text: formatCurrency(recommendedPricing.perUnitTotal), alignment: 'right', margin: [4, 4, 4, 4] },
              { text: formatCurrency((recommendedPricing.perUnitTotal || 0) * (product.quantity || 0)), alignment: 'right', margin: [4, 4, 4, 4] },
            ],
            ...(recommendedPricing.setupFees?.screenSetup > 0 ? [[
              { text: 'Screen setup fee', margin: [4, 4, 4, 4] },
              { text: '—', alignment: 'center', margin: [4, 4, 4, 4] },
              { text: '—', alignment: 'right', margin: [4, 4, 4, 4] },
              { text: formatCurrency(recommendedPricing.setupFees.screenSetup), alignment: 'right', margin: [4, 4, 4, 4] },
            ]] : []),
            ...(recommendedPricing.setupFees?.dtfSetup > 0 ? [[
              { text: 'DTF/DTG setup fee', margin: [4, 4, 4, 4] },
              { text: '—', alignment: 'center', margin: [4, 4, 4, 4] },
              { text: '—', alignment: 'right', margin: [4, 4, 4, 4] },
              { text: formatCurrency(recommendedPricing.setupFees.dtfSetup), alignment: 'right', margin: [4, 4, 4, 4] },
            ]] : []),
            [
              { text: 'ORDER TOTAL', style: 'totalRow', colSpan: 3, margin: [4, 6, 4, 6] },
              {}, {},
              { text: formatCurrency(recommendedPricing.orderTotal), style: 'totalRow', alignment: 'right', margin: [4, 6, 4, 6] },
            ],
          ],
        },
        layout: {
          hLineColor: LIGHT_GRAY,
          vLineColor: 'transparent',
          fillColor: (rowIndex) => (rowIndex === 0 ? FOREST_GREEN : rowIndex % 2 === 0 ? '#F9FAFB' : null),
        },
      },

      // ── Terms & Conditions ───────────────────────────────────────────────────
      { text: 'TERMS & CONDITIONS', style: 'sectionLabel', margin: [0, 16, 0, 4] },
      {
        stack: [
          { text: '• Artwork approval required before production begins.', style: 'disclaimer', margin: [0, 2, 0, 0] },
          { text: '• Printed colors may vary slightly from on-screen appearance.', style: 'disclaimer', margin: [0, 2, 0, 0] },
          { text: '• Payment is due before production begins.', style: 'disclaimer', margin: [0, 2, 0, 0] },
          { text: `• Quote valid for 30 days from issue date (${quoteDate}).`, style: 'disclaimer', margin: [0, 2, 0, 0] },
          { text: '• Rush orders are subject to availability and may incur additional fees.', style: 'disclaimer', margin: [0, 2, 0, 0] },
          { text: '• Extended sizes (2XL+) may carry additional per-unit charges.', style: 'disclaimer', margin: [0, 2, 0, 0] },
          { text: '• Manufacturer defects: standard 2% damage allowance per print location.', style: 'disclaimer', margin: [0, 2, 0, 0] },
        ],
      },

      // ── Footer ───────────────────────────────────────────────────────────────
      {
        text: 'Looking forward to working on this with you.',
        italics: true,
        fontSize: 9,
        color: '#6B7280',
        margin: [0, 16, 0, 4],
      },
      {
        text: 'Giltee Apparel Co. | custom@giltee.com',
        style: 'footer',
      },
    ],
  }
}

/**
 * Generate a branded Giltee quote PDF.
 * @param {object} quoteData — quote record from the database
 * @returns {Promise<Buffer>}
 */
function generateQuotePDF(quoteData) {
  return new Promise((resolve, reject) => {
    const docDefinition = buildDocDefinition(quoteData)
    const pdfDoc = printer.createPdfKitDocument(docDefinition)
    const chunks = []
    pdfDoc.on('data', chunk => chunks.push(chunk))
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)))
    pdfDoc.on('error', reject)
    pdfDoc.end()
  })
}

module.exports = { generateQuotePDF }
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test:server -- --testPathPattern="pdfService"
```

Expected: All 3 pdfService tests PASS. (Test may take 1–2s as pdfmake generates real PDFs.)

- [ ] **Step 6: Commit**

```bash
git add server/services/pdfService.js server/__tests__/pdfService.test.js server/assets/
git commit -m "feat: add PDF service with branded Giltee quote document"
```

---

## Task 6: Gmail + Drive Services

**Files:**
- Create: `server/services/googleAuth.js`
- Create: `server/services/gmailService.js`
- Create: `server/services/driveService.js`
- Create: `server/__tests__/gmailService.test.js`

**Note:** These services require real Google OAuth credentials to work end-to-end. The unit tests mock all Google API calls. You can test the real integration manually in Task 7 after the pipeline is wired up.

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/gmailService.test.js`:

```js
jest.mock('../db/pool', () => ({ query: jest.fn(), on: jest.fn() }))

// Mock googleapis
jest.mock('googleapis', () => {
  const mockDraftsCreate = jest.fn().mockResolvedValue({ data: { id: 'draft-abc-123' } })
  const mockDraftsGet = jest.fn().mockResolvedValue({ data: { id: 'draft-abc-123', message: { snippet: 'test' } } })
  const mockDraftsDelete = jest.fn().mockResolvedValue({})
  const mockFilesCreate = jest.fn().mockResolvedValue({ data: { id: 'file-xyz', webViewLink: 'https://drive.google.com/file/xyz' } })

  return {
    google: {
      auth: {
        OAuth2: jest.fn().mockImplementation(() => ({
          setCredentials: jest.fn()
        }))
      },
      gmail: jest.fn().mockReturnValue({
        users: {
          drafts: {
            create: mockDraftsCreate,
            get: mockDraftsGet,
            delete: mockDraftsDelete,
          }
        }
      }),
      drive: jest.fn().mockReturnValue({
        files: { create: mockFilesCreate }
      })
    }
  }
})

const gmailService = require('../services/gmailService')
const driveService = require('../services/driveService')

describe('gmailService.createDraft', () => {
  it('calls gmail drafts.create and returns draft ID', async () => {
    const draftId = await gmailService.createDraft({
      to: 'customer@example.com',
      subject: 'Quote — Test Order',
      body: 'Hi Test,\n\nHere is your quote.',
      pdfBuffer: Buffer.from('fake pdf'),
      pdfFilename: 'GL-00001-Test-Quote.pdf',
    })
    expect(draftId).toBe('draft-abc-123')
  })
})

describe('gmailService.getDraft', () => {
  it('returns draft data by ID', async () => {
    const draft = await gmailService.getDraft('draft-abc-123')
    expect(draft).toHaveProperty('id', 'draft-abc-123')
  })
})

describe('gmailService.deleteDraft', () => {
  it('calls gmail drafts.delete', async () => {
    await expect(gmailService.deleteDraft('draft-abc-123')).resolves.not.toThrow()
  })
})

describe('driveService.uploadPDF', () => {
  it('uploads a PDF and returns fileId and url', async () => {
    const result = await driveService.uploadPDF(Buffer.from('fake pdf'), 'GL-00001-Test.pdf')
    expect(result.fileId).toBe('file-xyz')
    expect(result.url).toContain('drive.google.com')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:server -- --testPathPattern="gmailService"
```

Expected: FAIL — `Cannot find module '../services/gmailService'`

- [ ] **Step 3: Create `server/services/googleAuth.js`**

```js
const { google } = require('googleapis')

/**
 * Creates an authenticated Google OAuth2 client using env credentials.
 * Used by both gmailService and driveService.
 */
function getOAuthClient() {
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
  )
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })
  return auth
}

module.exports = { getOAuthClient }
```

- [ ] **Step 4: Create `server/services/gmailService.js`**

```js
const { google } = require('googleapis')
const { getOAuthClient } = require('./googleAuth')

const TARGET_ACCOUNT = () => process.env.GMAIL_TARGET_ACCOUNT || 'me'

/**
 * Build a base64url-encoded RFC 2822 email with a PDF attachment.
 */
function buildRawEmail({ from, to, subject, body, pdfBuffer, pdfFilename }) {
  const boundary = `boundary_${Date.now()}`
  const pdfBase64 = pdfBuffer.toString('base64')

  const parts = [
    `MIME-Version: 1.0`,
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    ``,
    body,
    ``,
    `--${boundary}`,
    `Content-Type: application/pdf; name="${pdfFilename}"`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${pdfFilename}"`,
    ``,
    pdfBase64,
    ``,
    `--${boundary}--`,
  ].join('\r\n')

  return Buffer.from(parts).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Create a Gmail draft with a PDF attachment.
 * @returns {Promise<string>} The draft ID
 */
async function createDraft({ to, subject, body, pdfBuffer, pdfFilename }) {
  const auth = getOAuthClient()
  const gmail = google.gmail({ version: 'v1', auth })

  const raw = buildRawEmail({
    from: TARGET_ACCOUNT(),
    to,
    subject,
    body,
    pdfBuffer,
    pdfFilename,
  })

  const response = await gmail.users.drafts.create({
    userId: TARGET_ACCOUNT(),
    requestBody: { message: { raw } },
  })

  return response.data.id
}

/**
 * Get a Gmail draft by ID.
 */
async function getDraft(draftId) {
  const auth = getOAuthClient()
  const gmail = google.gmail({ version: 'v1', auth })
  const response = await gmail.users.drafts.get({
    userId: TARGET_ACCOUNT(),
    id: draftId,
  })
  return response.data
}

/**
 * Delete a Gmail draft by ID.
 */
async function deleteDraft(draftId) {
  const auth = getOAuthClient()
  const gmail = google.gmail({ version: 'v1', auth })
  await gmail.users.drafts.delete({
    userId: TARGET_ACCOUNT(),
    id: draftId,
  })
}

module.exports = { createDraft, getDraft, deleteDraft }
```

- [ ] **Step 5: Create `server/services/driveService.js`**

```js
const { google } = require('googleapis')
const { Readable } = require('stream')
const { getOAuthClient } = require('./googleAuth')

/**
 * Upload a PDF buffer to Google Drive in the configured folder.
 * @param {Buffer} pdfBuffer
 * @param {string} filename
 * @returns {Promise<{ fileId: string, url: string }>}
 */
async function uploadPDF(pdfBuffer, filename) {
  const auth = getOAuthClient()
  const drive = google.drive({ version: 'v3', auth })

  const response = await drive.files.create({
    requestBody: {
      name: filename,
      parents: process.env.GOOGLE_DRIVE_FOLDER_ID
        ? [process.env.GOOGLE_DRIVE_FOLDER_ID]
        : [],
    },
    media: {
      mimeType: 'application/pdf',
      body: Readable.from(pdfBuffer),
    },
    fields: 'id, webViewLink',
  })

  return {
    fileId: response.data.id,
    url: response.data.webViewLink,
  }
}

module.exports = { uploadPDF }
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm run test:server -- --testPathPattern="gmailService"
```

Expected: All 4 gmailService/driveService tests PASS.

- [ ] **Step 7: Commit**

```bash
git add server/services/googleAuth.js server/services/gmailService.js server/services/driveService.js server/__tests__/gmailService.test.js
git commit -m "feat: add Gmail and Drive services for draft creation and PDF upload"
```

---

## Task 7: Pipeline Service

**Files:**
- Create: `server/services/pipelineService.js`
- Create: `server/__tests__/pipelineService.test.js`

This service orchestrates the full AI pipeline. It updates the quote in the database at each step and appends to `activity_log`.

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/pipelineService.test.js`:

```js
jest.mock('../db/pool', () => ({ query: jest.fn().mockResolvedValue({ rows: [] }), on: jest.fn() }))
jest.mock('../db/queries')
jest.mock('../services/claudeService')
jest.mock('../services/ssService')
jest.mock('../services/pricingService')
jest.mock('../services/pdfService')
jest.mock('../services/gmailService')
jest.mock('../services/driveService')

const queries = require('../db/queries')
const claudeService = require('../services/claudeService')
const ssService = require('../services/ssService')
const pricingService = require('../services/pricingService')
const pdfService = require('../services/pdfService')
const gmailService = require('../services/gmailService')
const driveService = require('../services/driveService')
const pipelineService = require('../services/pipelineService')

const MOCK_QUOTE = {
  id: 'GL-00001',
  raw_input: '60 Bella+Canvas 3001 in Navy, screen print, 2 colors front, for Kohn Law, info@kohnlaw.com',
  status: 'draft',
  customer_name: 'Kohn Law',
  customer_email: 'info@kohnlaw.com',
  activity_log: [],
}

const MOCK_INTAKE_JSON = {
  customer: { name: 'Kohn Law', email: 'info@kohnlaw.com', event_purpose: null, deadline: null, rush: false, returning: null },
  product: { garment_type: 'T-shirt', brand_style: 'Bella+Canvas 3001', quantity: 60, size_breakdown: null, colors: ['Navy'], youth_sizes: false },
  decoration: { method: 'SCREEN_PRINT', locations: [{ name: 'Front chest', color_count: 2, print_size: 'STANDARD' }], artwork_status: 'UNKNOWN', special_inks: [], stitch_count: null },
  edge_cases: { extended_sizes: false, dark_garment: false, individual_names: false, multiple_garment_colors: false, garment_color_count: 1, shipping_destination: null },
  flags: [],
  status: 'READY_FOR_PRICING',
  missing_fields: [],
}

const MOCK_GARMENT = { style: 'Bella+Canvas 3001', requestedColor: 'Navy', available: true, standardPrice: 4.50, extendedSkus: [], imageUrl: null, skus: [] }
const MOCK_PRICING = { osp: { perUnitTotal: 11.43, setupFees: { screenSetup: 40 }, orderTotal: 725.80, flags: [] }, redwall: { perUnitTotal: 13.02, setupFees: { screenSetup: 96 }, orderTotal: 877.20, flags: [] }, recommended: 'OSP' }
const MOCK_QA = { passed_count: 18, total_count: 20, failed: [], unable_to_verify: [], status: 'APPROVED', reviewer_notes: '' }

beforeEach(() => {
  jest.clearAllMocks()

  queries.getQuote.mockResolvedValue({ ...MOCK_QUOTE })
  queries.updateQuote.mockImplementation(async (id, fields) => ({ ...MOCK_QUOTE, ...fields }))

  claudeService.callClaude.mockResolvedValue(JSON.stringify(MOCK_INTAKE_JSON))
  claudeService.parseJSONFromText.mockImplementation((text) => JSON.parse(text))

  ssService.lookupGarment.mockResolvedValue(MOCK_GARMENT)
  pricingService.calculateQuote.mockReturnValue(MOCK_PRICING)

  claudeService.callClaude
    .mockResolvedValueOnce(JSON.stringify(MOCK_INTAKE_JSON))  // intake
    .mockResolvedValueOnce(JSON.stringify(MOCK_QA))            // qa
    .mockResolvedValueOnce('SUBJECT: Quote — Kohn Law 60 Shirts\n---\nHi Kohn,\n\nHere is your quote.\n\nLisa')  // email

  pdfService.generateQuotePDF.mockResolvedValue(Buffer.from('fake-pdf'))
  driveService.uploadPDF.mockResolvedValue({ fileId: 'file-123', url: 'https://drive.google.com/file-123' })
  gmailService.createDraft.mockResolvedValue('draft-456')
})

describe('pipelineService.runQuotePipeline', () => {
  it('runs all pipeline steps and returns completed quote', async () => {
    const result = await pipelineService.runQuotePipeline('GL-00001')
    expect(result).toBeDefined()
    expect(queries.updateQuote).toHaveBeenCalled()
  })

  it('calls Claude for intake with the INTAKE system prompt', async () => {
    await pipelineService.runQuotePipeline('GL-00001')
    const firstClaudeCall = claudeService.callClaude.mock.calls[0][0]
    expect(firstClaudeCall.systemPrompt).toBeDefined()
    expect(firstClaudeCall.userPrompt).toContain('Kohn Law')
  })

  it('calls ssService.lookupGarment with the extracted style and color', async () => {
    await pipelineService.runQuotePipeline('GL-00001')
    expect(ssService.lookupGarment).toHaveBeenCalledWith(
      expect.objectContaining({ style: 'Bella+Canvas 3001', color: 'Navy' })
    )
  })

  it('calls pricingService.calculateQuote with garment cost', async () => {
    await pipelineService.runQuotePipeline('GL-00001')
    expect(pricingService.calculateQuote).toHaveBeenCalledWith(
      expect.objectContaining({ garmentCostPerUnit: 4.50 })
    )
  })

  it('calls pdfService.generateQuotePDF', async () => {
    await pipelineService.runQuotePipeline('GL-00001')
    expect(pdfService.generateQuotePDF).toHaveBeenCalled()
  })

  it('calls driveService.uploadPDF and gmailService.createDraft', async () => {
    await pipelineService.runQuotePipeline('GL-00001')
    expect(driveService.uploadPDF).toHaveBeenCalled()
    expect(gmailService.createDraft).toHaveBeenCalled()
  })

  it('sets quote status to error when a step fails', async () => {
    ssService.lookupGarment.mockRejectedValue(new Error('S&S API down'))
    await expect(pipelineService.runQuotePipeline('GL-00001')).rejects.toThrow('S&S API down')
    const errorCall = queries.updateQuote.mock.calls.find(
      call => call[1].status === 'error'
    )
    expect(errorCall).toBeDefined()
  })

  it('throws when quote has no raw_input', async () => {
    queries.getQuote.mockResolvedValue({ ...MOCK_QUOTE, raw_input: null })
    await expect(pipelineService.runQuotePipeline('GL-00001')).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:server -- --testPathPattern="pipelineService"
```

Expected: FAIL — `Cannot find module '../services/pipelineService'`

- [ ] **Step 3: Create `server/services/pipelineService.js`**

```js
const queries = require('../db/queries')
const claudeService = require('./claudeService')
const ssService = require('./ssService')
const pricingService = require('./pricingService')
const pdfService = require('./pdfService')
const gmailService = require('./gmailService')
const driveService = require('./driveService')
const skills = require('../skills/index')

// ─── Helpers ─────────────────────────────────────────────────────────────────

function logEntry(message, data = {}) {
  return { timestamp: new Date().toISOString(), message, ...data }
}

async function appendLog(quoteId, message, extra = {}) {
  const quote = await queries.getQuote(quoteId)
  const existing = Array.isArray(quote.activity_log) ? quote.activity_log : []
  await queries.updateQuote(quoteId, {
    activity_log: [...existing, logEntry(message, extra)],
  })
}

/**
 * Parse a "SUBJECT: ...\n---\n[body]" response from the email drafting step.
 */
function parseEmailResponse(text) {
  const lines = text.trim().split('\n')
  const subjectLine = lines.find(l => l.startsWith('SUBJECT:'))
  const subject = subjectLine ? subjectLine.replace('SUBJECT:', '').trim() : 'Quote from Giltee'
  const separatorIdx = lines.findIndex(l => l.trim() === '---')
  const body = separatorIdx >= 0 ? lines.slice(separatorIdx + 1).join('\n').trim() : text
  return { subject, body }
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

/**
 * Run the full AI pipeline for a quote.
 * Updates the quote in the DB at each step.
 *
 * Steps:
 *  1. Intake — Claude extracts structured data from raw_input
 *  2. Garment — S&S API looks up garment availability and pricing
 *  3. Pricing — pricingService calculates OSP + Redwall breakdowns
 *  4. QA — Claude runs the QA checklist
 *  5. Email — Claude drafts the customer email
 *  6. PDF — pdfService generates the quote document
 *  7. Drive — driveService uploads the PDF
 *  8. Gmail — gmailService creates the draft
 *
 * @param {string} quoteId
 * @returns {Promise<object>} The completed quote record
 */
async function runQuotePipeline(quoteId) {
  const quote = await queries.getQuote(quoteId)
  if (!quote) throw new Error(`Quote ${quoteId} not found`)
  if (!quote.raw_input) throw new Error(`Quote ${quoteId} has no raw_input`)

  await queries.updateQuote(quoteId, {
    status: 'processing',
    activity_log: [logEntry('Pipeline started')],
  })

  try {
    // ── Step 1: Intake ──────────────────────────────────────────────────────
    const intakeText = await claudeService.callClaude({
      systemPrompt: skills.INTAKE,
      userPrompt: `Process the following customer inquiry and extract a structured intake record.

Customer inquiry:
${quote.raw_input}

Return ONLY valid JSON matching this schema (use null for unknown fields):
{
  "customer": { "name": null, "email": null, "event_purpose": null, "deadline": null, "rush": null, "returning": null },
  "product": { "garment_type": null, "brand_style": null, "quantity": null, "size_breakdown": null, "colors": [], "youth_sizes": false },
  "decoration": { "method": null, "locations": [], "artwork_status": "UNKNOWN", "special_inks": [], "stitch_count": null },
  "edge_cases": { "extended_sizes": false, "dark_garment": null, "individual_names": false, "multiple_garment_colors": false, "garment_color_count": 1, "shipping_destination": null },
  "flags": [],
  "status": "READY_FOR_PRICING",
  "missing_fields": []
}
For decoration.method use: SCREEN_PRINT, DTF, DTG, or EMBROIDERY
For decoration.locations[].print_size use: STANDARD, OVERSIZED, or JUMBO`,
    })

    const intake_record = claudeService.parseJSONFromText(intakeText)
    await queries.updateQuote(quoteId, { intake_record })
    await appendLog(quoteId, 'Intake complete', { status: intake_record.status })

    // Update customer fields on the quote record if extracted
    const updates = {}
    if (intake_record.customer?.name && !quote.customer_name) updates.customer_name = intake_record.customer.name
    if (intake_record.customer?.email && !quote.customer_email) updates.customer_email = intake_record.customer.email
    if (Object.keys(updates).length) await queries.updateQuote(quoteId, updates)

    // ── Step 2: Garment lookup ──────────────────────────────────────────────
    let garment_data = null
    const brandStyle = intake_record.product?.brand_style
    const colors = intake_record.product?.colors || []
    const requestedColor = colors[0] || null

    if (brandStyle && requestedColor) {
      garment_data = await ssService.lookupGarment({ style: brandStyle, color: requestedColor })
      await queries.updateQuote(quoteId, { garment_data })
      await appendLog(quoteId, 'Garment lookup complete', {
        style: brandStyle,
        available: garment_data.available,
      })
    } else {
      garment_data = { available: false, flags: ['Garment or color not specified — requires manual selection'] }
      await queries.updateQuote(quoteId, { garment_data })
      await appendLog(quoteId, 'Garment lookup skipped — no style specified')
    }

    // ── Step 3: Pricing ─────────────────────────────────────────────────────
    const quantity = intake_record.product?.quantity || 0
    const garmentCostPerUnit = garment_data.standardPrice || 0
    const decorationMethod = intake_record.decoration?.method || 'SCREEN_PRINT'
    const locations = (intake_record.decoration?.locations || []).map(loc => ({
      colorCount: loc.color_count || loc.colorCount || 1,
      printSize: loc.print_size || loc.printSize || 'STANDARD',
    }))
    const isDarkGarment = intake_record.edge_cases?.dark_garment || false

    const pricingResult = pricingService.calculateQuote({
      quantity,
      garmentCostPerUnit,
      decorationMethod,
      locations: locations.length ? locations : [{ colorCount: 1, printSize: 'STANDARD' }],
      isDarkGarment,
      isReorder: false,
    })

    // Store OSP + Redwall breakdowns (or single if DTF/DTG)
    const pricing_osp = pricingResult.osp || pricingResult.single || null
    const pricing_redwall = pricingResult.redwall || null
    const recommended_supplier = pricingResult.recommended || 'OSP'

    await queries.updateQuote(quoteId, { pricing_osp, pricing_redwall, recommended_supplier })
    await appendLog(quoteId, 'Pricing complete', { recommended: recommended_supplier })

    // ── Step 4: QA ──────────────────────────────────────────────────────────
    const qaText = await claudeService.callClaude({
      systemPrompt: skills.QA,
      userPrompt: `Run the complete QA checklist on this quote data.

Intake record: ${JSON.stringify(intake_record)}
Garment data: ${JSON.stringify(garment_data)}
OSP pricing: ${JSON.stringify(pricing_osp)}
Redwall pricing: ${JSON.stringify(pricing_redwall)}

Return ONLY valid JSON:
{
  "passed_count": 0,
  "total_checks": 0,
  "failed": [{ "check": "check name", "issue": "specific problem" }],
  "unable_to_verify": [{ "check": "check name", "reason": "why unable" }],
  "status": "APPROVED",
  "reviewer_notes": ""
}
For status use: APPROVED, NEEDS_FIXES, or BLOCKED`,
    })

    const qa_report = claudeService.parseJSONFromText(qaText)
    await queries.updateQuote(quoteId, { qa_report })
    await appendLog(quoteId, 'QA complete', { status: qa_report.status })

    // ── Step 5: Email draft ─────────────────────────────────────────────────
    const recommendedPricing = recommended_supplier === 'OSP' ? pricing_osp : pricing_redwall
    const emailText = await claudeService.callClaude({
      systemPrompt: skills.EMAIL_DRAFTING,
      userPrompt: `Draft the customer email for the following quote. Write in Lisa's voice exactly as described.

Customer: ${intake_record.customer?.name || quote.customer_name || 'Customer'}
Email: ${intake_record.customer?.email || quote.customer_email || ''}
Order: ${quantity} × ${brandStyle || 'garment'} — ${decorationMethod}
Color: ${requestedColor || ''}
Total: ${formatCurrency(recommendedPricing?.orderTotal)} (${recommended_supplier})
QA status: ${qa_report.status}
${qa_report.failed?.length ? `QA flags: ${qa_report.failed.map(f => f.issue).join('; ')}` : ''}

Return in this exact format:
SUBJECT: [subject line]
---
[email body starting with greeting]`,
    })

    const { subject: emailSubject, body: emailBody } = parseEmailResponse(emailText)
    const email_draft = `SUBJECT: ${emailSubject}\n\n${emailBody}`

    await queries.updateQuote(quoteId, { email_draft })
    await appendLog(quoteId, 'Email draft complete')

    // ── Step 6: PDF ─────────────────────────────────────────────────────────
    const currentQuote = await queries.getQuote(quoteId)
    const pdfBuffer = await pdfService.generateQuotePDF(currentQuote)
    await appendLog(quoteId, 'PDF generated')

    // ── Step 7: Drive upload ─────────────────────────────────────────────────
    const pdfFilename = `${quoteId}-${(quote.customer_name || 'Quote').replace(/\s+/g, '-')}-Quote.pdf`
    const driveResult = await driveService.uploadPDF(pdfBuffer, pdfFilename)
    await queries.updateQuote(quoteId, { pdf_url: driveResult.url })
    await appendLog(quoteId, 'PDF uploaded to Drive', { url: driveResult.url })

    // ── Step 8: Gmail draft ──────────────────────────────────────────────────
    const draftId = await gmailService.createDraft({
      to: intake_record.customer?.email || quote.customer_email,
      subject: emailSubject,
      body: emailBody,
      pdfBuffer,
      pdfFilename,
    })
    await queries.updateQuote(quoteId, { gmail_draft_id: draftId })
    await appendLog(quoteId, 'Gmail draft created', { draftId })

    // ── Complete ─────────────────────────────────────────────────────────────
    await queries.updateQuote(quoteId, { status: 'ready' })
    await appendLog(quoteId, 'Pipeline complete')

    return await queries.getQuote(quoteId)

  } catch (err) {
    const quote = await queries.getQuote(quoteId)
    const existing = Array.isArray(quote?.activity_log) ? quote.activity_log : []
    await queries.updateQuote(quoteId, {
      status: 'error',
      activity_log: [...existing, logEntry('Pipeline failed', { error: err.message })],
    })
    throw err
  }
}

function formatCurrency(n) {
  if (n == null) return '—'
  return `$${Number(n).toFixed(2)}`
}

module.exports = { runQuotePipeline }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:server -- --testPathPattern="pipelineService"
```

Expected: All 8 pipelineService tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/pipelineService.js server/__tests__/pipelineService.test.js
git commit -m "feat: add AI pipeline service orchestrating intake, pricing, QA, email, PDF, and Gmail"
```

---

## Task 8: Quotes Routes

**Files:**
- Create: `server/routes/quotes.js`
- Create: `server/__tests__/quotes.test.js`
- Modify: `server/index.js` (uncomment `/api/quotes` route registration)

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/quotes.test.js`:

```js
jest.mock('../db/pool', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  on: jest.fn(),
  connect: jest.fn()
}))
jest.mock('../db/queries')
jest.mock('../services/pipelineService')

const request = require('supertest')
const queries = require('../db/queries')
const pipelineService = require('../services/pipelineService')
const app = require('../index')

const MOCK_QUOTE = {
  id: 'GL-00001',
  status: 'draft',
  customer_name: 'Test Customer',
  customer_email: 'test@example.com',
  project_name: 'Test Project',
  raw_input: 'Give me 60 shirts',
  intake_record: null,
  garment_data: null,
  pricing_osp: null,
  pricing_redwall: null,
  recommended_supplier: null,
  qa_report: null,
  email_draft: null,
  gmail_draft_id: null,
  pdf_url: null,
  activity_log: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_by: 'adam@giltee.com',
}

function mockSession(app) {
  // Inject a mock authenticated session
  const agent = request.agent(app)
  // Override requireAuth for tests by making queries.getUserById return a user
  queries.getUserById = jest.fn().mockResolvedValue({ id: 1, email: 'adam@giltee.com', role: 'admin', status: 'active' })
  return agent
}

beforeEach(() => {
  jest.clearAllMocks()
  queries.listQuotes = jest.fn().mockResolvedValue([MOCK_QUOTE])
  queries.getQuote = jest.fn().mockResolvedValue(MOCK_QUOTE)
  queries.createQuote = jest.fn().mockResolvedValue(MOCK_QUOTE)
  queries.updateQuote = jest.fn().mockResolvedValue(MOCK_QUOTE)
  queries.getNextQuoteId = jest.fn().mockResolvedValue('GL-00001')
  queries.getUserById = jest.fn().mockResolvedValue({ id: 1, email: 'adam@giltee.com', role: 'admin', status: 'active' })
  pipelineService.runQuotePipeline = jest.fn().mockResolvedValue({ ...MOCK_QUOTE, status: 'ready' })
})

// Helper: bypass requireAuth by mocking passport's deserializeUser lookup
// In test, send a cookie that maps to a valid user — we mock getUserById for this
function authedRequest(method, path) {
  // Since tests mock the pool, session store won't work normally.
  // We test the routes by directly injecting x-test-user header processed by test middleware.
  // Actually — the simplest approach for route testing without a real session:
  // We test that unauthenticated requests return 401, and note that full integration
  // requires a real session. The key behaviors (DB calls, pipeline calls) are unit-tested.
  return request(app)[method](path)
}

describe('GET /health', () => {
  it('returns 200 (public route, no auth needed)', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
  })
})

describe('GET /api/quotes — unauthenticated', () => {
  it('returns 401 when no session', async () => {
    const res = await request(app).get('/api/quotes')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/quotes/:id — unauthenticated', () => {
  it('returns 401 when no session', async () => {
    const res = await request(app).get('/api/quotes/GL-00001')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/quotes/:id/run — unauthenticated', () => {
  it('returns 401 when no session', async () => {
    const res = await request(app).post('/api/quotes/GL-00001/run')
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:server -- --testPathPattern="quotes.test"
```

Expected: FAIL — routes not registered yet (404 instead of 401 for /api/quotes)

- [ ] **Step 3: Create `server/routes/quotes.js`**

```js
const express = require('express')
const queries = require('../db/queries')
const pipelineService = require('../services/pipelineService')
const { requireAdmin } = require('../middleware/auth')

const router = express.Router()

// GET /api/quotes — list all quotes
router.get('/', async (req, res, next) => {
  try {
    const { status, search } = req.query
    const quotes = await queries.listQuotes({ status, search })
    res.json(quotes)
  } catch (err) {
    next(err)
  }
})

// POST /api/quotes — create a new quote
router.post('/', async (req, res, next) => {
  try {
    const { customerName, customerEmail, projectName, rawInput } = req.body
    if (!rawInput && !customerName) {
      return res.status(400).json({ error: 'rawInput or customerName is required' })
    }
    const quote = await queries.createQuote({
      customerName: customerName || null,
      customerEmail: customerEmail || null,
      projectName: projectName || null,
      rawInput: rawInput || null,
      createdBy: req.user?.email || 'unknown',
    })
    res.status(201).json(quote)
  } catch (err) {
    next(err)
  }
})

// GET /api/quotes/:id — get a single quote
router.get('/:id', async (req, res, next) => {
  try {
    const quote = await queries.getQuote(req.params.id)
    if (!quote) return res.status(404).json({ error: 'Quote not found' })
    res.json(quote)
  } catch (err) {
    next(err)
  }
})

// PATCH /api/quotes/:id — update quote fields
router.patch('/:id', async (req, res, next) => {
  try {
    const quote = await queries.updateQuote(req.params.id, req.body)
    if (!quote) return res.status(404).json({ error: 'Quote not found' })
    res.json(quote)
  } catch (err) {
    next(err)
  }
})

// POST /api/quotes/:id/run — trigger the AI pipeline
router.post('/:id/run', async (req, res, next) => {
  try {
    const existing = await queries.getQuote(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Quote not found' })
    if (existing.status === 'processing') {
      return res.status(409).json({ error: 'Pipeline already running for this quote' })
    }
    const completed = await pipelineService.runQuotePipeline(req.params.id)
    res.json(completed)
  } catch (err) {
    next(err)
  }
})

module.exports = router
```

- [ ] **Step 4: Uncomment quotes route in `server/index.js`**

In `server/index.js`, find and replace:

```js
// Plan B routes (uncomment when implemented):
// app.use('/api/quotes', require('./routes/quotes'))
// app.use('/api/garments', require('./routes/garments'))
// app.use('/api/gmail', require('./routes/gmail'))
```

With (just the quotes line for now — garments and gmail come in Tasks 9–10):

```js
// Plan B routes:
app.use('/api/quotes', require('./routes/quotes'))
// app.use('/api/garments', require('./routes/garments'))
// app.use('/api/gmail', require('./routes/gmail'))
```

- [ ] **Step 5: Run all server tests**

```bash
npm run test:server
```

Expected: All tests PASS. The quotes route tests verify unauthenticated requests return 401.

- [ ] **Step 6: Commit**

```bash
git add server/routes/quotes.js server/__tests__/quotes.test.js server/index.js
git commit -m "feat: add quotes routes with CRUD and pipeline /run endpoint"
```

---

## Task 9: Garments Route

**Files:**
- Create: `server/routes/garments.js`
- Create: `server/__tests__/garments.test.js`
- Modify: `server/index.js` (uncomment `/api/garments` route registration)

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/garments.test.js`:

```js
jest.mock('../db/pool', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  on: jest.fn(),
  connect: jest.fn()
}))
jest.mock('../services/ssService')
jest.mock('../db/queries', () => ({
  getUserById: jest.fn().mockResolvedValue({ id: 1, email: 'adam@giltee.com', role: 'admin', status: 'active' })
}))

const request = require('supertest')
const ssService = require('../services/ssService')
const app = require('../index')

beforeEach(() => {
  jest.clearAllMocks()
  ssService.lookupGarment = jest.fn().mockResolvedValue({
    style: 'Bella+Canvas 3001',
    requestedColor: 'Navy',
    available: true,
    standardPrice: 4.50,
    extendedSkus: [],
    skus: [],
  })
})

describe('GET /api/garments/lookup — unauthenticated', () => {
  it('returns 401 when no session', async () => {
    const res = await request(app)
      .get('/api/garments/lookup?style=bella+canvas+3001&color=Navy')
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:server -- --testPathPattern="garments"
```

Expected: FAIL — route not registered (404 instead of 401)

- [ ] **Step 3: Create `server/routes/garments.js`**

```js
const express = require('express')
const ssService = require('../services/ssService')

const router = express.Router()

// GET /api/garments/lookup?style=bella+canvas+3001&color=Navy
router.get('/lookup', async (req, res, next) => {
  try {
    const { style, color } = req.query
    if (!style || !color) {
      return res.status(400).json({ error: 'style and color query params are required' })
    }
    const result = await ssService.lookupGarment({ style, color })
    res.json(result)
  } catch (err) {
    next(err)
  }
})

module.exports = router
```

- [ ] **Step 4: Register garments route in `server/index.js`**

Update the Plan B routes comment block:

```js
// Plan B routes:
app.use('/api/quotes', require('./routes/quotes'))
app.use('/api/garments', require('./routes/garments'))
// app.use('/api/gmail', require('./routes/gmail'))
```

- [ ] **Step 5: Run all server tests**

```bash
npm run test:server
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add server/routes/garments.js server/__tests__/garments.test.js server/index.js
git commit -m "feat: add garments route for S&S product lookup"
```

---

## Task 10: Gmail Route + Final Route Registration

**Files:**
- Create: `server/routes/gmail.js`
- Create: `server/__tests__/gmail.test.js`
- Modify: `server/index.js` (uncomment `/api/gmail` route)

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/gmail.test.js`:

```js
jest.mock('../db/pool', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  on: jest.fn(),
  connect: jest.fn()
}))
jest.mock('../services/gmailService')
jest.mock('../db/queries', () => ({
  getUserById: jest.fn().mockResolvedValue({ id: 1, email: 'adam@giltee.com', role: 'admin', status: 'active' })
}))

const request = require('supertest')
const app = require('../index')

describe('GET /api/gmail/draft/:id — unauthenticated', () => {
  it('returns 401 when no session', async () => {
    const res = await request(app).get('/api/gmail/draft/draft-123')
    expect(res.status).toBe(401)
  })
})

describe('DELETE /api/gmail/draft/:id — unauthenticated', () => {
  it('returns 401 when no session', async () => {
    const res = await request(app).delete('/api/gmail/draft/draft-123')
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:server -- --testPathPattern="gmail.test"
```

Expected: FAIL — route not registered (404 instead of 401)

- [ ] **Step 3: Create `server/routes/gmail.js`**

```js
const express = require('express')
const gmailService = require('../services/gmailService')

const router = express.Router()

// GET /api/gmail/draft/:id — retrieve a draft (for preview)
router.get('/draft/:id', async (req, res, next) => {
  try {
    const draft = await gmailService.getDraft(req.params.id)
    res.json(draft)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/gmail/draft/:id — discard a draft
router.delete('/draft/:id', async (req, res, next) => {
  try {
    await gmailService.deleteDraft(req.params.id)
    res.json({ message: 'Draft deleted' })
  } catch (err) {
    next(err)
  }
})

module.exports = router
```

- [ ] **Step 4: Register all three routes in `server/index.js`**

Update the Plan B routes block to uncomment all three:

```js
// Plan B routes:
app.use('/api/quotes', require('./routes/quotes'))
app.use('/api/garments', require('./routes/garments'))
app.use('/api/gmail', require('./routes/gmail'))
```

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: All server tests PASS (31+ tests), all client tests PASS (13 tests).

- [ ] **Step 6: Verify route surface**

Start the server and confirm all routes respond correctly:

```bash
npm run server
```

In a separate terminal:
```bash
curl http://localhost:3001/health
# Expected: {"status":"ok"}

curl http://localhost:3001/api/quotes
# Expected: {"error":"Authentication required"} (401 — correct, not logged in)

curl http://localhost:3001/api/garments/lookup?style=test&color=Navy
# Expected: {"error":"Authentication required"} (401 — correct)
```

- [ ] **Step 7: Final commit**

```bash
git add server/routes/gmail.js server/__tests__/gmail.test.js server/index.js
git commit -m "feat: add Gmail route and complete Plan B route registration"
```

---

## Plan B Complete

**What's working after Plan B:**

- `ssService` — S&S Activewear API lookup for any style+color combination
- `pricingService` — Full pricing calculation (OSP + Redwall screen print, DTF, DTG, embroidery flag) using all Giltee pricing tables
- `claudeService` — Anthropic Claude integration with JSON response parsing
- `pdfService` — Branded Giltee quote PDF with Forest Green header, pricing table, and terms
- `gmailService` + `driveService` — Gmail draft creation with PDF attachment; Google Drive upload
- `pipelineService` — Complete AI pipeline: intake → garment → pricing → QA → email → PDF → Drive → Gmail
- `/api/quotes` — CRUD + `/run` endpoint that triggers the full pipeline
- `/api/garments` — S&S product lookup proxy
- `/api/gmail` — Draft retrieval and deletion

**Plan B does NOT include:** frontend pages, progress feedback during pipeline, or quote status polling. Those are Plan C.

**Next: Plan C** — All frontend pages (Ledger dashboard with quote list, CreateQuote with raw input form and /run button, ViewQuote with all pipeline output displayed) + integration wiring.

**Before Plan C:** Manually test the full pipeline end-to-end:
1. Sign in to the app at `http://localhost:5173`
2. Use curl or a REST client to `POST /api/quotes` with `{ "rawInput": "60 Bella+Canvas 3001 Navy shirts for Kohn Law..." }`
3. Grab the returned quote ID, then `POST /api/quotes/:id/run`
4. Verify the quote record is populated with intake_record, garment_data, pricing, qa_report, email_draft, pdf_url, gmail_draft_id
