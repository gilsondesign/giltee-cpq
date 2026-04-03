jest.mock('../db/pool', () => ({ query: jest.fn(), on: jest.fn() }))

const skills = require('../skills/index')

describe('skills loader', () => {
  it('loads all 5 skills as non-empty strings', () => {
    expect(typeof skills.INTAKE).toBe('string')
    expect(typeof skills.GARMENT).toBe('string')
    expect(typeof skills.PRICING_RULES).toBe('string')
    expect(typeof skills.QA).toBe('string')
    expect(typeof skills.EMAIL_DRAFTING).toBe('string')
    expect(skills.INTAKE.length).toBeGreaterThan(100)
    expect(skills.QA.length).toBeGreaterThan(100)
  })

  it('strips YAML frontmatter from skill content', () => {
    // None of the exported skills should start with ---
    expect(skills.INTAKE.startsWith('---')).toBe(false)
    expect(skills.QA.startsWith('---')).toBe(false)
  })

  it('INTAKE skill includes required field names', () => {
    expect(skills.INTAKE).toContain('Decoration')
    expect(skills.INTAKE).toContain('Customer')
  })
})
