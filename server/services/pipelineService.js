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

function parseEmailResponse(text) {
  const lines = text.trim().split('\n')
  const subjectLine = lines.find(l => l.startsWith('SUBJECT:'))
  const subject = subjectLine ? subjectLine.replace('SUBJECT:', '').trim() : 'Quote from Giltee'
  const separatorIdx = lines.findIndex(l => l.trim() === '---')
  const body = separatorIdx >= 0 ? lines.slice(separatorIdx + 1).join('\n').trim() : text
  return { subject, body }
}

function formatCurrency(n) {
  if (n == null) return '—'
  return `$${Number(n).toFixed(2)}`
}

/**
 * Normalize intake_record to always have a `products` array.
 * Handles both old (product/decoration/edge_cases) and new (products[]) shapes.
 */
function normalizeIntakeRecord(ir) {
  if (!ir) return { customer: {}, products: [], flags: [], status: 'READY_FOR_PRICING' }
  if (Array.isArray(ir.products)) return ir
  return {
    customer: ir.customer ?? {},
    products: [{
      brand_style: ir.product?.brand_style ?? null,
      quantity: ir.product?.quantity ?? null,
      colors: ir.product?.colors ?? [],
      size_breakdown: ir.product?.size_breakdown ?? null,
      youth_sizes: ir.product?.youth_sizes ?? false,
      decoration: ir.decoration ?? {},
      edge_cases: ir.edge_cases ?? {},
    }],
    flags: ir.flags ?? [],
    status: ir.status ?? 'READY_FOR_PRICING',
  }
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

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
    let intake_record
    if (quote.intake_record) {
      intake_record = normalizeIntakeRecord(quote.intake_record)
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
  "products": [
    {
      "brand_style": null,
      "quantity": null,
      "size_breakdown": null,
      "colors": [],
      "youth_sizes": false,
      "decoration": {
        "method": null,
        "locations": [],
        "artwork_status": "UNKNOWN",
        "special_inks": [],
        "stitch_count": null
      },
      "edge_cases": { "extended_sizes": false, "dark_garment": null, "individual_names": false, "multiple_garment_colors": false, "garment_color_count": 1, "shipping_destination": null }
    }
  ],
  "flags": [],
  "status": "READY_FOR_PRICING",
  "missing_fields": []
}
If the inquiry mentions multiple garment styles or groups, include one object per product in the "products" array.
For decoration.method use: SCREEN_PRINT, DTF, DTG, or EMBROIDERY
For decoration.locations[].print_size use: STANDARD, OVERSIZED, or JUMBO
For size_breakdown: extract size quantities (e.g. "10 smalls, 20 mediums" → "S:10, M:20"). Codes: XS, S, M, L, XL, 2XL, 3XL, 4XL, 5XL, YXS, YS, YM, YL, YXL.`,
      })
      const parsed = claudeService.parseJSONFromText(intakeText)
      intake_record = normalizeIntakeRecord(parsed)
      await queries.updateQuote(quoteId, { intake_record })
      await appendLog(quoteId, 'Intake complete', { status: intake_record.status, products: intake_record.products.length })
    }

    // Sync customer name/email between top-level and intake_record.customer
    const updates = {}
    if (intake_record.customer?.name && !quote.customer_name) updates.customer_name = intake_record.customer.name
    if (intake_record.customer?.email && !quote.customer_email) updates.customer_email = intake_record.customer.email
    if (!intake_record.customer) intake_record.customer = {}
    if (!intake_record.customer.name && quote.customer_name) intake_record.customer.name = quote.customer_name
    if (!intake_record.customer.email && quote.customer_email) intake_record.customer.email = quote.customer_email
    updates.intake_record = intake_record
    await queries.updateQuote(quoteId, updates)

    // ── Step 2+3: Garment lookup + Pricing (per product) ───────────────────
    const products = intake_record.products
    const garment_data = []
    const pricing_osp = []
    const pricing_redwall = []
    let recommended_supplier = 'OSP'

    for (const prod of products) {
      const brandStyle = prod.brand_style
      const colors = prod.colors || []
      const requestedColor = colors[0] || null

      // Garment lookup
      let garment
      if (brandStyle && requestedColor) {
        garment = await ssService.lookupGarment({ style: brandStyle, color: requestedColor })
      } else {
        garment = { available: false, flags: ['Garment or color not specified — requires manual selection'] }
      }
      garment_data.push(garment)

      // Pricing
      const quantity = prod.quantity || 0
      const garmentCostPerUnit = garment.standardPrice || 0
      const decorationMethod = prod.decoration?.method || 'SCREEN_PRINT'
      const locations = (prod.decoration?.locations || []).map(loc => ({
        colorCount: loc.color_count || loc.colorCount || 1,
        printSize: loc.print_size || loc.printSize || 'STANDARD',
      }))
      const isDarkGarment = prod.edge_cases?.dark_garment || false

      const result = await pricingService.calculateQuote({
        quantity,
        garmentCostPerUnit,
        decorationMethod,
        locations: locations.length ? locations : [{ colorCount: 1, printSize: 'STANDARD' }],
        isDarkGarment,
        isReorder: false,
      })

      pricing_osp.push(result.osp || result.single || null)
      pricing_redwall.push(result.redwall || null)
      // Use first product's recommendation for the quote-level field
      if (garment_data.length === 1 && result.recommended) {
        recommended_supplier = result.recommended
      }
    }

    await queries.updateQuote(quoteId, { garment_data, pricing_osp, pricing_redwall, recommended_supplier })
    await appendLog(quoteId, 'Garment + Pricing complete', {
      products: products.length,
      recommended: recommended_supplier,
    })

    // ── Step 4: QA ──────────────────────────────────────────────────────────
    const effectiveSupplier = quote.selected_supplier || recommended_supplier
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
Selected supplier: ${effectiveSupplier}

Note: customer_name and customer_email may be stored either in "Quote fields" or inside intake_record.customer — treat either location as valid.
The quote may contain multiple products. Check each product independently.

For each item in "failed" and "unable_to_verify", include a "supplier" field indicating which supplier the issue applies to: "OSP", "REDWALL", or "BOTH" (for issues that apply regardless of supplier).

Return ONLY valid JSON:
{
  "passed_count": 0,
  "total_checks": 0,
  "failed": [{ "check": "check name", "issue": "specific problem", "supplier": "OSP" }],
  "unable_to_verify": [{ "check": "check name", "reason": "why unable", "supplier": "BOTH" }],
  "status": "APPROVED",
  "reviewer_notes": ""
}
For status use: APPROVED, NEEDS_FIXES, or BLOCKED`,
    })

    const qa_report = claudeService.parseJSONFromText(qaText)
    await queries.updateQuote(quoteId, { qa_report })
    await appendLog(quoteId, 'QA complete', { status: qa_report.status })

    // ── Step 5: Email draft ─────────────────────────────────────────────────
    const productSummaries = products.map((prod, i) => {
      const g = garment_data[i] || {}
      const p = effectiveSupplier === 'REDWALL' ? pricing_redwall[i] : pricing_osp[i]
      return `  • ${prod.quantity || '?'} × ${g.style || prod.brand_style || 'garment'} (${prod.decoration?.method || ''}) — ${formatCurrency(p?.orderTotal)}`
    }).join('\n')

    const emailText = await claudeService.callClaude({
      systemPrompt: skills.EMAIL_DRAFTING,
      userPrompt: `Draft the customer email for the following quote. Write in Lisa's voice exactly as described.

Customer: ${intake_record.customer?.name || quote.customer_name || 'Customer'}
Email: ${intake_record.customer?.email || quote.customer_email || ''}
Products:
${productSummaries}
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

    // ── Step 7: Drive upload ─────────────────────────────────────────────────
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

    // ── Step 8: Gmail draft ──────────────────────────────────────────────────
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
    const q = await queries.getQuote(quoteId)
    const existing = Array.isArray(q?.activity_log) ? q.activity_log : []
    await queries.updateQuote(quoteId, {
      status: 'error',
      activity_log: [...existing, logEntry('Pipeline failed', { error: err.message })],
    })
    throw err
  }
}

module.exports = { runQuotePipeline }
