/** Max attempts to regenerate a slug/product-code on a uniqueness collision. */
export const MAX_SLUG_CODE_ATTEMPTS = 20

/** Hard ceiling on products per import; rejected before any writes if exceeded. */
export const MAX_IMPORT_PRODUCTS = 1000

/** Number of products per multi-row insert call. */
export const PRODUCT_INSERT_CHUNK_SIZE = 200
