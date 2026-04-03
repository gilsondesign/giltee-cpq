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
