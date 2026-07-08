import { describe, it, expect } from 'vitest'
import { evaluateRule, evaluateCategoryRules, OPERATORS_BY_FIELD } from '@/lib/category-rules'

const product = { name: 'Zardozi Bridal Lehenga', work_types: ['ZARDOZI', 'AARI'], price: 45000 }

describe('OPERATORS_BY_FIELD', () => {
  it('restricts name and work_types to contains/is', () => {
    expect(OPERATORS_BY_FIELD.name).toEqual(['contains', 'is'])
    expect(OPERATORS_BY_FIELD.work_types).toEqual(['contains', 'is'])
  })

  it('restricts price to is/greater_than/less_than', () => {
    expect(OPERATORS_BY_FIELD.price).toEqual(['is', 'greater_than', 'less_than'])
  })
})

describe('evaluateRule — name', () => {
  it('contains matches case-insensitive substring', () => {
    expect(evaluateRule(product, { field: 'name', operator: 'contains', value: 'bridal' })).toBe(true)
    expect(evaluateRule(product, { field: 'name', operator: 'contains', value: 'saree' })).toBe(false)
  })

  it('is matches case-insensitive exact name', () => {
    expect(evaluateRule(product, { field: 'name', operator: 'is', value: 'zardozi bridal lehenga' })).toBe(true)
    expect(evaluateRule(product, { field: 'name', operator: 'is', value: 'bridal' })).toBe(false)
  })
})

describe('evaluateRule — work_types', () => {
  it('contains matches when the array includes the value, case-insensitive', () => {
    expect(evaluateRule(product, { field: 'work_types', operator: 'contains', value: 'aari' })).toBe(true)
    expect(evaluateRule(product, { field: 'work_types', operator: 'contains', value: 'kundan' })).toBe(false)
  })

  it('is matches only when the array is exactly that single value', () => {
    expect(evaluateRule({ ...product, work_types: ['ZARDOZI'] }, { field: 'work_types', operator: 'is', value: 'zardozi' })).toBe(true)
    expect(evaluateRule(product, { field: 'work_types', operator: 'is', value: 'zardozi' })).toBe(false)
  })
})

describe('evaluateRule — price', () => {
  it('is matches exact price', () => {
    expect(evaluateRule(product, { field: 'price', operator: 'is', value: '45000' })).toBe(true)
    expect(evaluateRule(product, { field: 'price', operator: 'is', value: '1' })).toBe(false)
  })

  it('greater_than and less_than compare numerically', () => {
    expect(evaluateRule(product, { field: 'price', operator: 'greater_than', value: '40000' })).toBe(true)
    expect(evaluateRule(product, { field: 'price', operator: 'greater_than', value: '50000' })).toBe(false)
    expect(evaluateRule(product, { field: 'price', operator: 'less_than', value: '50000' })).toBe(true)
  })

  it('returns false when the rule value is not numeric', () => {
    expect(evaluateRule(product, { field: 'price', operator: 'greater_than', value: 'abc' })).toBe(false)
  })
})

describe('evaluateRule — invalid operator/field combination', () => {
  it('returns false for greater_than on name', () => {
    expect(evaluateRule(product, { field: 'name', operator: 'greater_than', value: '10' })).toBe(false)
  })
})

describe('evaluateCategoryRules', () => {
  const rules = [
    { field: 'work_types' as const, operator: 'contains' as const, value: 'zardozi' },
    { field: 'price' as const, operator: 'greater_than' as const, value: '40000' },
  ]

  it('ALL requires every rule to match', () => {
    expect(evaluateCategoryRules(product, rules, 'ALL')).toBe(true)
    expect(evaluateCategoryRules({ ...product, price: 100 }, rules, 'ALL')).toBe(false)
  })

  it('ANY requires at least one rule to match', () => {
    expect(evaluateCategoryRules({ ...product, price: 100 }, rules, 'ANY')).toBe(true)
    expect(evaluateCategoryRules({ ...product, price: 100, work_types: ['KUNDAN'] }, rules, 'ANY')).toBe(false)
  })

  it('returns false when there are no rules', () => {
    expect(evaluateCategoryRules(product, [], 'ALL')).toBe(false)
    expect(evaluateCategoryRules(product, [], 'ANY')).toBe(false)
  })
})
