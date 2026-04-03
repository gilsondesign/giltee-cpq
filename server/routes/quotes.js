const express = require('express')
const queries = require('../db/queries')
const pipelineService = require('../services/pipelineService')

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
