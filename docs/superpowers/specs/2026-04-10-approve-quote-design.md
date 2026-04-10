# Approve Quote — Design Spec

**Date:** 2026-04-10
**Status:** Approved

---

## Overview

Quotes need a formal `approved` status. A quote that has been run and is `ready` can be approved by any logged-in user via a button in the quote detail view. Approval is reversible. The approved state is reflected everywhere a quote's status is shown (detail view and ledger).

---

## Requirements

- An **Approve Quote** button appears in the ViewQuote header, to the left of the Quote Quality button, when `quote.status === 'ready'`.
- Clicking the button opens a simple confirm modal ("Approve this quote?" / Cancel / Approve).
- On confirmation, the quote transitions to `approved` status and the approval is stamped with the approver's identity and timestamp.
- When `quote.status === 'approved'`, the Approve Quote button is replaced by a **Revoke Approval** button (same position). Clicking it opens a simple confirm modal and transitions the quote back to `ready`, clearing the approval stamp.
- Approval is available to any logged-in user (no role restriction).
- The Approve Quote button is only available when `status === 'ready'`. It is not shown for draft, processing, error, or sent quotes.
- If a user edits an approved quote, the status drops to `draft` and the approval stamp is cleared — identical to the existing `ready → draft` edit behavior.
- The `approved` status is reflected in the `StatusBadge` component used on both the detail view and the ledger. No other changes to the ledger are needed.

---

## Data Model

**New migration:** `server/db/migrations/002_add_approval_columns.sql`

```sql
ALTER TABLE quotes ADD COLUMN approved_at  TIMESTAMP;
ALTER TABLE quotes ADD COLUMN approved_by  VARCHAR(255);
```

- `approved_at` — timestamp of approval; NULL when not approved.
- `approved_by` — email of the approving user (from session); NULL when not approved.
- `approved` is added to the documented set of valid status values (existing `VARCHAR(20)` accommodates it).
- `schema.sql` is updated to reflect the new columns and include `approved` in the status comment.
- Both columns are cleared when approval is revoked or when a quote is edited back to `draft`.

---

## API

### New endpoints

**`POST /api/quotes/:id/approve`**
- Guard: returns `400` if `quote.status !== 'ready'`.
- Sets `status = 'approved'`, `approved_at = NOW()`, `approved_by = req.user.email`.
- Returns the updated quote object.

**`POST /api/quotes/:id/revoke`**
- Guard: returns `400` if `quote.status !== 'approved'`.
- Sets `status = 'ready'`, `approved_at = NULL`, `approved_by = NULL`.
- Returns the updated quote object.

### Updated validation

`server/routes/quotes.js` — add `'approved'` to the valid statuses array used by the PATCH endpoint.

### Queries

`updateQuote` in `server/db/queries.js` already accepts arbitrary valid fields. No changes needed — the new endpoints pass `approved_at` and `approved_by` through it.

---

## UI

### `StatusBadge.jsx`

Add an `approved` entry to `STATUS_STYLES`:

```js
approved: 'bg-primary-container text-on-primary-container'  // green-toned
```

### `ViewQuote.jsx` — header changes

1. **Approve Quote button** — rendered when `quote.status === 'ready'`, positioned left of the Quote Quality button.
   - On click: opens confirm modal.
   - On confirm: calls `POST /api/quotes/:id/approve`, updates local quote state on success.

2. **Revoke Approval button** — rendered when `quote.status === 'approved'`, same position.
   - Styled subtly (outlined/muted) to distinguish from primary actions.
   - On click: opens confirm modal.
   - On confirm: calls `POST /api/quotes/:id/revoke`, updates local quote state on success.

3. **Confirm modal** — a small inline modal (not a browser `confirm()`), consistent with the app's existing UI style.
   - Approve flow: title "Approve this quote?", body "This marks the quote as approved. You can revoke approval at any time.", buttons: Cancel / Approve.
   - Revoke flow: title "Revoke approval?", body "This returns the quote to Ready status.", buttons: Cancel / Revoke.

4. **Edit behavior** — extend the existing status-drop logic to handle `approved`:
   - `approved → draft` on edit (same as `ready → draft`).
   - `approved_at` and `approved_by` are cleared via the PATCH call.

### `Ledger.jsx`

No changes required — `StatusBadge` is already used per row and will pick up the new `approved` style automatically.

---

## Error Handling

- If `POST /approve` or `POST /revoke` returns a non-2xx response, the UI shows an error message and leaves the quote state unchanged. No optimistic updates.
- Server-side status guards (`400` on wrong state) prevent approval/revocation via direct API calls when the quote is in an invalid state.
- `approved_by` falls back to `req.user.name` if `req.user.email` is unavailable.

---

## Out of Scope

- Approval comments/notes (not requested).
- Role-based approval restrictions (any user can approve).
- Approval history / multiple approvals (single approval stamp only).
- Preventing email/PDF actions after approval (existing actions remain available).
