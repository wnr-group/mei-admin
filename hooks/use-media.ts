'use client'

import { useMutation } from '@tanstack/react-query'
import { uploadImportImage } from '@/services/media'

export function useUploadImportImage() {
  return useMutation({
    mutationFn: (file: File) => uploadImportImage(file),
  })
}