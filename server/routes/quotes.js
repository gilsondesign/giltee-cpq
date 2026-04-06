const express = require('express')
const queries = require('../db/queries')
const pipelineService = require('../services/pipelineService')
const pdfService = require('../services/pdfService')

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
    const { customerName, customerEmail, projectName, rawInput, intake_record } = req.body
    if (!rawInput && !customerName) {
      return res.status(400).json({ error: 'rawInput or customerName is required' })
    }
    const quote = await queries.createQuote({
      customerName: customerName || null,
      customerEmail: customerEmail || null,
      projectName: projectName || null,
      rawInput: rawInput || null,
      intakeRecord: intake_record || null,
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
    const VALID_STATUSES = new Set(['draft', 'processing', 'ready', 'error', 'sent'])
    if (req.body.status !== undefined && !VALID_STATUSES.has(req.body.status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(', ')}` })
    }
    const quote = await queries.updateQuote(req.params.id, req.body)
    if (!quote) return res.status(404).json({ error: 'Quote not found' })
    res.json(quote)
  } catch (err) {
    next(err)
  }
})

// GET /api/quotes/:id/pdf — serve the quote PDF inline or as download
router.get('/:id/pdf', async (req, res, next) => {
  try {
    const quote = await queries.getQuote(req.params.id)
    if (!quote) return res.status(404).json({ error: 'Quote not found' })
    if (!quote.intake_record) return res.status(400).json({ error: 'Quote has not been processed yet' })

    const effectiveSupplier = quote.selected_supplier || quote.recommended_supplier
    const pdfBuffer = await pdfService.generateQuotePDF(quote, effectiveSupplier)
    const filename = `${quote.id}-${(quote.customer_name || 'Quote').replace(/\s+/g, '-')}-Quote.pdf`

    res.set('Content-Type', 'application/pdf')
    res.set('Content-Length', pdfBuffer.length)

    if (req.query.download === 'true') {
      res.set('Content-Disposition', `attachment; filename="${filename}"`)
    } else {
      res.set('Content-Disposition', `inline; filename="${filename}"`)
    }

    res.send(pdfBuffer)
  } catch (err) {
    next(err)
  }
})

// POST /api/quotes/:id/draft — create a Gmail draft with the PDF attached
router.post('/:id/draft', async (req, res, next) => {
  try {
    const quote = await queries.getQuote(req.params.id)
    if (!quote) return res.status(404).json({ error: 'Quote not found' })
    if (!quote.email_draft) return res.status(400).json({ error: 'No email draft on this quote' })
    if (!quote.intake_record) return res.status(400).json({ error: 'Quote has not been processed yet' })

    const gmailService = require('../services/gmailService')
    const pdfService = require('../services/pdfService')

    const gmailConfigured = process.env.GMAIL_CLIENT_ID && !process.env.GMAIL_CLIENT_ID.startsWith('your_')
      && process.env.GMAIL_REFRESH_TOKEN && !process.env.GMAIL_REFRESH_TOKEN.startsWith('your_')
    if (!gmailConfigured) {
      return res.status(503).json({ error: 'Gmail credentials are not configured' })
    }

    // Parse subject and body from stored email_draft
    const lines = quote.email_draft.split('\n')
    const subjectLine = lines.find(l => l.startsWith('SUBJECT:'))
    const subject = subjectLine ? subjectLine.replace('SUBJECT:', '').trim() : `Quote from Giltee — ${quote.id}`
    const body = lines.slice(subjectLine ? 2 : 0).join('\n').trim()

    const recipientEmail = quote.intake_record?.customer?.email || quote.customer_email
    if (!recipientEmail) return res.status(400).json({ error: 'No recipient email on this quote' })

    const effectiveSupplier = quote.selected_supplier || quote.recommended_supplier
    const pdfBuffer = await pdfService.generateQuotePDF(quote, effectiveSupplier)
    const pdfFilename = `${quote.id}-${(quote.customer_name || 'Quote').replace(/\s+/g, '-')}-Quote.pdf`

    const draftId = await gmailService.createDraft({ to: recipientEmail, subject, body, pdfBuffer, pdfFilename })
    const updated = await queries.updateQuote(req.params.id, { gmail_draft_id: draftId })
    res.json({ draftId, quote: updated })
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
