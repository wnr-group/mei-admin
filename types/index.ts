import type { Database } from './database'

type Tables = Database['public']['Tables']

export type Profile = Tables['profiles']['Row']
export type Category = Tables['categories']['Row']
export type Product = Tables['products']['Row']
export type Customer = Tables['customers']['Row']
export type Order = Tables['orders']['Row']
export type OrderItem = Tables['order_items']['Row']

export interface OrderWithDetails extends Order {
  customers: {
    name: string
    email: string | null
  } | null
  order_items: {
    quantity: number
  }[]
}

export interface OrderDetail extends Order {
  customers: Customer | null
  order_items: Array<OrderItem & {
    products: {
      image_url: string | null
    } | null
  }>
}

export type Enquiry = Tables['enquiries']['Row']
export type Banner = Tables['banners']['Row']
export type Setting = Tables['settings']['Row']
export type AuditLog = Tables['audit_logs']['Row']

export type ProductInsert = Omit<Tables['products']['Insert'], 'product_code'> & { product_code?: string }
export type ProductUpdate = Tables['products']['Update']
export type CategoryInsert = Tables['categories']['Insert']
export type CategoryUpdate = Tables['categories']['Update']
export type OrderUpdate = Tables['orders']['Update']
export type EnquiryUpdate = Tables['enquiries']['Update']
export type BannerInsert = Tables['banners']['Insert']
export type BannerUpdate = Tables['banners']['Update']
export type SettingUpdate = Tables['settings']['Update']

export type OrderStatus = Database['public']['Enums']['order_status']
export type ProductStatus = Database['public']['Enums']['product_status']
export type EnquiryStatus = Database['public']['Enums']['enquiry_status']
