import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '@/lib/errors'
import { validateImageFile } from '@/lib/validators/image'

const mockUpload = vi.fn()
const mockGetPublicUrl = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    storage: {
      from: mockFrom,
    },
  }),
}))

const { uploadProductImage } = await import('@/services/storage')

describe('Storage Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl,
    })
  })

  describe('validateImageFile', () => {
    it('should return error for unsupported file type', () => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' })
      const result = validateImageFile(file)

      expect(result).not.toBeNull()
      expect(result?.code).toBe('INVALID_TYPE')
      expect(result?.message).toContain('Invalid file type')
    })

    it('should return error for file exceeding size limit', () => {
      const largeBuffer = new Uint8Array(6 * 1024 * 1024) // 6MB
      const file = new File([largeBuffer], 'large.jpg', { type: 'image/jpeg' })
      const result = validateImageFile(file)

      expect(result).not.toBeNull()
      expect(result?.code).toBe('TOO_LARGE')
      expect(result?.message).toContain('exceeds')
    })

    it('should return null for valid JPEG files', () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      expect(validateImageFile(file)).toBeNull()
    })

    it('should return null for valid PNG files', () => {
      const file = new File(['test'], 'test.png', { type: 'image/png' })
      expect(validateImageFile(file)).toBeNull()
    })

    it('should return null for valid WebP files', () => {
      const file = new File(['test'], 'test.webp', { type: 'image/webp' })
      expect(validateImageFile(file)).toBeNull()
    })

    it('should return null for valid GIF files', () => {
      const file = new File(['test'], 'test.gif', { type: 'image/gif' })
      expect(validateImageFile(file)).toBeNull()
    })

    it('should return null for files at exactly 5MB limit', () => {
      const buffer = new Uint8Array(5 * 1024 * 1024) // exactly 5MB
      const file = new File([buffer], 'test.jpg', { type: 'image/jpeg' })
      expect(validateImageFile(file)).toBeNull()
    })
  })

  describe('uploadProductImage', () => {
    it('should validate file before uploading', async () => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' })

      try {
        await uploadProductImage(file, 'product-1')
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(AppError)
        expect((err as AppError).code).toBe('VALIDATION_ERROR')
      }

      // Verify upload was never called
      expect(mockUpload).not.toHaveBeenCalled()
    })

    it('should call storage.upload for valid files', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      mockUpload.mockResolvedValue({ error: null })
      mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/image.jpg' } })

      const url = await uploadProductImage(file, 'product-1')

      expect(url).toBe('https://example.com/image.jpg')
      expect(mockUpload).toHaveBeenCalled()
    })

    it('should construct correct path with productId', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      mockUpload.mockResolvedValue({ error: null })
      mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/image.jpg' } })

      await uploadProductImage(file, 'product-123')

      const callArgs = mockUpload.mock.calls[0]
      const uploadPath = callArgs[0]
      expect(uploadPath).toMatch(/^products\/product-123\/\d+\.jpg$/)
    })
  })
})
