const Anthropic = require('@anthropic-ai/sdk')

let _client = null
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

/**
 * Call Claude with a system prompt and user prompt.
 * Returns the text content of the first response message.
 */
async function callClaude({
  systemPrompt,
  userPrompt,
  model = 'claude-opus-4-6',
  maxTokens = 4096,
}) {
  const client = getClient()
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })
  return response.content[0].text
}

/**
 * Parse JSON from a Claude response that may be wrapped in a markdown code block.
 * Handles both raw JSON and ```json ... ``` wrapped responses.
 */
function parseJSONFromText(text) {
  // Try to extract JSON from a markdown code block first
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    return JSON.parse(codeBlockMatch[1].trim())
  }
  // Try direct parse
  return JSON.parse(text.trim())
}

function _resetClientForTesting() { _client = null }

module.exports = { callClaude, parseJSONFromText, _resetClientForTesting }
