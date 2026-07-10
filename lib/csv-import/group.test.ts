/**
 * Tests for CSV grouping logic (group.ts)
 */

import { describe, it, expect } from 'vitest'
import { normalizeProductName, groupRowsByProduct } from './group'

describe('normalizeProductName', () => {
  it('should trim leading and trailing whitespace', () => {
    expect(normalizeProductName('  Product A  ')).toBe('Product A')
  })

  it('should collapse multiple consecutive spaces to single space', () => {
    expect(normalizeProductName('Product  B')).toBe('Product B')
  })
})

describe('groupRowsByProduct', () => {
  it('should group single-color product with primary image', () => {
    const rows = [
      {
        name: 'Lehenga A',
        category_name: 'Lehenga',
        price: '5000',
        status: 'PUBLISHED',
        work_types: 'Aari',
        short_description: 'Beautiful lehenga',
        description: 'A beautiful lehenga with aari work',
        color_label: '',
        image_url: 'https://example.com/image1.jpg',
      },
    ]

    const result = groupRowsByProduct(rows)

    expect(result.groups).toHaveLength(1)
    expect(result.groups[0].name).toBe('Lehenga A')
    expect(result.groups[0].primaryImages).toHaveLength(1)
    expect(result.groups[0].primaryImages[0].url).toBe('https://example.com/image1.jpg')
    expect(result.groups[0].colors).toHaveLength(0)
    expect(result.unassignedRows).toHaveLength(0)
  })

  it('should group multi-color product with correct image counts', () => {
    const rows = [
      {
        name: 'Lehenga B',
        category_name: 'Lehenga',
        price: '6000',
        status: 'PUBLISHED',
        work_types: 'Zardozi',
        short_description: 'Elegant lehenga',
        description: 'Elegant lehenga with zardozi work',
        color_label: 'Red',
        image_url: 'https://example.com/red1.jpg',
      },
      {
        name: 'Lehenga B',
        category_name: '',
        price: '',
        status: '',
        work_types: '',
        short_description: '',
        description: '',
        color_label: 'Red',
        image_url: 'https://example.com/red2.jpg',
      },
      {
        name: 'Lehenga B',
        category_name: '',
        price: '',
        status: '',
        work_types: '',
        short_description: '',
        description: '',
        color_label: 'Blue',
        image_url: 'https://example.com/blue1.jpg',
      },
    ]

    const result = groupRowsByProduct(rows)

    expect(result.groups).toHaveLength(1)
    expect(result.groups[0].name).toBe('Lehenga B')
    expect(result.groups[0].colors).toHaveLength(2)
    expect(result.groups[0].colors[0].label).toBe('Red')
    expect(result.groups[0].colors[0].imageUrls).toHaveLength(2)
    expect(result.groups[0].colors[1].label).toBe('Blue')
    expect(result.groups[0].colors[1].imageUrls).toHaveLength(1)
    expect(result.unassignedRows).toHaveLength(0)
  })

  it('should handle primary and color images together', () => {
    const rows = [
      {
        name: 'Saree C',
        category_name: 'Saree',
        price: '7000',
        status: 'PUBLISHED',
        work_types: 'Mirror',
        short_description: 'Classic saree',
        description: 'A classic saree',
        color_label: '',
        image_url: 'https://example.com/primary.jpg',
      },
      {
        name: 'Saree C',
        category_name: '',
        price: '',
        status: '',
        work_types: '',
        short_description: '',
        description: '',
        color_label: 'Gold',
        image_url: 'https://example.com/gold.jpg',
      },
      {
        name: 'Saree C',
        category_name: '',
        price: '',
        status: '',
        work_types: '',
        short_description: '',
        description: '',
        color_label: 'Silver',
        image_url: 'https://example.com/silver.jpg',
      },
      {
        name: 'Saree C',
        category_name: '',
        price: '',
        status: '',
        work_types: '',
        short_description: '',
        description: '',
        color_label: 'Gold',
        image_url: 'https://example.com/gold2.jpg',
      },
    ]

    const result = groupRowsByProduct(rows)

    expect(result.groups).toHaveLength(1)
    expect(result.groups[0].primaryImages).toHaveLength(1)
    expect(result.groups[0].primaryImages[0].url).toBe('https://example.com/primary.jpg')
    expect(result.groups[0].colors).toHaveLength(2)
    expect(result.groups[0].colors[0].label).toBe('Gold')
    expect(result.groups[0].colors[0].imageUrls).toHaveLength(2)
    expect(result.groups[0].colors[1].label).toBe('Silver')
    expect(result.unassignedRows).toHaveLength(0)
  })

  it('should group multiple products correctly', () => {
    const rows = [
      {
        name: 'Product A',
        category_name: 'Category 1',
        price: '1000',
        status: 'PUBLISHED',
        work_types: 'Aari',
        short_description: 'Product A desc',
        description: 'Product A long desc',
        color_label: '',
        image_url: 'https://example.com/a1.jpg',
      },
      {
        name: 'Product A',
        category_name: '',
        price: '',
        status: '',
        work_types: '',
        short_description: '',
        description: '',
        color_label: '',
        image_url: 'https://example.com/a2.jpg',
      },
      {
        name: 'Product B',
        category_name: 'Category 2',
        price: '2000',
        status: 'DRAFT',
        work_types: 'Zardozi',
        short_description: 'Product B desc',
        description: 'Product B long desc',
        color_label: 'Red',
        image_url: 'https://example.com/b1.jpg',
      },
      {
        name: 'Product B',
        category_name: '',
        price: '',
        status: '',
        work_types: '',
        short_description: '',
        description: '',
        color_label: 'Blue',
        image_url: 'https://example.com/b2.jpg',
      },
      {
        name: 'Product B',
        category_name: '',
        price: '',
        status: '',
        work_types: '',
        short_description: '',
        description: '',
        color_label: 'Blue',
        image_url: 'https://example.com/b3.jpg',
      },
    ]

    const result = groupRowsByProduct(rows)

    expect(result.groups).toHaveLength(2)
    expect(result.groups[0].name).toBe('Product A')
    expect(result.groups[0].groupRowIndices).toEqual([2, 3])
    expect(result.groups[0].primaryImages).toHaveLength(2)
    expect(result.groups[1].name).toBe('Product B')
    expect(result.groups[1].groupRowIndices).toEqual([4, 5, 6])
    expect(result.groups[1].colors).toHaveLength(2)
    expect(result.groups[1].colors[1].imageUrls).toHaveLength(2)
    expect(result.unassignedRows).toHaveLength(0)
  })

  it('should handle blank product names', () => {
    const rows = [
      {
        name: '',
        category_name: 'Category',
        price: '1000',
        status: 'PUBLISHED',
        work_types: 'Aari',
        short_description: 'desc',
        description: 'long desc',
        color_label: '',
        image_url: 'https://example.com/image.jpg',
      },
    ]

    const result = groupRowsByProduct(rows)

    expect(result.groups).toHaveLength(0)
    expect(result.unassignedRows).toHaveLength(1)
    expect(result.unassignedRows[0].rowIndex).toBe(2)
    expect(result.unassignedRows[0].error.field).toBe('name')
    expect(result.unassignedRows[0].error.message).toBe(
      'Missing product name — cannot be grouped into a product'
    )
  })

  it('should preserve file order for products and colors', () => {
    const rows = [
      {
        name: 'Product B',
        category_name: 'Cat B',
        price: '2000',
        status: 'PUBLISHED',
        work_types: 'Mirror',
        short_description: 'B desc',
        description: 'B long',
        color_label: 'Red',
        image_url: 'https://example.com/br.jpg',
      },
      {
        name: 'Product A',
        category_name: 'Cat A',
        price: '1000',
        status: 'PUBLISHED',
        work_types: 'Aari',
        short_description: 'A desc',
        description: 'A long',
        color_label: 'Green',
        image_url: 'https://example.com/ag.jpg',
      },
      {
        name: 'Product B',
        category_name: '',
        price: '',
        status: '',
        work_types: '',
        short_description: '',
        description: '',
        color_label: 'Blue',
        image_url: 'https://example.com/bb.jpg',
      },
      {
        name: 'Product A',
        category_name: '',
        price: '',
        status: '',
        work_types: '',
        short_description: '',
        description: '',
        color_label: 'Yellow',
        image_url: 'https://example.com/ay.jpg',
      },
      {
        name: 'Product B',
        category_name: '',
        price: '',
        status: '',
        work_types: '',
        short_description: '',
        description: '',
        color_label: 'Green',
        image_url: 'https://example.com/bg.jpg',
      },
      {
        name: 'Product A',
        category_name: '',
        price: '',
        status: '',
        work_types: '',
        short_description: '',
        description: '',
        color_label: 'Green',
        image_url: 'https://example.com/ag2.jpg',
      },
    ]

    const result = groupRowsByProduct(rows)

    expect(result.groups).toHaveLength(2)
    expect(result.groups[0].name).toBe('Product B')
    expect(result.groups[1].name).toBe('Product A')
    expect(result.groups[0].colors[0].label).toBe('Red')
    expect(result.groups[0].colors[1].label).toBe('Blue')
    expect(result.groups[0].colors[2].label).toBe('Green')
    expect(result.groups[1].colors[0].label).toBe('Green')
    expect(result.groups[1].colors[1].label).toBe('Yellow')
  })

  it('should handle repeated color labels by appending images', () => {
    const rows = [
      {
        name: 'Dress',
        category_name: 'Category',
        price: '3000',
        status: 'PUBLISHED',
        work_types: 'Tailoring',
        short_description: 'dress',
        description: 'long dress',
        color_label: 'Purple',
        image_url: 'https://example.com/purple1.jpg',
      },
      {
        name: 'Dress',
        category_name: '',
        price: '',
        status: '',
        work_types: '',
        short_description: '',
        description: '',
        color_label: 'Purple',
        image_url: 'https://example.com/purple2.jpg',
      },
      {
        name: 'Dress',
        category_name: '',
        price: '',
        status: '',
        work_types: '',
        short_description: '',
        description: '',
        color_label: 'Purple',
        image_url: 'https://example.com/purple3.jpg',
      },
    ]

    const result = groupRowsByProduct(rows)

    expect(result.groups).toHaveLength(1)
    expect(result.groups[0].colors).toHaveLength(1)
    expect(result.groups[0].colors[0].label).toBe('Purple')
    expect(result.groups[0].colors[0].imageUrls).toHaveLength(3)
    expect(result.groups[0].colors[0].imageUrls).toEqual([
      'https://example.com/purple1.jpg',
      'https://example.com/purple2.jpg',
      'https://example.com/purple3.jpg',
    ])
  })

  it('should handle mixed blank and non-blank product names', () => {
    const rows = [
      {
        name: 'Product X',
        category_name: 'Cat X',
        price: '5000',
        status: 'PUBLISHED',
        work_types: 'Kundan',
        short_description: 'X desc',
        description: 'X long',
        color_label: '',
        image_url: 'https://example.com/x.jpg',
      },
      {
        name: '',
        category_name: 'Cat Y',
        price: '6000',
        status: 'PUBLISHED',
        work_types: 'Cut',
        short_description: 'Y desc',
        description: 'Y long',
        color_label: '',
        image_url: 'https://example.com/y.jpg',
      },
      {
        name: 'Product Y',
        category_name: 'Cat Y',
        price: '6000',
        status: 'PUBLISHED',
        work_types: 'Cut',
        short_description: 'Y desc',
        description: 'Y long',
        color_label: '',
        image_url: 'https://example.com/y2.jpg',
      },
      {
        name: '   ',
        category_name: 'Cat Z',
        price: '7000',
        status: 'DRAFT',
        work_types: 'Thread',
        short_description: 'Z desc',
        description: 'Z long',
        color_label: '',
        image_url: 'https://example.com/z.jpg',
      },
    ]

    const result = groupRowsByProduct(rows)

    expect(result.groups).toHaveLength(2)
    expect(result.groups[0].name).toBe('Product X')
    expect(result.groups[1].name).toBe('Product Y')
    expect(result.unassignedRows).toHaveLength(2)
    expect(result.unassignedRows[0].rowIndex).toBe(3)
    expect(result.unassignedRows[1].rowIndex).toBe(5)
  })

  it('should return empty result for empty input', () => {
    const result = groupRowsByProduct([])

    expect(result.groups).toHaveLength(0)
    expect(result.unassignedRows).toHaveLength(0)
  })
})
