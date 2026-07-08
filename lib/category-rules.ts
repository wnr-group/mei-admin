import type { RuleField, RuleOperator, CategoryMatchType } from '@/types'

export const OPERATORS_BY_FIELD: Record<RuleField, RuleOperator[]> = {
  name: ['contains', 'is'],
  work_types: ['contains', 'is'],
  price: ['is', 'greater_than', 'less_than'],
}

export interface RuleInput {
  field: RuleField
  operator: RuleOperator
  value: string
}

export interface RuleEvaluableProduct {
  name: string
  work_types: string[]
  price: number
}

function evaluateNameRule(product: RuleEvaluableProduct, rule: RuleInput): boolean {
  const name = product.name.toLowerCase()
  const value = rule.value.toLowerCase()
  if (rule.operator === 'contains') return name.includes(value)
  if (rule.operator === 'is') return name === value
  return false
}

function evaluateWorkTypesRule(product: RuleEvaluableProduct, rule: RuleInput): boolean {
  const types = (product.work_types ?? []).map((t) => t.toLowerCase())
  const value = rule.value.toLowerCase()
  if (rule.operator === 'contains') return types.includes(value)
  if (rule.operator === 'is') return types.length === 1 && types[0] === value
  return false
}

function evaluatePriceRule(product: RuleEvaluableProduct, rule: RuleInput): boolean {
  const numericValue = Number(rule.value)
  if (Number.isNaN(numericValue)) return false
  if (rule.operator === 'is') return product.price === numericValue
  if (rule.operator === 'greater_than') return product.price > numericValue
  if (rule.operator === 'less_than') return product.price < numericValue
  return false
}

export function evaluateRule(product: RuleEvaluableProduct, rule: RuleInput): boolean {
  switch (rule.field) {
    case 'name': return evaluateNameRule(product, rule)
    case 'work_types': return evaluateWorkTypesRule(product, rule)
    case 'price': return evaluatePriceRule(product, rule)
    default: return false
  }
}

export function evaluateCategoryRules(
  product: RuleEvaluableProduct,
  rules: RuleInput[],
  matchType: CategoryMatchType
): boolean {
  if (rules.length === 0) return false
  return matchType === 'ALL' ? rules.every((r) => evaluateRule(product, r)) : rules.some((r) => evaluateRule(product, r))
}
