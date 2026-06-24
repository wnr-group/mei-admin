import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

const { default: ColorCard } = await import('@/components/products/colors/ColorCard')

const mockColor = { id: '1', product_id: 'p1', label: 'Ivory White', hex_code: '#FFFFF0', sort_order: 0, created_at: '' }

describe('ColorCard', () => {
  it('renders color label', () => {
    render(<ColorCard color={mockColor} onEdit={() => {}} onDelete={() => {}} />)
    expect(screen.getByText('Ivory White')).toBeInTheDocument()
  })

  it('renders hex code when present', () => {
    render(<ColorCard color={mockColor} onEdit={() => {}} onDelete={() => {}} />)
    expect(screen.getByText('#FFFFF0')).toBeInTheDocument()
  })

  it('calls onEdit when edit button clicked', () => {
    const onEdit = vi.fn()
    render(<ColorCard color={mockColor} onEdit={onEdit} onDelete={() => {}} />)
    fireEvent.click(screen.getByTitle('Edit color'))
    expect(onEdit).toHaveBeenCalledWith(mockColor)
  })

  it('calls onDelete when delete button clicked', () => {
    const onDelete = vi.fn()
    render(<ColorCard color={mockColor} onEdit={() => {}} onDelete={onDelete} />)
    fireEvent.click(screen.getByTitle('Delete color'))
    expect(onDelete).toHaveBeenCalledWith(mockColor)
  })
})
