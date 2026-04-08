# Pricing Matrix Admin UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admin users to view and edit OSP and Redwall screen print decoration cost tables through a Settings UI, with values persisted in PostgreSQL and loaded at runtime by the pricing service.

**Architecture:** A new `pricing_config` table stores each manufacturer's full config as JSONB. The pricing service loads from DB on first use (cached in memory), falling back to hardcoded constants if no row exists. The admin UI is a new `/admin/pricing` page under a shared Settings shell that also wraps the existing Users page.

**Tech Stack:** Express.js, PostgreSQL (JSONB), React 18, TailwindCSS, Vitest + @testing-library/react

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `server/db/pricingQueries.js` | Create | DB read/write for pricing_config |
| `server/routes/pricing.js` | Create | GET + PUT /api/pricing/:manufacturer |
| `server/services/pricingService.js` | Modify | Async DB loading, cache, invalidation |
| `server/services/pipelineService.js` | Modify | Await calculateQuote (now async) |
| `server/index.js` | Modify | Register /api/pricing route |
| `client/src/pages/Admin.jsx` | Modify | Extract SettingsShell, add Manufacturers tab |
| `client/src/pages/AdminPricing.jsx` | Create | Pricing matrix editor UI |
| `client/src/pages/__tests__/AdminPricing.test.jsx` | Create | Frontend tests |
| `client/src/App.jsx` | Modify | Add /admin/pricing route |

---

## Task 1: DB Schema + pricingQueries.js

**Files:**
- Create: `server/db/pricingQueries.js`

- [ ] **Step 1: Create the pricing_config table in the database**

Run this via Node (same pattern used elsewhere in this project):

```bash
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/giltee_ledger' });
pool.query(\`
  CREATE TABLE IF NOT EXISTS pricing_config (
    manufacturer VARCHAR(20) PRIMARY KEY,
    config       JSONB NOT NULL,
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_by   VARCHAR(255)
  )
\`).then(() => { console.log('pricing_config table created'); pool.end() })
.catch(e => { console.error(e.message); pool.end(); process.exit(1) })
" 2>&1
```

Expected: `pricing_config table created`

Also add it to `server/db/schema.sql` so fresh DB setups get it. Find the end of the schema file and add:

```sql
-- Pricing configuration (per manufacturer, editable via admin UI)
CREATE TABLE IF NOT EXISTS pricing_config (
  manufacturer VARCHAR(20) PRIMARY KEY,
  config       JSONB NOT NULL,
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by   VARCHAR(255)
);
```

- [ ] **Step 2: Write the failing tests**

Create `server/db/__tests__/pricingQueries.test.js`:

```js
const pool = require('../pool')
const { getPricingConfig, upsertPricingConfig } = require('../pricingQueries')

// These are integration tests — they hit the real DB.
// Run against the dev database (same as the app uses).

const TEST_MANUFACTURER = 'TEST_MFG'
const TEST_CONFIG = {
  tiers: [{ min: 12, max: 23, costs: [6.00, 9.20, null, null, null, null, null, null, null, null, null, null] }],
  fees: { screenFeePerColor: 20, repeatScreenPerColor: 10, inkSwitch: 20, customPmsInk: 20, screenFeeWaivedAt: 96 },
  printSizes: {
    oversized: { surchargePercent: 15, screenFee: 15 },
    jumbo: { surchargePercent: 50, screenFee: 20 },
  },
}

afterAll(async () => {
  await pool.query('DELETE FROM pricing_config WHERE manufacturer = $1', [TEST_MANUFACTURER])
  await pool.end()
})

describe('pricingQueries', () => {
  it('getPricingConfig returns null when no row exists', async () => {
    const result = await getPricingConfig(TEST_MANUFACTURER)
    expect(result).toBeNull()
  })

  it('upsertPricingConfig inserts a new row', async () => {
    const row = await upsertPricingConfig(TEST_MANUFACTURER, TEST_CONFIG, 'test@giltee.com')
    expect(row.manufacturer).toBe(TEST_MANUFACTURER)
    expect(row.config.fees.screenFeePerColor).toBe(20)
    expect(row.updated_by).toBe('test@giltee.com')
  })

  it('getPricingConfig returns the saved config', async () => {
    const row = await getPricingConfig(TEST_MANUFACTURER)
    expect(row).not.toBeNull()
    expect(row.config.tiers).toHaveLength(1)
  })

  it('upsertPricingConfig updates an existing row', async () => {
    const updated = { ...TEST_CONFIG, fees: { ...TEST_CONFIG.fees, screenFeePerColor: 25 } }
    const row = await upsertPricingConfig(TEST_MANUFACTURER, updated, 'other@giltee.com')
    expect(row.config.fees.screenFeePerColor).toBe(25)
    expect(row.updated_by).toBe('other@giltee.com')
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd "server" && node --experimental-vm-modules ../node_modules/.bin/jest db/__tests__/pricingQueries.test.js 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '../pricingQueries'`

Note: The server uses Jest for backend tests (check `package.json` for the test script). If no backend test runner is configured, run with:
```bash
cd server && npx jest db/__tests__/pricingQueries.test.js --testEnvironment node 2>&1 | tail -10
```

- [ ] **Step 4: Create `server/db/pricingQueries.js`**

```js
const pool = require('./pool')

async function getPricingConfig(manufacturer) {
  const { rows } = await pool.query(
    'SELECT * FROM pricing_config WHERE manufacturer = $1',
    [manufacturer]
  )
  return rows[0] || null
}

async function upsertPricingConfig(manufacturer, config, updatedBy) {
  const { rows } = await pool.query(
    `INSERT INTO pricing_config (manufacturer, config, updated_by, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (manufacturer) DO UPDATE
       SET config = $2, updated_by = $3, updated_at = NOW()
     RETURNING *`,
    [manufacturer, JSON.stringify(config), updatedBy]
  )
  return rows[0]
}

module.exports = { getPricingConfig, upsertPricingConfig }
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd server && npx jest db/__tests__/pricingQueries.test.js --testEnvironment node 2>&1 | tail -10
```

Expected: 4 tests passing

- [ ] **Step 6: Commit**

```bash
git add server/db/pricingQueries.js server/db/__tests__/pricingQueries.test.js server/db/schema.sql
git commit -m "feat: add pricing_config table and pricingQueries"
```

---

## Task 2: Pricing Routes

**Files:**
- Create: `server/routes/pricing.js`
- Modify: `server/index.js`

- [ ] **Step 1: Write the failing tests**

The server uses supertest for route tests. Check for an existing test pattern by looking at `server/routes/__tests__/`. Create `server/routes/__tests__/pricing.test.js`:

```js
const request = require('supertest')
const app = require('../../index')

// Mock pricingQueries so tests don't hit the DB
jest.mock('../../db/pricingQueries', () => ({
  getPricingConfig: jest.fn(),
  upsertPricingConfig: jest.fn(),
}))

// Mock pricingService.invalidateCache
jest.mock('../../services/pricingService', () => ({
  ...jest.requireActual('../../services/pricingService'),
  invalidateCache: jest.fn(),
}))

const { getPricingConfig, upsertPricingConfig } = require('../../db/pricingQueries')

// Helper: create an authenticated admin session cookie
// This project uses passport + session. For route tests, mock the session middleware.
// Simplest approach: mock requireAuth and requireAdmin.
jest.mock('../../middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = { id: 1, email: 'adam@giltee.com', role: 'admin' }; next() },
  requireAdmin: (req, res, next) => next(),
}))

const VALID_CONFIG = {
  tiers: [{ min: 12, max: 23, costs: [6.00, 9.20, null, null, null, null, null, null, null, null, null, null] }],
  fees: { screenFeePerColor: 20, repeatScreenPerColor: 10, inkSwitch: 20, customPmsInk: 20, screenFeeWaivedAt: 96 },
  printSizes: {
    oversized: { surchargePercent: 15, screenFee: 15 },
    jumbo: { surchargePercent: 50, screenFee: 20 },
  },
}

afterEach(() => jest.clearAllMocks())

describe('GET /api/pricing/:manufacturer', () => {
  it('returns db config when row exists', async () => {
    getPricingConfig.mockResolvedValue({ manufacturer: 'OSP', config: VALID_CONFIG, updated_at: new Date(), updated_by: 'adam@giltee.com' })
    const res = await request(app).get('/api/pricing/OSP')
    expect(res.status).toBe(200)
    expect(res.body.source).toBe('db')
    expect(res.body.config.fees.screenFeePerColor).toBe(20)
  })

  it('returns default config when no db row', async () => {
    getPricingConfig.mockResolvedValue(null)
    const res = await request(app).get('/api/pricing/OSP')
    expect(res.status).toBe(200)
    expect(res.body.source).toBe('default')
    expect(res.body.config.tiers).toBeDefined()
  })

  it('returns 400 for unknown manufacturer', async () => {
    const res = await request(app).get('/api/pricing/BADKEY')
    expect(res.status).toBe(400)
  })
})

describe('PUT /api/pricing/:manufacturer', () => {
  it('saves config and returns row', async () => {
    upsertPricingConfig.mockResolvedValue({ manufacturer: 'OSP', config: VALID_CONFIG, updated_at: new Date(), updated_by: 'adam@giltee.com' })
    const res = await request(app).put('/api/pricing/OSP').send({ config: VALID_CONFIG })
    expect(res.status).toBe(200)
    expect(res.body.manufacturer).toBe('OSP')
  })

  it('returns 400 for missing config.tiers', async () => {
    const res = await request(app).put('/api/pricing/OSP').send({ config: { fees: {}, printSizes: {} } })
    expect(res.status).toBe(400)
  })

  it('returns 400 for unknown manufacturer', async () => {
    const res = await request(app).put('/api/pricing/BADKEY').send({ config: VALID_CONFIG })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && npx jest routes/__tests__/pricing.test.js --testEnvironment node 2>&1 | tail -10
```

Expected: FAIL — route not found / 404

- [ ] **Step 3: Create `server/routes/pricing.js`**

```js
const express = require('express')
const { requireAdmin } = require('../middleware/auth')
const { getPricingConfig, upsertPricingConfig } = require('../db/pricingQueries')
const pricingService = require('../services/pricingService')

const router = express.Router()

const VALID_MANUFACTURERS = new Set(['OSP', 'REDWALL'])

// GET /api/pricing/:manufacturer
router.get('/:manufacturer', requireAdmin, async (req, res, next) => {
  try {
    const { manufacturer } = req.params
    if (!VALID_MANUFACTURERS.has(manufacturer)) {
      return res.status(400).json({ error: 'Unknown manufacturer. Valid values: OSP, REDWALL' })
    }
    const row = await getPricingConfig(manufacturer)
    if (row) {
      return res.json({ manufacturer, config: row.config, updated_at: row.updated_at, updated_by: row.updated_by, source: 'db' })
    }
    // Fall back to hardcoded defaults
    const config = pricingService.getDefaultConfig(manufacturer)
    return res.json({ manufacturer, config, source: 'default' })
  } catch (err) {
    next(err)
  }
})

// PUT /api/pricing/:manufacturer
router.put('/:manufacturer', requireAdmin, async (req, res, next) => {
  try {
    const { manufacturer } = req.params
    if (!VALID_MANUFACTURERS.has(manufacturer)) {
      return res.status(400).json({ error: 'Unknown manufacturer. Valid values: OSP, REDWALL' })
    }
    const { config } = req.body
    if (!config || !Array.isArray(config.tiers) || config.tiers.length === 0 || !config.fees || !config.printSizes) {
      return res.status(400).json({ error: 'config must have tiers (array), fees (object), and printSizes (object)' })
    }
    const row = await upsertPricingConfig(manufacturer, config, req.user.email)
    pricingService.invalidateCache(manufacturer)
    return res.json({ manufacturer: row.manufacturer, config: row.config, updated_at: row.updated_at, updated_by: row.updated_by })
  } catch (err) {
    next(err)
  }
})

module.exports = router
```

- [ ] **Step 4: Register the route in `server/index.js`**

Find the route registration block and add after the customers line:

```js
app.use('/api/customers', require('./routes/customers'))
app.use('/api/pricing', require('./routes/pricing'))
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd server && npx jest routes/__tests__/pricing.test.js --testEnvironment node 2>&1 | tail -10
```

Expected: 6 tests passing

- [ ] **Step 6: Commit**

```bash
git add server/routes/pricing.js server/routes/__tests__/pricing.test.js server/index.js
git commit -m "feat: add GET/PUT /api/pricing/:manufacturer routes"
```

---

## Task 3: Async pricingService + pipeline update

**Files:**
- Modify: `server/services/pricingService.js`
- Modify: `server/services/pipelineService.js`

**Context:** `pricingService.js` currently exports synchronous functions. Making it load from DB requires async. The pipeline calls `pricingService.calculateQuote(...)` synchronously — that call needs `await`.

- [ ] **Step 1: Add helpers to pricingService.js — getDefaultConfig + cache + loadConfig**

At the top of `server/services/pricingService.js`, after the existing constant definitions, add:

```js
// ─── Default config shape (converted from hardcoded constants) ────────────────

function padTo12(costs) {
  const arr = costs.slice(0, 12)
  while (arr.length < 12) arr.push(null)
  return arr
}

function buildDefaultConfig(tiers) {
  return {
    tiers: tiers.map(t => ({
      min: t.min,
      max: t.max === Infinity ? null : t.max,
      costs: padTo12(t.costs),
    })),
    fees: {
      screenFeePerColor: 20,
      repeatScreenPerColor: 10,
      inkSwitch: 20,
      customPmsInk: 20,
      screenFeeWaivedAt: 96,
    },
    printSizes: {
      oversized: { surchargePercent: 15, screenFee: 15 },
      jumbo: { surchargePercent: 50, screenFee: 20 },
    },
  }
}

function getDefaultConfig(manufacturer) {
  if (manufacturer === 'OSP') return buildDefaultConfig(OSP_SCREEN_PRINT)
  if (manufacturer === 'REDWALL') return buildDefaultConfig(REDWALL_SCREEN_PRINT)
  throw new Error(`Unknown manufacturer: ${manufacturer}`)
}

// ─── In-memory cache ──────────────────────────────────────────────────────────

const _cache = { OSP: null, REDWALL: null }

function invalidateCache(manufacturer) {
  _cache[manufacturer] = null
}

async function loadConfig(manufacturer) {
  if (_cache[manufacturer]) return _cache[manufacturer]
  try {
    const { getPricingConfig } = require('./db/pricingQueries')
    // Note: require path from services/ to db/
    const row = await getPricingConfig(manufacturer)
    if (row) {
      _cache[manufacturer] = row.config
      return _cache[manufacturer]
    }
  } catch {
    // DB unavailable — fall through to hardcoded
  }
  _cache[manufacturer] = getDefaultConfig(manufacturer)
  return _cache[manufacturer]
}
```

Wait — `pricingService.js` is in `server/services/`, and `pricingQueries.js` is in `server/db/`. The require path from `server/services/pricingService.js` to `server/db/pricingQueries.js` is `'../db/pricingQueries'`. Fix the comment in the code above accordingly:

```js
    const { getPricingConfig } = require('../db/pricingQueries')
```

- [ ] **Step 2: Replace getOspDecorationCost and getRedwallDecorationCost with async versions**

Replace the existing `getOspDecorationCost` and `getRedwallDecorationCost` functions:

```js
async function getOspDecorationCost(qty, colorCount) {
  const config = await loadConfig('OSP')
  const row = config.tiers.find(r => qty >= r.min && qty <= (r.max === null ? Infinity : r.max))
  if (!row) return null
  const idx = Math.min(colorCount, 12) - 1
  return row.costs[idx] ?? null
}

async function getRedwallDecorationCost(qty, colorCount) {
  const config = await loadConfig('REDWALL')
  const row = config.tiers.find(r => qty >= r.min && qty <= (r.max === null ? Infinity : r.max))
  if (!row) return null
  const idx = Math.min(colorCount, 12) - 1
  return row.costs[idx] ?? null
}
```

- [ ] **Step 3: Make calculateScreenPrintQuote async**

Replace the existing `calculateScreenPrintQuote` function:

```js
async function calculateScreenPrintQuote({ quantity, garmentCostPerUnit, locations, isDarkGarment, isReorder }) {
  const ospConfig = await loadConfig('OSP')
  const redwallConfig = await loadConfig('REDWALL')
  const margin = getMarginForQuantity(quantity)
  const flags = []

  if (margin === null) {
    flags.push(`Quantity ${quantity} is below the screen print minimum (24 units). Consider DTF or DTG.`)
  }

  async function sumDecoration(costFn) {
    let total = 0
    for (const loc of locations) {
      const effectiveColors = isDarkGarment ? loc.colorCount + 1 : loc.colorCount
      const cost = await costFn(quantity, effectiveColors)
      total += cost || 0
    }
    return total
  }

  const totalOspDecoration = round2(await sumDecoration(getOspDecorationCost))
  const totalRedwallDecoration = round2(await sumDecoration(getRedwallDecorationCost))
  const perUnitProfit = margin || 0

  const totalColors = locations.reduce((sum, loc) => {
    return sum + (isDarkGarment ? loc.colorCount + 1 : loc.colorCount)
  }, 0)

  const ospFees = ospConfig.fees
  const redwallFees = redwallConfig.fees

  const ospSetupFee = quantity >= (ospFees.screenFeeWaivedAt || 96)
    ? 0
    : (isReorder ? ospFees.repeatScreenPerColor : ospFees.screenFeePerColor) * totalColors

  const redwallSetupFee = quantity >= (redwallFees.screenFeeWaivedAt || 144)
    ? 0
    : locations.reduce((sum, loc) => {
        const colors = isDarkGarment ? loc.colorCount + 1 : loc.colorCount
        return sum + (isReorder ? redwallFees.repeatScreenPerColor : redwallFees.screenFeePerColor) * colors
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
```

- [ ] **Step 4: Make calculateQuote async**

Replace the existing `calculateQuote` function:

```js
async function calculateQuote(params) {
  const { decorationMethod } = params
  switch (decorationMethod) {
    case 'SCREEN_PRINT':
      return calculateScreenPrintQuote(params)
    case 'DTF':
      return { single: calculateDTFQuote(params), recommended: 'SINGLE' }
    case 'DTG':
      return { single: calculateDTGQuote(params), recommended: 'SINGLE' }
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
```

- [ ] **Step 5: Update module.exports to include new exports**

Replace the existing `module.exports` block:

```js
module.exports = {
  getDefaultConfig,
  invalidateCache,
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

- [ ] **Step 6: Await calculateQuote in pipelineService.js**

In `server/services/pipelineService.js`, find line 163 (the `pricingService.calculateQuote(...)` call) and add `await`:

```js
      const result = await pricingService.calculateQuote({
        quantity,
        garmentCostPerUnit,
        decorationMethod,
        locations: locations.length ? locations : [{ colorCount: 1, printSize: 'STANDARD' }],
        isDarkGarment,
        isReorder: false,
      })
```

The surrounding function that contains this call is already async (it's inside an async pipeline function) — verify this by checking the function signature a few lines above line 163. If it is not already `async`, add `async` to it.

- [ ] **Step 7: Verify the server starts without errors**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && node -e "const s = require('./server/services/pricingService'); s.calculateQuote({ decorationMethod: 'SCREEN_PRINT', quantity: 48, garmentCostPerUnit: 4.50, locations: [{ colorCount: 2, printSize: 'STANDARD' }], isDarkGarment: false, isReorder: false }).then(r => { console.log('OSP total:', r.osp.orderTotal); process.exit(0) }).catch(e => { console.error(e.message); process.exit(1) })" 2>&1
```

Expected: prints an OSP total (e.g. `OSP total: 725.8` or similar)

- [ ] **Step 8: Commit**

```bash
git add server/services/pricingService.js server/services/pipelineService.js
git commit -m "feat: make pricingService async with DB config loading and cache"
```

---

## Task 4: Settings Shell + Admin refactor + App.jsx route

**Files:**
- Modify: `client/src/pages/Admin.jsx`
- Modify: `client/src/App.jsx`

**Context:** The existing Admin.jsx page shows user management. We're adding a Settings shell with two tabs (Users, Manufacturers) that wraps both the existing page and the new pricing page. The `SettingsShell` is exported as a named export so `AdminPricing.jsx` can import it.

- [ ] **Step 1: Add SettingsShell to Admin.jsx and wrap existing content**

Read `client/src/pages/Admin.jsx` first. The entire page currently starts with `<div className="min-h-screen bg-surface">` and `<NavBar />`.

Replace the top-level structure with the following. The existing user management JSX stays unchanged — it just moves inside the shell's content area.

At the top of the file, add the NavLink import:
```js
import { NavLink } from 'react-router-dom'
```

Add the `SettingsShell` component before the `Admin` function definition:

```jsx
export function SettingsShell({ children }) {
  return (
    <div className="min-h-screen bg-surface">
      <NavBar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-on-surface mb-1">Settings</h1>
        <p className="text-on-surface-variant text-sm mb-6">Manage users and system configuration.</p>
        <div className="flex gap-0 border-b border-outline-variant/40 mb-8">
          {[
            { to: '/admin/users', label: 'Users' },
            { to: '/admin/pricing', label: 'Manufacturers' },
          ].map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
        {children}
      </div>
    </div>
  )
}
```

Then wrap the existing `Admin` component's return value in `<SettingsShell>`. Remove the `<NavBar />` and the outer `<div className="min-h-screen bg-surface">` that was previously there, and remove the `max-w-4xl mx-auto px-6 py-10` wrapper div too — the shell provides those now.

The `Admin` function should now return:
```jsx
return (
  <SettingsShell>
    <h2 className="text-lg font-semibold text-on-surface mb-1">User Management</h2>
    <p className="text-on-surface-variant text-sm mb-8">Invite team members and manage access to Giltee Ledger.</p>
    {/* ... all existing sections unchanged ... */}
  </SettingsShell>
)
```

- [ ] **Step 2: Run existing Admin tests to verify they still pass**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && npx --prefix client vitest run src/pages/__tests__/Admin.test.jsx 2>&1 | tail -10
```

Expected: 4 tests passing. If the tests fail because they check for "User Management" text, update them — the heading changed from `<h1>User Management</h1>` to `<h2>User Management</h2>` but the text is the same. If any test was checking for the `h1` with text "User Management", update the test to not check for that specific element (the tests don't appear to check the heading text — they check for "INVITE USER" which is still present).

- [ ] **Step 3: Add AdminPricing route to App.jsx**

In `client/src/App.jsx`, add the import:
```js
import AdminPricing from './pages/AdminPricing'
```

Add the route after the existing admin route:
```jsx
<Route path="/admin/users" element={<AuthGuard adminOnly><Admin /></AuthGuard>} />
<Route path="/admin/pricing" element={<AuthGuard adminOnly><AdminPricing /></AuthGuard>} />
```

Also create a placeholder `client/src/pages/AdminPricing.jsx` so the app compiles:
```jsx
export default function AdminPricing() {
  return <div>AdminPricing — coming in next task</div>
}
```

- [ ] **Step 4: Run the full test suite to verify nothing broke**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && npx --prefix client vitest run 2>&1 | tail -8
```

Expected: all 46 tests passing

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Admin.jsx client/src/pages/AdminPricing.jsx client/src/App.jsx
git commit -m "feat: add SettingsShell with Users/Manufacturers tabs, add /admin/pricing route"
```

---

## Task 5: AdminPricing.jsx — Pricing Matrix UI

**Files:**
- Create (replace placeholder): `client/src/pages/AdminPricing.jsx`
- Create: `client/src/pages/__tests__/AdminPricing.test.jsx`

**Context:** The UI matches the layout in the design spec: a printing cost grid (rows = qty tiers, columns = 1c–12c), a fees panel, and a print sizes panel. Two tabs: OSP and Redwall.

The `config` object shape from the API:
```json
{
  "tiers": [
    { "min": 12, "max": 23, "costs": [6.00, 9.20, null, null, null, null, null, null, null, null, null, null] }
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
    "jumbo": { "surchargePercent": 50, "screenFee": 20 }
  }
}
```

- [ ] **Step 1: Write the failing tests**

Create `client/src/pages/__tests__/AdminPricing.test.jsx`:

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '../../context/AuthContext'
import AdminPricing from '../AdminPricing'

const mockUser = { id: 1, name: 'Adam', email: 'adam@giltee.com', role: 'admin' }

const MOCK_CONFIG = {
  tiers: [
    { min: 12, max: 23, costs: [6.00, 9.20, 12.40, 15.60, 18.80, 22.00, 25.20, 28.40, null, null, null, null] },
    { min: 24, max: 47, costs: [3.00, 4.60, 6.20, 7.80, 9.40, 11.00, 12.60, 14.20, null, null, null, null] },
  ],
  fees: { screenFeePerColor: 20, repeatScreenPerColor: 10, inkSwitch: 20, customPmsInk: 20, screenFeeWaivedAt: 96 },
  printSizes: {
    oversized: { surchargePercent: 15, screenFee: 15 },
    jumbo: { surchargePercent: 50, screenFee: 20 },
  },
}

function renderAdminPricing() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ manufacturer: 'OSP', config: MOCK_CONFIG, source: 'db', updated_at: '2026-04-07T10:00:00Z', updated_by: 'adam@giltee.com' }),
  })
  return render(
    <AuthContext.Provider value={{ user: mockUser, setUser: vi.fn() }}>
      <MemoryRouter initialEntries={['/admin/pricing']}>
        <Routes>
          <Route path="/admin/pricing" element={<AdminPricing />} />
          <Route path="/admin/users" element={<div>Users</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

afterEach(() => vi.resetAllMocks())

describe('AdminPricing', () => {
  it('renders the OSP tab by default', async () => {
    renderAdminPricing()
    await waitFor(() => expect(screen.getByRole('tab', { name: /osp/i })).toBeInTheDocument())
  })

  it('renders the Redwall tab', async () => {
    renderAdminPricing()
    await waitFor(() => expect(screen.getByRole('tab', { name: /redwall/i })).toBeInTheDocument())
  })

  it('renders the PRINTING grid header', async () => {
    renderAdminPricing()
    await waitFor(() => expect(screen.getByText('PRINTING')).toBeInTheDocument())
  })

  it('renders color count column headers 1c through 12c', async () => {
    renderAdminPricing()
    await waitFor(() => expect(screen.getByText('1c')).toBeInTheDocument())
    expect(screen.getByText('12c')).toBeInTheDocument()
  })

  it('renders the FEES section', async () => {
    renderAdminPricing()
    await waitFor(() => expect(screen.getByText(/screen fee per color/i)).toBeInTheDocument())
  })

  it('renders the PRINT SIZES section', async () => {
    renderAdminPricing()
    await waitFor(() => expect(screen.getByText(/print sizes/i)).toBeInTheDocument())
  })

  it('renders a Save button', async () => {
    renderAdminPricing()
    await waitFor(() => expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument())
  })

  it('shows last updated info when source is db', async () => {
    renderAdminPricing()
    await waitFor(() => expect(screen.getByText(/adam@giltee.com/i)).toBeInTheDocument())
  })

  it('switches to Redwall tab and fetches Redwall config', async () => {
    const user = userEvent.setup()
    renderAdminPricing()
    await waitFor(() => screen.getByRole('tab', { name: /redwall/i }))
    await user.click(screen.getByRole('tab', { name: /redwall/i }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/pricing/REDWALL', expect.any(Object))
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && npx --prefix client vitest run src/pages/__tests__/AdminPricing.test.jsx 2>&1 | tail -10
```

Expected: FAIL — placeholder component doesn't have the required elements

- [ ] **Step 3: Implement AdminPricing.jsx**

Replace `client/src/pages/AdminPricing.jsx` with the full implementation:

```jsx
import { useState, useEffect } from 'react'
import { SettingsShell } from './Admin'

const MANUFACTURERS = ['OSP', 'REDWALL']
const COLOR_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

function tierLabel(tier) {
  if (tier.max === null) return `${tier.min}+`
  return `${tier.min}-${tier.max}`
}

function CellInput({ value, onChange }) {
  if (value === null) {
    return <span className="block w-full text-center text-on-surface-variant/50 text-xs py-1.5">n/a</span>
  }
  return (
    <input
      type="number"
      step="0.01"
      min="0"
      value={value}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      className="w-full text-xs text-center bg-transparent border-0 focus:outline-none focus:bg-primary/5 rounded py-1.5 text-on-surface"
    />
  )
}

function FeeInput({ label, value, onChange, note }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-outline-variant/20 last:border-0">
      <span className="text-xs text-on-surface">{label}{note && <span className="text-on-surface-variant"> {note}</span>}</span>
      <div className="flex items-center gap-1">
        <span className="text-xs text-on-surface-variant">$</span>
        <input
          type="number"
          step="1"
          min="0"
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="w-16 text-xs text-right bg-surface border border-outline-variant rounded px-2 py-1 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    </div>
  )
}

export default function AdminPricing() {
  const [activeTab, setActiveTab] = useState('OSP')
  const [config, setConfig] = useState(null)
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setConfig(null)
    setSaveMsg(null)
    setError(null)
    fetch(`/api/pricing/${activeTab}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setConfig(data.config)
        setMeta({ source: data.source, updated_at: data.updated_at, updated_by: data.updated_by })
        setLoading(false)
      })
      .catch(() => { setError('Failed to load pricing config'); setLoading(false) })
  }, [activeTab])

  function updateTierCost(tierIdx, colorIdx, value) {
    setConfig(prev => {
      const tiers = prev.tiers.map((t, i) => {
        if (i !== tierIdx) return t
        const costs = [...t.costs]
        costs[colorIdx] = value
        return { ...t, costs }
      })
      return { ...prev, tiers }
    })
  }

  function updateFee(key, value) {
    setConfig(prev => ({ ...prev, fees: { ...prev.fees, [key]: value } }))
  }

  function updatePrintSize(size, key, value) {
    setConfig(prev => ({
      ...prev,
      printSizes: { ...prev.printSizes, [size]: { ...prev.printSizes[size], [key]: value } }
    }))
  }

  async function handleSave() {
    setSaving(true)
    setSaveMsg(null)
    setError(null)
    try {
      const res = await fetch(`/api/pricing/${activeTab}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setMeta({ source: 'db', updated_at: data.updated_at, updated_by: data.updated_by })
      setSaveMsg(`Saved at ${new Date(data.updated_at).toLocaleTimeString()}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsShell>
      {/* Manufacturer tabs */}
      <div className="flex gap-2 mb-6">
        {MANUFACTURERS.map(mfg => (
          <button
            key={mfg}
            role="tab"
            aria-selected={activeTab === mfg}
            onClick={() => setActiveTab(mfg)}
            className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${
              activeTab === mfg
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {mfg}
          </button>
        ))}
      </div>

      {loading && (
        <div className="space-y-2">
          {[1,2,3].map(n => <div key={n} className="h-10 bg-surface-container-low rounded animate-pulse" />)}
        </div>
      )}

      {error && <div className="bg-error-container text-on-error-container text-sm rounded p-3 mb-4">{error}</div>}

      {!loading && config && (
        <div className="flex gap-6 items-start">

          {/* Left: Printing cost grid */}
          <div className="flex-1 bg-surface-container-low rounded border border-outline-variant/40 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-primary text-on-primary">
                  <th className="text-left px-3 py-2 font-bold tracking-wider text-xs w-24">PRINTING</th>
                  {COLOR_COUNTS.map(c => (
                    <th key={c} className="text-center px-1 py-2 font-bold w-16">{c}c</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {config.tiers.map((tier, tierIdx) => (
                  <tr key={tierIdx} className="border-b border-outline-variant/20 hover:bg-surface-container/30">
                    <td className="px-3 py-1 font-semibold text-on-surface whitespace-nowrap">{tierLabel(tier)}</td>
                    {COLOR_COUNTS.map((_, colorIdx) => (
                      <td key={colorIdx} className="px-1 py-0.5 border-l border-outline-variant/10">
                        <CellInput
                          value={tier.costs[colorIdx] !== undefined ? tier.costs[colorIdx] : null}
                          onChange={v => updateTierCost(tierIdx, colorIdx, v)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
                {/* Static 7500+ row */}
                <tr className="border-b border-outline-variant/20 bg-surface-container/20">
                  <td className="px-3 py-1 font-semibold text-on-surface">7500+</td>
                  {COLOR_COUNTS.map(c => (
                    <td key={c} className="px-1 py-1.5 border-l border-outline-variant/10 text-center text-on-surface-variant/60">call</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Right: Fees + Print Sizes */}
          <div className="w-64 space-y-4 shrink-0">

            {/* FEES */}
            <div className="bg-surface-container-low rounded border border-outline-variant/40 p-4">
              <div className="text-xs font-bold text-on-primary bg-primary px-3 py-1.5 rounded -mx-4 -mt-4 mb-3 tracking-wider">FEES</div>
              <FeeInput label="Screen fee per color" note="*" value={config.fees.screenFeePerColor} onChange={v => updateFee('screenFeePerColor', v)} />
              <FeeInput label="Repeat screen per color" note="*" value={config.fees.repeatScreenPerColor} onChange={v => updateFee('repeatScreenPerColor', v)} />
              <FeeInput label="Ink switch (limit 1 per 25pc)" value={config.fees.inkSwitch} onChange={v => updateFee('inkSwitch', v)} />
              <FeeInput label="Custom PMS ink color" value={config.fees.customPmsInk} onChange={v => updateFee('customPmsInk', v)} />
              <div className="pt-2 text-xs text-on-surface-variant italic">
                *Screen fees waived at {config.fees.screenFeeWaivedAt} pc
              </div>
            </div>

            {/* PRINT SIZES */}
            <div className="bg-surface-container-low rounded border border-outline-variant/40 p-4">
              <div className="text-xs font-bold text-on-primary bg-primary px-3 py-1.5 rounded -mx-4 -mt-4 mb-3 tracking-wider">PRINT SIZES</div>
              <div className="grid grid-cols-3 gap-1 text-xs font-semibold text-on-surface-variant mb-2">
                <span></span><span className="text-center">rate</span><span className="text-center">screen</span>
              </div>
              <div className="grid grid-cols-3 gap-1 items-center py-1.5 border-b border-outline-variant/20 text-xs">
                <span className="text-on-surface">Standard<br/><span className="text-on-surface-variant">(up to 12x15")</span></span>
                <span className="text-center text-on-surface-variant">—</span>
                <span className="text-center text-on-surface-variant">—</span>
              </div>
              {[
                ['oversized', 'Oversized', '(up to 13x22")'],
                ['jumbo', 'Jumbo', '(up to 17x28")'],
              ].map(([key, label, sub]) => (
                <div key={key} className="grid grid-cols-3 gap-1 items-center py-1.5 border-b border-outline-variant/20 last:border-0 text-xs">
                  <span className="text-on-surface">{label}<br/><span className="text-on-surface-variant">{sub}</span></span>
                  <div className="flex items-center justify-center gap-0.5">
                    <input
                      type="number" min="0" step="1"
                      value={config.printSizes[key].surchargePercent}
                      onChange={e => updatePrintSize(key, 'surchargePercent', parseFloat(e.target.value) || 0)}
                      className="w-10 text-xs text-center bg-surface border border-outline-variant rounded px-1 py-0.5 focus:outline-none"
                    />
                    <span className="text-on-surface-variant">%</span>
                  </div>
                  <div className="flex items-center justify-center gap-0.5">
                    <span className="text-on-surface-variant">+$</span>
                    <input
                      type="number" min="0" step="1"
                      value={config.printSizes[key].screenFee}
                      onChange={e => updatePrintSize(key, 'screenFee', parseFloat(e.target.value) || 0)}
                      className="w-10 text-xs text-center bg-surface border border-outline-variant rounded px-1 py-0.5 focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Save + status */}
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-primary text-on-primary text-sm font-medium py-2 rounded hover:bg-primary-container transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              {saveMsg && <p className="text-xs text-secondary text-center">{saveMsg}</p>}
              {meta?.source === 'db' && meta.updated_by && (
                <p className="text-xs text-on-surface-variant text-center">
                  Last updated by {meta.updated_by}
                </p>
              )}
              {meta?.source === 'default' && (
                <p className="text-xs text-on-surface-variant text-center italic">Using default values</p>
              )}
            </div>

          </div>
        </div>
      )}
    </SettingsShell>
  )
}
```

- [ ] **Step 4: Run the AdminPricing tests**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && npx --prefix client vitest run src/pages/__tests__/AdminPricing.test.jsx 2>&1 | tail -10
```

Expected: 9 tests passing

- [ ] **Step 5: Run the full test suite**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && npx --prefix client vitest run 2>&1 | tail -8
```

Expected: all tests passing (46 pre-existing + 9 new = 55 total)

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/AdminPricing.jsx client/src/pages/__tests__/AdminPricing.test.jsx client/src/pages/Admin.jsx
git commit -m "feat: add AdminPricing page with editable screen print cost matrix"
```

---

## Spec Coverage Check

| Spec requirement | Task |
|---|---|
| `pricing_config` table with manufacturer PK, config JSONB, updated_at, updated_by | Task 1 |
| `getPricingConfig` and `upsertPricingConfig` | Task 1 |
| `GET /api/pricing/:manufacturer` — returns DB config or hardcoded default | Task 2 |
| `PUT /api/pricing/:manufacturer` — validates, saves, invalidates cache | Task 2 |
| Admin-only (`requireAdmin`) on both endpoints | Task 2 |
| 400 for unknown manufacturer | Task 2 |
| pricingService loads from DB, falls back to hardcoded | Task 3 |
| In-memory cache + `invalidateCache` | Task 3 |
| `calculateQuote` and `calculateScreenPrintQuote` become async | Task 3 |
| `pipelineService` awaits `calculateQuote` | Task 3 |
| `getDefaultConfig` returns hardcoded data in JSONB shape | Task 3 |
| SettingsShell with Users + Manufacturers tabs | Task 4 |
| `/admin/pricing` route (admin-only) | Task 4 |
| OSP/Redwall manufacturer tabs | Task 5 |
| Printing cost grid — 12 color columns, qty tier rows, n/a cells, 7500+ static row | Task 5 |
| Fees panel — 4 editable fees + waived-at note | Task 5 |
| Print Sizes panel — Standard (static), Oversized/Jumbo (editable % + screen fee) | Task 5 |
| Save button — PUT, success message, error handling | Task 5 |
| Last updated / Using default values status line | Task 5 |
