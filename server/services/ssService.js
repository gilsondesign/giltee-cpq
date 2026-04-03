const SS_BASE_URL = 'https://api.ssactivewear.com/v2'
const EXTENDED_SIZE_CODES = new Set(['2XL', '3XL', '4XL', '5XL'])

function buildAuthHeader() {
  const token = Buffer.from(
    `${process.env.SS_ACCOUNT_NUMBER}:${process.env.SS_API_KEY}`
  ).toString('base64')
  return `Basic ${token}`
}

async function fetchSS(path) {
  const response = await fetch(`${SS_BASE_URL}${path}`, {
    headers: {
      Authorization: buildAuthHeader(),
      Accept: 'application/json',
    },
  })
  if (!response.ok) throw new Error(`S&S API error: ${response.status} on ${path}`)
  return response.json()
}

/**
 * Look up a garment by style and color.
 * Returns structured availability + pricing data for use in the pipeline.
 *
 * @param {{ style: string, color: string }} params
 * @returns {Promise<GarmentData>}
 */
async function lookupGarment({ style, color }) {
  const skus = await fetchSS(`/products/?style=${encodeURIComponent(style)}&mediatype=json`)

  const colorSkus = skus.filter(
    s => s.colorName && s.colorName.toLowerCase().includes(color.toLowerCase())
  )

  if (!colorSkus.length) {
    const alternatives = [...new Set(skus.map(s => s.colorName))].slice(0, 5)
    return {
      style,
      requestedColor: color,
      available: false,
      alternatives,
      standardPrice: null,
      extendedSkus: [],
      imageUrl: null,
      skus: [],
    }
  }

  const standardSkus = colorSkus.filter(s => !EXTENDED_SIZE_CODES.has(s.sizePriceCodeName))
  const extendedSkus = colorSkus.filter(s => EXTENDED_SIZE_CODES.has(s.sizePriceCodeName))

  const standardPrice = standardSkus.length
    ? Math.min(...standardSkus.map(s => s.customerPrice))
    : null

  const outOfSizes = colorSkus.filter(s => s.qty === 0).map(s => s.sizeName)
  const lowStock = colorSkus.some(s => s.qty > 0 && s.qty < 50)

  const imageUrl = colorSkus[0]?.colorFrontImage
    ? `https://www.ssactivewear.com/${colorSkus[0].colorFrontImage}`
    : null

  return {
    style,
    requestedColor: color,
    available: true,
    lowStock,
    outOfSizes,
    standardPrice,
    extendedSkus: extendedSkus.map(s => ({
      size: s.sizeName,
      price: s.customerPrice,
      qty: s.qty,
    })),
    imageUrl,
    skus: colorSkus.map(s => ({
      sku: s.sku,
      size: s.sizeName,
      color: s.colorName,
      price: s.customerPrice,
      qty: s.qty,
      isExtended: EXTENDED_SIZE_CODES.has(s.sizePriceCodeName),
    })),
  }
}

module.exports = { lookupGarment, buildAuthHeader }
