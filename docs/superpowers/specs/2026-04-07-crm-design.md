# CRM — Customer Records

**Date:** 2026-04-07
**Status:** Approved

## Overview

Add a full CRM under the Customers tab. Customers are standalone records with a manually assigned account number. Quotes link to customers via FK. Order history stats are computed from linked quotes at query time.

---

## Data Model

### New table: `customers`

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `account_id` | VARCHAR(20) UNIQUE NOT NULL | Manually assigned, e.g. "0248" |
| `company_name` | VARCHAR(255) NOT NULL | |
| `account_type` | VARCHAR(100) | |
| `account_status` | VARCHAR(20) DEFAULT 'active' | active / inactive / prospect |
| `drive_folder_url` | VARCHAR(500) | |
| `contact_name` | VARCHAR(255) | |
| `contact_email` | VARCHAR(255) | |
| `phone` | VARCHAR(50) | |
| `preferred_contact` | VARCHAR(50) | Email / Phone / Text |
| `billing_address` | TEXT | |
| `shipping_address` | TEXT | |
| `decoration_types` | TEXT | Comma-separated list |
| `garment_vendor_pref` | VARCHAR(255) | |
| `pantone_colors` | TEXT | |
| `ink_colors` | TEXT | |
| `print_locations` | TEXT | |
| `logo_file_location` | VARCHAR(500) | |
| `sizing_notes` | TEXT | |
| `garment_style_prefs` | TEXT | |
| `reorder_likelihood` | VARCHAR(50) | High / Medium / Low |
| `next_expected_order` | TEXT | Free text, e.g. "Summer 2026" |
| `account_notes` | TEXT | |
| `created_at` | TIMESTAMP DEFAULT NOW() | |
| `updated_at` | TIMESTAMP DEFAULT NOW() | |

### Modified table: `quotes`

Add column: `customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL`

### Computed order stats (not stored)

Computed at query time from `quotes WHERE customer_id = ?`:

- **Total orders placed** — `COUNT(*)`
- **Total units ordered** — sum of all product quantities across linked quotes
- **Average order size** — total units / total orders
- **Average order frequency** — derived from date spread of linked quotes
- **Last order ref #** — most recent `quotes.id`
- **Last order description** — most recent `quotes.project_name`

### Auto-backfill on customer create

When a customer record is created, any existing quotes whose `customer_email` matches `contact_email` are automatically linked by setting `customer_id`.

---

## Routes

### Customer CRUD

| Method | Path | Description |
|---|---|---|
| GET | `/api/customers` | List all customers with computed stats |
| POST | `/api/customers` | Create customer; auto-backfill matching quotes |
| GET | `/api/customers/:id` | Full profile + computed stats |
| PATCH | `/api/customers/:id` | Update customer fields |
| DELETE | `/api/customers/:id` | Delete customer (quotes retain data, FK set null) |

### Customer search (for picker)

| Method | Path | Description |
|---|---|---|
| GET | `/api/customers/search?q=` | Search by company name or account_id, returns lightweight list |

### Quotes — customer link

- `PATCH /api/quotes/:id` already handles arbitrary field updates; `customer_id` added to `UPDATABLE_QUOTE_COLUMNS`

---

## Frontend

### `/customers` — Customer List page

- Table view matching the Ledger style
- Columns: Acct #, Company, Contact, Email, Orders (computed), Last Order (computed), Status
- Search input (filters by company name or account ID)
- Status filter dropdown (All / Active / Inactive / Prospect)
- "+ New Customer" button → `/customers/new`
- Click row → `/customers/:id`

### `/customers/new` — Create Customer page

- Same layout as CreateQuote (card + form)
- All fields from the 5 sections except computed order stats
- On submit: creates record, runs email backfill, redirects to profile

### `/customers/:id` — Customer Profile page

**Header area:**
- Company name, Acct #, email, phone
- Status badge
- Stat pills: Orders, Total Units, Avg Order Size, Last Quote ID (all computed)
- "+ New Quote" button (opens CreateQuote pre-linked to this customer)
- Edit button → toggles inline edit mode

**Two-column body:**
- Left: Primary Contact, Decoration Preferences
- Right: Order History fields, Recent Quotes list (last 5, linked to ViewQuote), Account Notes

### Quote form — Customer picker

Added above the existing Customer section fields:

- Search input: type company name or account # → live dropdown of matching customers
- Select a customer → prefills name, email, and other relevant fields; shows green linked-account chip
- "Unlink" button on chip clears `customer_id` and the prefilled fields
- Quote fields remain editable after prefill (values are per-quote overrides)
- `customer_id` saved with the quote on create/update

---

## DB Migration

The schema.sql file is updated with the new `customers` table and the `customer_id` column on `quotes`. Since the DB is managed manually (Postgres in Rancher Desktop, schema applied by hand), a migration note is included: run `ALTER TABLE quotes ADD COLUMN customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;` on the existing DB before starting the server.

---

## Out of Scope

- Customer merge / duplicate detection
- Bulk import
- Customer-level file attachments
- Activity feed / audit log per customer
