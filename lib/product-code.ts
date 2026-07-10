export function generateProductCode(name: string): string {
  const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 6)
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `MEI-${sanitizedName}-${randomSuffix}`
}
