export const REQUIRED_COLUMNS = [
  'name',
  'category_name',
  'price',
  'status',
  'work_types',
  'short_description',
  'description',
  'color_label',
  'image_url',
] as const

export type RequiredColumn = (typeof REQUIRED_COLUMNS)[number]

export const WORK_TYPES = ['Aari', 'Zardozi', 'Mirror', 'Cut', 'Thread', 'Tailoring', 'Kundan'] as const

export const PRODUCT_STATUSES = ['PUBLISHED', 'DRAFT'] as const

export const SHORT_DESCRIPTION_MAX_LENGTH = 300
