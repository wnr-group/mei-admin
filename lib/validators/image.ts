/**
 * Image validation utilities for file uploads
 */

export interface ImageValidationError {
  code: 'INVALID_TYPE' | 'TOO_LARGE';
  message: string;
}

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

/**
 * Validates an image file against allowed types and size constraints
 * @param file - The File object to validate
 * @returns ImageValidationError if validation fails, null if valid
 */
export function validateImageFile(file: File): ImageValidationError | null {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type as typeof ALLOWED_MIME_TYPES[number])) {
    return {
      code: 'INVALID_TYPE',
      message: `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      code: 'TOO_LARGE',
      message: `File size exceeds 5MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`,
    };
  }

  return null;
}
