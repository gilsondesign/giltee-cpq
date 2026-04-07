const pool = require('./pool')

const UPDATABLE_CUSTOMER_COLUMNS = new Set([
  'company_name', 'account_type', 'account_status', 'drive_folder_url',
  'contact_name', 'contact_email', 'phone', 'preferred_contact',
  'billing_address', 'shipping_address', 'decoration_types', 'garment_vendor_pref',
  'pantone_colors', 'ink_colors', 'print_locations', 'logo_file_location',
  'sizing_notes', 'garment_style_prefs', 'reorder_likelihood', 'next_expected_order',
  'account_notes', 'account_id'
])

async function createCustomer(data) {
  const {
    account_id, company_name, account_type, account_status = 'active',
    drive_folder_url, contact_name, contact_email, phone, preferred_contact,
    billing_address, shipping_address, decoration_types, garment_vendor_pref,
    pantone_colors, ink_colors, print_locations, logo_file_location,
    sizing_notes, garment_style_prefs, reorder_likelihood, next_expected_order,
    account_notes
  } = data

  const { rows } = await pool.query(
    `INSERT INTO customers (
      account_id, company_name, account_type, account_status,
      drive_folder_url, contact_name, contact_email, phone, preferred_contact,
      billing_address, shipping_address, decoration_types, garment_vendor_pref,
      pantone_colors, ink_colors, print_locations, logo_file_location,
      sizing_notes, garment_style_prefs, reorder_likelihood, next_expected_order,
      account_notes
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
    ) RETURNING *`,
    [
      account_id, company_name, account_type || null, account_status,
      drive_folder_url || null, contact_name || null, contact_email || null,
      phone || null, preferred_contact || null, billing_address || null,
      shipping_address || null, decoration_types || null, garment_vendor_pref || null,
      pantone_colors || null, ink_colors || null, print_locations || null,
      logo_file_location || null, sizing_notes || null, garment_style_prefs || null,
      reorder_likelihood || null, next_expected_order || null, account_notes || null
    ]
  )
  return rows[0]
}

async function getCustomer(id) {
  const { rows } = await pool.query('SELECT * FROM customers WHERE id = $1', [id])
  return rows[0] || null
}

async function listCustomers({ search, status } = {}) {
  const params = []
  const conditions = []

  if (status && status !== 'all') {
    params.push(status)
    conditions.push(`c.account_status = $${params.length}`)
  }
  if (search) {
    params.push(`%${search}%`)
    conditions.push(`(c.company_name ILIKE $${params.length} OR c.account_id ILIKE $${params.length})`)
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''

  // Single query: join with aggregate stats to avoid N+1
  const query = `
    SELECT c.*,
           COUNT(q.id)::int                    AS "totalOrders",
           MAX(q.id)                            AS "lastOrderId",
           (SELECT project_name FROM quotes
            WHERE customer_id = c.id
            ORDER BY created_at DESC LIMIT 1)  AS "lastOrderName"
    FROM customers c
    LEFT JOIN quotes q ON q.customer_id = c.id
    ${where}
    GROUP BY c.id
    ORDER BY c.company_name ASC
  `
  const { rows } = await pool.query(query, params)
  return rows.map(r => ({
    ...r,
    totalOrders: r.totalOrders ?? 0,
    lastOrder: r.lastOrderId ? { id: r.lastOrderId, project_name: r.lastOrderName } : null,
  }))
}

async function updateCustomer(id, data) {
  const keys = Object.keys(data).filter(k => UPDATABLE_CUSTOMER_COLUMNS.has(k))
  if (keys.length === 0) throw new Error('No valid fields to update')

  const values = keys.map(k => data[k])
  const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ')

  const { rows } = await pool.query(
    `UPDATE customers SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, ...values]
  )
  return rows[0] || null
}

async function deleteCustomer(id) {
  await pool.query('DELETE FROM customers WHERE id = $1', [id])
}

async function searchCustomers(q) {
  const { rows } = await pool.query(
    `SELECT id, account_id, company_name, contact_name, contact_email, account_status
     FROM customers
     WHERE company_name ILIKE $1 OR account_id ILIKE $1
     ORDER BY company_name ASC
     LIMIT 10`,
    [`%${q}%`]
  )
  return rows
}

async function getCustomerStats(customerId) {
  const { rows } = await pool.query(
    `SELECT id, project_name, status, created_at, intake_record
     FROM quotes WHERE customer_id = $1
     ORDER BY created_at DESC`,
    [customerId]
  )

  const totalOrders = rows.length
  let totalUnits = 0
  for (const q of rows) {
    const products = q.intake_record?.products || []
    for (const p of products) {
      totalUnits += parseInt(p.quantity, 10) || 0
    }
  }
  const avgOrderSize = totalOrders > 0 ? Math.round(totalUnits / totalOrders) : 0

  const recentQuotes = rows.slice(0, 5).map(q => ({
    id: q.id,
    project_name: q.project_name,
    status: q.status,
    created_at: q.created_at,
  }))

  const lastOrder = rows[0]
    ? { id: rows[0].id, project_name: rows[0].project_name }
    : null

  return { totalOrders, totalUnits, avgOrderSize, recentQuotes, lastOrder }
}

async function backfillQuotesByEmail(customerId, contactEmail) {
  if (!contactEmail) return
  await pool.query(
    `UPDATE quotes SET customer_id = $1
     WHERE customer_email ILIKE $2 AND customer_id IS NULL`,
    [customerId, contactEmail]
  )
}

module.exports = {
  createCustomer, getCustomer, listCustomers, updateCustomer, deleteCustomer,
  searchCustomers, getCustomerStats, backfillQuotesByEmail
}
