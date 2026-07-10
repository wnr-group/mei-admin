import { describe, it, expect } from 'vitest'
import { generateProductCode } from '@/lib/product-code'

describe('generateProductCode', () => {
  it('prefixes with MEI- and a 6-character uppercase name segment', () => {
    const code = generateProductCode('Lehenga A2')
    expect(code.startsWith('MEI-LEHENG-')).toBe(true)
  })

  it('strips non-alphanumeric characters from the name segment', () => {
    const code = generateProductCode("Women's Silk Saree!")
    expect(code).toMatch(/^MEI-WOMENS-[A-Z0-9]{4}$/)
  })

  it('truncates the name segment to 6 characters', () => {
    const code = generateProductCode('SuperLongProductName')
    expect(code.split('-')[1]).toHaveLength(6)
  })

  it('generates a 4-character uppercase alphanumeric random suffix', () => {
    const code = generateProductCode('Gown')
    const suffix = code.split('-')[2]
    expect(suffix).toMatch(/^[A-Z0-9]{4}$/)
  })

  it('produces different codes across calls for the same name', () => {
    const codes = new Set(Array.from({ length: 10 }, () => generateProductCode('Gown')))
    expect(codes.size).toBeGreaterThan(1)
  })
})
