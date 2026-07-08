### Task 2: TypeScript types for the new tables

**Files:**
- Modify: `types/database.ts`
- Modify: `types/index.ts`

**Interfaces:**
- Consumes: schema from Task 1.
- Produces: `Database['public']['Tables']['category_rules']`, `Database['public']['Tables']['product_categories']`; exported types `CategoryRule`, `CategoryRuleInsert`, `CategoryRuleUpdate`, `ProductCategory`, `ProductCategoryInsert`, `RuleField`, `RuleOperator`, `CategoryMatchType`, `ProductCategorySource`; `Category` row/insert/update gain `rule_match_type`.

- [ ] **Step 1: Add `rule_match_type` to the `categories` table entry**

In `types/database.ts`, replace the `categories` block (currently lines 17-21):

```ts
      categories: {
        Row: { id: string; name: string; slug: string; subtitle: string | null; description: string | null; image_url: string | null; is_active: boolean; sort_order: number; rule_match_type: 'ALL' | 'ANY'; created_at: string; updated_at: string; deleted_at: string | null }
        Insert: { id?: string; name: string; slug: string; subtitle?: string | null; description?: string | null; image_url?: string | null; is_active?: boolean; sort_order?: number; rule_match_type?: 'ALL' | 'ANY' }
        Update: { name?: string; slug?: string; subtitle?: string | null; description?: string | null; image_url?: string | null; is_active?: boolean; sort_order?: number; rule_match_type?: 'ALL' | 'ANY'; deleted_at?: string | null }
      }
```

- [ ] **Step 2: Add `category_rules` and `product_categories` table entries**

In `types/database.ts`, insert immediately after the `categories` block (before the `products` block):

```ts
      category_rules: {
        Row: { id: string; category_id: string; field: 'name' | 'work_types' | 'price'; operator: 'contains' | 'is' | 'greater_than' | 'less_than'; value: string; created_at: string; updated_at: string }
        Insert: { id?: string; category_id: string; field: 'name' | 'work_types' | 'price'; operator: 'contains' | 'is' | 'greater_than' | 'less_than'; value: string }
        Update: { field?: 'name' | 'work_types' | 'price'; operator?: 'contains' | 'is' | 'greater_than' | 'less_than'; value?: string }
      }
      product_categories: {
        Row: { id: string; product_id: string; category_id: string; source: 'manual' | 'rule'; created_at: string }
        Insert: { id?: string; product_id: string; category_id: string; source: 'manual' | 'rule' }
        Update: { source?: 'manual' | 'rule' }
      }
```

- [ ] **Step 3: Add the new enums**

In `types/database.ts`, in the `Enums` block (currently lines 68-74), add:

```ts
      rule_field: 'name' | 'work_types' | 'price'
      rule_operator: 'contains' | 'is' | 'greater_than' | 'less_than'
      category_match_type: 'ALL' | 'ANY'
      product_category_source: 'manual' | 'rule'
```

- [ ] **Step 4: Export the new app-level types**

In `types/index.ts`, after the existing `export type CategoryUpdate = Tables['categories']['Update']` line, add:

```ts
export type CategoryRule = Tables['category_rules']['Row']
export type CategoryRuleInsert = Tables['category_rules']['Insert']
export type CategoryRuleUpdate = Tables['category_rules']['Update']
export type ProductCategory = Tables['product_categories']['Row']
export type ProductCategoryInsert = Tables['product_categories']['Insert']

export type RuleField = Database['public']['Enums']['rule_field']
export type RuleOperator = Database['public']['Enums']['rule_operator']
export type CategoryMatchType = Database['public']['Enums']['category_match_type']
export type ProductCategorySource = Database['public']['Enums']['product_category_source']
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors (existing `Category` consumers still compile since `rule_match_type` is additive).

- [ ] **Step 6: Commit**

```bash
git add types/database.ts types/index.ts
git commit -m "feat(types): add category_rules and product_categories types"
```

---

