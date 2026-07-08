### Task 3: Rule evaluation logic (pure, unit-tested)

**Files:**
- Create: `lib/category-rules.ts`
- Test: `__tests__/lib/category-rules.test.ts`

**Interfaces:**
- Consumes: `RuleField`, `RuleOperator`, `CategoryMatchType` from `@/types` (Task 2).
- Produces: `OPERATORS_BY_FIELD: Record<RuleField, RuleOperator[]>`, `RuleInput = { field: RuleField; operator: RuleOperator; value: string }`, `RuleEvaluableProduct = { name: string; work_types: string[]; price: number }`, `evaluateRule(product, rule): boolean`, `evaluateCategoryRules(product, rules, matchType): boolean`. These exact names/signatures are relied on by Tasks 5 and 8.

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/lib/category-rules.test.ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run __tests__/lib/category-rules.test.ts`
Expected: FAIL — `Cannot find module '@/lib/category-rules'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/category-rules.ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run __tests__/lib/category-rules.test.ts`
Expected: PASS (17 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/category-rules.ts __tests__/lib/category-rules.test.ts
git commit -m "feat(category-rules): add pure rule evaluation logic"
```

---

