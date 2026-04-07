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
  if (response.status === 404) return []
  if (!response.ok) throw new Error(`S&S API error: ${response.status} on ${path}`)
  return response.json()
}

/**
 * Look up a styleID given a style name string (e.g. "3001CVC", "3001", "Bella 3001", "Bella+Canvas 3001CVC").
 * Tries multiple strategies in order: exact → starts-with → contains → token-by-token.
 * Returns { styleID, styleName, brandName } or null.
 */
async function findStyle(styleInput) {
  const input = styleInput.trim().toUpperCase()

  // Fetch all styles (S&S catalog ~5k styles)
  const styles = await fetchSS('/styles/?mediatype=json')
  if (!styles.length) return null

  function pick(matches) {
    // Prefer shortest styleName (most specific without extra suffixes)
    matches.sort((a, b) => a.styleName.length - b.styleName.length)
    return { styleID: matches[0].styleID, styleName: matches[0].styleName, brandName: matches[0].brandName }
  }

  // 1. Exact match on styleName
  const exact = styles.filter(s => s.styleName && s.styleName.toUpperCase() === input)
  if (exact.length) return pick(exact)

  // 2. styleName starts with input ("3001" → "3001CVC", "3001C")
  const startsWith = styles.filter(s => s.styleName && s.styleName.toUpperCase().startsWith(input))
  if (startsWith.length) return pick(startsWith)

  // 3. input contains styleName ("Bella+Canvas 3001CVC" contains "3001CVC")
  const inputContains = styles.filter(s => {
    if (!s.styleName) return false
    return input.includes(s.styleName.toUpperCase())
  })
  if (inputContains.length) {
    // Prefer longest styleName found inside input (most specific)
    inputContains.sort((a, b) => b.styleName.length - a.styleName.length)
    return { styleID: inputContains[0].styleID, styleName: inputContains[0].styleName, brandName: inputContains[0].brandName }
  }

  // 4. Token match: try each word in input as a starts-with search
  // Handles "Bella 3001" → token "3001" starts-with "3001CVC"
  const tokens = input.split(/[\s+\-,/]+/).filter(t => t.length >= 3)
  for (const token of tokens) {
    const tokenMatches = styles.filter(s => s.styleName && s.styleName.toUpperCase().startsWith(token))
    if (tokenMatches.length) return pick(tokenMatches)
  }

  return null
}

/**
 * Look up a garment by style and color.
 * Returns structured availability + pricing data for use in the pipeline.
 *
 * @param {{ style: string, color: string }} params
 * @returns {Promise<GarmentData>}
 */
async function lookupGarment({ style, color }) {
  // Step 1: Resolve style name → styleID
  const styleInfo = await findStyle(style)

  if (!styleInfo) {
    return {
      style,
      requestedColor: color,
      available: false,
      error: `Style "${style}" not found in S&S catalog`,
      alternatives: [],
      standardPrice: null,
      extendedSkus: [],
      imageUrl: null,
      skus: [],
    }
  }

  // Step 2: Fetch SKUs by styleID
  const skus = await fetchSS(`/products/?styleID=${styleInfo.styleID}&mediatype=json`)

  if (!skus.length) {
    return {
      style,
      resolvedStyle: styleInfo.styleName,
      brandName: styleInfo.brandName,
      requestedColor: color,
      available: false,
      alternatives: [],
      standardPrice: null,
      extendedSkus: [],
      imageUrl: null,
      skus: [],
    }
  }

  const colorSkus = skus.filter(
    s => s.colorName && s.colorName.toLowerCase().includes(color.toLowerCase())
  )

  if (!colorSkus.length) {
    const alternatives = [...new Set(skus.map(s => s.colorName))].slice(0, 5)
    return {
      style,
      resolvedStyle: styleInfo.styleName,
      brandName: styleInfo.brandName,
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
    resolvedStyle: styleInfo.styleName,
    brandName: styleInfo.brandName,
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

module.exports = { lookupGarment, buildAuthHeader, findStyle }
