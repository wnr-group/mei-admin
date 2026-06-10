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

const MB_SIZE = 1024 * 1024;
const MAX_FILE_SIZE = 5 * MB_SIZE; // 5MB in bytes
const MAX_MB = Math.round(MAX_FILE_SIZE / MB_SIZE);

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
      message: `File size exceeds ${MAX_MB}MB limit. Your file is ${(file.size / MB_SIZE).toFixed(2)}MB`,
    };
  }

  return null;
}
