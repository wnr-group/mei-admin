/**
 * Tests for CSV Parsing Module
 *
 * Comprehensive Vitest tests covering:
 * - Quoted fields with commas
 * - Multiline fields
 * - Escaped quotes
 * - Header validation
 * - Extra columns
 * - Empty files
 * - Valid CSV parsing
 * - Header-only files
 * - Trailing blank rows
 * - UTF-8 special characters
 */

import { describe, it, expect } from 'vitest'
import { parseCSV, validateHeaders, parseAndValidateFile } from './parse'

describe('CSV Parsing Module', () => {
  // Test 1: parseCSV with quoted fields
  it('should parse CSV with quoted fields containing commas', () => {
    const csv = `name,category_name,price,status,work_types,short_description,description,color_label,image_url
"Product A","Bridal","45000","PUBLISHED","Aari","A beautiful product","This is a detailed description","Red","https://example.com/image1.jpg"
"Product B","Evening","25000","DRAFT","Zardozi, Mirror","Short desc","Detailed info","Gold","https://example.com/image2.jpg"`

    const result = parseCSV(csv)

    expect(result.data).toHaveLength(2)
    expect(result.data[0]).toEqual({
      name: 'Product A',
      category_name: 'Bridal',
      price: '45000',
      status: 'PUBLISHED',
      work_types: 'Aari',
      short_description: 'A beautiful product',
      description: 'This is a detailed description',
      color_label: 'Red',
      image_url: 'https://example.com/image1.jpg',
    })
    expect(result.data[1].work_types).toBe('Zardozi, Mirror')
    expect(result.errors).toHaveLength(0)
    expect(result.meta.fields).toEqual([
      'name',
      'category_name',
      'price',
      'status',
      'work_types',
      'short_description',
      'description',
      'color_label',
      'image_url',
    ])
  })

  // Test 2: parseCSV with quoted multiline
  it('should parse CSV with quoted fields containing newlines', () => {
    const csv = `name,category_name,price,status,work_types,short_description,description,color_label,image_url
"Product A","Bridal","45000","PUBLISHED","Aari","Short","This is a description
with multiple lines
and continues here","Red","https://example.com/image.jpg"`

    const result = parseCSV(csv)

    expect(result.data).toHaveLength(1)
    expect(result.data[0].description).toBe(`This is a description
with multiple lines
and continues here`)
    expect(result.errors).toHaveLength(0)
  })

  // Test 3: parseCSV with escaped quotes
  it('should parse CSV with escaped quotes inside quoted fields', () => {
    const csv = `name,category_name,price,status,work_types,short_description,description,color_label,image_url
"Product ""Lehenga"" Edition","Bridal","45000","PUBLISHED","Aari","Desc","The ""Famous"" Design","Red","https://example.com/image.jpg"`

    const result = parseCSV(csv)

    expect(result.data).toHaveLength(1)
    expect(result.data[0].name).toBe('Product "Lehenga" Edition')
    expect(result.data[0].description).toBe('The "Famous" Design')
    expect(result.errors).toHaveLength(0)
  })

  // Test 4: validateHeaders with missing required column
  it('should return error when required column is missing', () => {
    const headers = [
      'name',
      'category_name',
      'status',
      'work_types',
      'short_description',
      'description',
      'color_label',
      'image_url',
      // Missing 'price'
    ]

    const error = validateHeaders(headers)

    expect(error).not.toBeNull()
    expect(error?.type).toBe('header')
    expect(error?.message).toContain('price')
  })

  // Test 5: validateHeaders with unknown extra column
  it('should accept headers with unknown extra columns', () => {
    const headers = [
      'name',
      'category_name',
      'price',
      'status',
      'work_types',
      'short_description',
      'description',
      'color_label',
      'image_url',
      'unknown_column',
      'another_extra_column',
    ]

    const error = validateHeaders(headers)

    expect(error).toBeNull()
  })

  // Test 6: parseAndValidateFile with empty file
  it('should return empty file error for empty CSV', () => {
    const result = parseAndValidateFile('')

    expect(result.fileError).not.toBeNull()
    expect(result.fileError?.type).toBe('empty')
    expect(result.fileError?.message).toContain('empty')
    expect(result.result).toBeNull()
    expect(result.rows).toBeNull()
  })

  // Test 7: parseAndValidateFile with valid CSV
  it('should successfully parse and validate a valid CSV', () => {
    const csv = `name,category_name,price,status,work_types,short_description,description,color_label,image_url
"Product A","Bridal","45000","PUBLISHED","Aari","Beautiful","Detailed","Red","https://example.com/image.jpg"`

    const result = parseAndValidateFile(csv)

    expect(result.fileError).toBeNull()
    expect(result.result).not.toBeNull()
    expect(result.rows).toHaveLength(1)
    expect(result.rows?.[0].name).toBe('Product A')
    expect(result.rows?.[0].price).toBe('45000')
  })

  // Test 8: parseAndValidateFile with header-only CSV
  it('should return empty rows array for header-only CSV', () => {
    const csv = `name,category_name,price,status,work_types,short_description,description,color_label,image_url`

    const result = parseAndValidateFile(csv)

    expect(result.fileError).toBeNull()
    expect(result.result).not.toBeNull()
    expect(result.rows).toEqual([])
  })

  // Test 9: parseAndValidateFile with trailing blank rows
  it('should skip trailing blank rows', () => {
    const csv = `name,category_name,price,status,work_types,short_description,description,color_label,image_url
"Product A","Bridal","45000","PUBLISHED","Aari","Beautiful","Detailed","Red","https://example.com/image1.jpg"
"Product B","Evening","25000","DRAFT","Mirror","Nice","Good","Blue","https://example.com/image2.jpg"



`

    const result = parseAndValidateFile(csv)

    expect(result.fileError).toBeNull()
    expect(result.result).not.toBeNull()
    expect(result.rows).toHaveLength(2)
    expect(result.rows?.[0].name).toBe('Product A')
    expect(result.rows?.[1].name).toBe('Product B')
  })

  // Test 10: UTF-8 with special characters
  it('should parse CSV with UTF-8 special characters and accents', () => {
    const csv = `name,category_name,price,status,work_types,short_description,description,color_label,image_url
"Lehenga Choli","Bridal","45000","PUBLISHED","Aari","Élégant design","Détails magnifiques avec café and naïve","Red","https://example.com/image.jpg"
"Saree","Casual","15000","PUBLISHED","Zardozi","हिंदी में विवरण","Descripción en español: café, naïve","Gold","https://example.com/image2.jpg"`

    const result = parseAndValidateFile(csv)

    expect(result.fileError).toBeNull()
    expect(result.result).not.toBeNull()
    expect(result.rows).toHaveLength(2)
    expect(result.rows?.[0].name).toBe('Lehenga Choli')
    expect(result.rows?.[0].short_description).toBe('Élégant design')
    expect(result.rows?.[0].description).toContain('café')
    expect(result.rows?.[1].name).toBe('Saree')
    expect(result.rows?.[1].short_description).toContain('विवरण')
  })

  // Additional edge case tests

  it('should handle whitespace in headers and trim them', () => {
    const csv = `name , category_name , price , status , work_types , short_description , description , color_label , image_url
"Product A","Bridal","45000","PUBLISHED","Aari","Desc","Details","Red","https://example.com/image.jpg"`

    const result = parseAndValidateFile(csv)

    expect(result.fileError).toBeNull()
    expect(result.rows).toHaveLength(1)
    expect(result.rows?.[0].name).toBe('Product A')
  })

  it('should detect duplicate headers as an error', () => {
    const headers = [
      'name',
      'category_name',
      'price',
      'status',
      'work_types',
      'short_description',
      'description',
      'color_label',
      'image_url',
      'name', // duplicate
    ]

    const error = validateHeaders(headers)

    expect(error).not.toBeNull()
    expect(error?.type).toBe('header')
    expect(error?.message).toContain('duplicate')
  })

  it('should return error when headers are empty or undefined', () => {
    let error = validateHeaders(undefined)
    expect(error).not.toBeNull()
    expect(error?.type).toBe('header')

    error = validateHeaders([])
    expect(error).not.toBeNull()
    expect(error?.type).toBe('header')
  })

  it('should preserve exact column values in parsed data', () => {
    const csv = `name,category_name,price,status,work_types,short_description,description,color_label,image_url
"Product with spaces   ","Category  with  spaces","45000","PUBLISHED","  Aari  ","Short   Desc","Long description","  Red  ","https://example.com/image.jpg"`

    const result = parseCSV(csv)

    expect(result.data[0].name).toBe('Product with spaces   ')
    expect(result.data[0].category_name).toBe('Category  with  spaces')
    expect(result.data[0].work_types).toBe('  Aari  ')
  })
})
