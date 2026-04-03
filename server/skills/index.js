const fs = require('fs')
const path = require('path')

// Strip YAML frontmatter (--- ... ---\n) before using as Claude system prompts
function loadSkill(filename) {
  try {
    const content = fs.readFileSync(path.join(__dirname, filename), 'utf-8')
    return content.replace(/^---[\s\S]*?---\n?/, '')
  } catch (err) {
    throw new Error(`Failed to load skill "${filename}": ${err.message}`)
  }
}

module.exports = {
  INTAKE: loadSkill('intake.md'),
  GARMENT: loadSkill('garment.md'),
  PRICING_RULES: loadSkill('pricing-rules.md'),
  QA: loadSkill('qa.md'),
  EMAIL_DRAFTING: loadSkill('email-drafting.md'),
}
