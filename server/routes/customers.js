const express = require('express')
const customerQueries = require('../db/customerQueries')

const router = express.Router()

// GET /api/customers/search?q= — must be before /:id
router.get('/search', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim()
    if (!q) return res.json([])
    const results = await customerQueries.searchCustomers(q)
    res.json(results)
  } catch (err) {
    next(err)
  }
})

// GET /api/customers
router.get('/', async (req, res, next) => {
  try {
    const { search, status } = req.query
    const customers = await customerQueries.listCustomers({ search, status })
    // Attach computed stats to each customer
    const withStats = await Promise.all(
      customers.map(async c => {
        const stats = await customerQueries.getCustomerStats(c.id)
        return { ...c, ...stats }
      })
    )
    res.json(withStats)
  } catch (err) {
    next(err)
  }
})

// POST /api/customers
router.post('/', async (req, res, next) => {
  try {
    const { account_id, company_name } = req.body
    if (!account_id || !company_name) {
      return res.status(400).json({ error: 'account_id and company_name are required' })
    }
    const customer = await customerQueries.createCustomer(req.body)
    await customerQueries.backfillQuotesByEmail(customer.id, customer.contact_email)
    const stats = await customerQueries.getCustomerStats(customer.id)
    res.status(201).json({ ...customer, ...stats })
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Account ID already exists' })
    }
    next(err)
  }
})

// GET /api/customers/:id
router.get('/:id', async (req, res, next) => {
  try {
    const customer = await customerQueries.getCustomer(req.params.id)
    if (!customer) return res.status(404).json({ error: 'Customer not found' })
    const stats = await customerQueries.getCustomerStats(customer.id)
    res.json({ ...customer, ...stats })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/customers/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const customer = await customerQueries.updateCustomer(req.params.id, req.body)
    if (!customer) return res.status(404).json({ error: 'Customer not found' })
    const stats = await customerQueries.getCustomerStats(customer.id)
    res.json({ ...customer, ...stats })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/customers/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await customerQueries.getCustomer(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Customer not found' })
    await customerQueries.deleteCustomer(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

module.exports = router
