jest.mock('../db/pool', () => ({ query: jest.fn(), on: jest.fn() }))

// Mock the Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Hello from Claude' }]
      })
    }
  }))
})

const Anthropic = require('@anthropic-ai/sdk')
const claudeService = require('../services/claudeService')

beforeEach(() => {
  // Reset all mocks but keep the implementation
  jest.clearAllMocks()
  Anthropic.mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Hello from Claude' }]
      })
    }
  }))
})

describe('claudeService.callClaude', () => {
  it('calls Anthropic messages.create with correct params', async () => {
    const result = await claudeService.callClaude({
      systemPrompt: 'You are a helpful assistant.',
      userPrompt: 'Say hello.',
    })

    const instance = Anthropic.mock.results[0].value
    expect(instance.messages.create).toHaveBeenCalledWith(expect.objectContaining({
      system: 'You are a helpful assistant.',
      messages: [{ role: 'user', content: 'Say hello.' }],
    }))
    expect(result).toBe('Hello from Claude')
  })

  it('uses claude-opus-4-6 as default model', async () => {
    await claudeService.callClaude({ systemPrompt: 'x', userPrompt: 'y' })
    const instance = Anthropic.mock.results[0].value
    expect(instance.messages.create).toHaveBeenCalledWith(expect.objectContaining({
      model: 'claude-opus-4-6',
    }))
  })

  it('accepts model override', async () => {
    await claudeService.callClaude({
      systemPrompt: 'x',
      userPrompt: 'y',
      model: 'claude-sonnet-4-6',
    })
    const instance = Anthropic.mock.results[0].value
    expect(instance.messages.create).toHaveBeenCalledWith(expect.objectContaining({
      model: 'claude-sonnet-4-6',
    }))
  })

  it('throws when Anthropic SDK throws', async () => {
    Anthropic.mockImplementation(() => ({
      messages: {
        create: jest.fn().mockRejectedValue(new Error('API rate limit'))
      }
    }))
    await expect(
      claudeService.callClaude({ systemPrompt: 'x', userPrompt: 'y' })
    ).rejects.toThrow('API rate limit')
  })
})

describe('claudeService.parseJSONFromText', () => {
  it('parses raw JSON', () => {
    const result = claudeService.parseJSONFromText('{"foo": "bar"}')
    expect(result).toEqual({ foo: 'bar' })
  })

  it('extracts JSON from markdown code block', () => {
    const text = 'Here is the result:\n```json\n{"foo": "bar"}\n```\nDone.'
    const result = claudeService.parseJSONFromText(text)
    expect(result).toEqual({ foo: 'bar' })
  })

  it('throws on invalid JSON', () => {
    expect(() => claudeService.parseJSONFromText('not json')).toThrow()
  })
})
