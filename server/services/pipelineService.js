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
  if (!quote.raw_input && !quote.intake_record) throw new Error(`Quote ${quoteId} has no input to process`)

  await queries.updateQuote(quoteId, {
    status: 'processing',
    activity_log: [logEntry('Pipeline started')],
  })

  try {
    // ── Step 1: Intake ──────────────────────────────────────────────────────
    // Skip Claude extraction if intake_record was manually edited and saved
    let intake_record
    if (quote.intake_record) {
      intake_record = quote.intake_record
      await appendLog(quoteId, 'Using saved intake record')
    } else {
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
For decoration.locations[].print_size use: STANDARD, OVERSIZED, or JUMBO
For product.size_breakdown: extract any size quantities mentioned (e.g. "10 smalls, 20 mediums, 20 larges, 10 XL" → "S:10, M:20, L:20, XL:10"). Use codes: XS, S, M, L, XL, 2XL, 3XL, 4XL, 5XL, YXS, YS, YM, YL, YXL. If no breakdown is given, set to null.`,
      })
      intake_record = claudeService.parseJSONFromText(intakeText)
      await queries.updateQuote(quoteId, { intake_record })
      await appendLog(quoteId, 'Intake complete', { status: intake_record.status })
    }

    // Sync customer name/email between top-level quote fields and intake_record.customer
    const updates = {}
    if (intake_record.customer?.name && !quote.customer_name) updates.customer_name = intake_record.customer.name
    if (intake_record.customer?.email && !quote.customer_email) updates.customer_email = intake_record.customer.email

    // Backfill intake_record.customer from top-level fields if missing
    if (!intake_record.customer) intake_record.customer = {}
    if (!intake_record.customer.name && quote.customer_name) intake_record.customer.name = quote.customer_name
    if (!intake_record.customer.email && quote.customer_email) intake_record.customer.email = quote.customer_email

    updates.intake_record = intake_record
    await queries.updateQuote(quoteId, updates)

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
    // Fetch latest quote state so QA has the most up-to-date top-level fields
    const currentQuoteForQA = await queries.getQuote(quoteId)
    const qaText = await claudeService.callClaude({
      systemPrompt: skills.QA,
      userPrompt: `Run the complete QA checklist on this quote data.

Quote fields: ${JSON.stringify({
        customer_name: currentQuoteForQA.customer_name,
        customer_email: currentQuoteForQA.customer_email,
        project_name: currentQuoteForQA.project_name,
      })}
Intake record: ${JSON.stringify(intake_record)}
Garment data: ${JSON.stringify(garment_data)}
OSP pricing: ${JSON.stringify(pricing_osp)}
Redwall pricing: ${JSON.stringify(pricing_redwall)}

Note: customer_name and customer_email may be stored either in "Quote fields" above or inside intake_record.customer — treat either location as valid.

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
    const effectiveSupplier = quote.selected_supplier || recommended_supplier
    const effectivePricing = effectiveSupplier === 'REDWALL' ? pricing_redwall : pricing_osp
    const emailText = await claudeService.callClaude({
      systemPrompt: skills.EMAIL_DRAFTING,
      userPrompt: `Draft the customer email for the following quote. Write in Lisa's voice exactly as described.

Customer: ${intake_record.customer?.name || quote.customer_name || 'Customer'}
Email: ${intake_record.customer?.email || quote.customer_email || ''}
Order: ${quantity} × ${brandStyle || 'garment'} — ${decorationMethod}
Color: ${requestedColor || ''}
Total: ${formatCurrency(effectivePricing?.orderTotal)} (${effectiveSupplier})
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
    const pdfBuffer = await pdfService.generateQuotePDF(currentQuote, effectiveSupplier)
    await appendLog(quoteId, 'PDF generated')

    // ── Step 7: Drive upload (optional — skipped if credentials not configured) ─
    const pdfFilename = `${quoteId}-${(quote.customer_name || 'Quote').replace(/\s+/g, '-')}-Quote.pdf`
    const driveConfigured = process.env.GMAIL_CLIENT_ID && !process.env.GMAIL_CLIENT_ID.startsWith('your_')
    if (driveConfigured) {
      try {
        const driveResult = await driveService.uploadPDF(pdfBuffer, pdfFilename)
        await queries.updateQuote(quoteId, { pdf_url: driveResult.url })
        await appendLog(quoteId, 'PDF uploaded to Drive', { url: driveResult.url })
      } catch (err) {
        await appendLog(quoteId, 'Drive upload skipped', { warning: err.message })
      }
    } else {
      await appendLog(quoteId, 'Drive upload skipped — credentials not configured')
    }

    // ── Step 8: Gmail draft (optional — skipped if credentials not configured) ─
    const gmailConfigured = driveConfigured && process.env.GMAIL_REFRESH_TOKEN && !process.env.GMAIL_REFRESH_TOKEN.startsWith('your_')
    const recipientEmail = intake_record.customer?.email || quote.customer_email
    if (!gmailConfigured) {
      await appendLog(quoteId, 'Gmail draft skipped — credentials not configured')
    } else if (!recipientEmail) {
      await appendLog(quoteId, 'Gmail draft skipped — no recipient email')
    } else {
      try {
        const draftId = await gmailService.createDraft({
          to: recipientEmail,
          subject: emailSubject,
          body: emailBody,
          pdfBuffer,
          pdfFilename,
        })
        await queries.updateQuote(quoteId, { gmail_draft_id: draftId })
        await appendLog(quoteId, 'Gmail draft created', { draftId })
      } catch (err) {
        await appendLog(quoteId, 'Gmail draft skipped', { warning: err.message })
      }
    }

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
