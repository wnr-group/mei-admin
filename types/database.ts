export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; role: 'admin' | 'super_admin'; full_name: string | null; created_at: string }
        Insert: { id: string; role?: 'admin' | 'super_admin'; full_name?: string | null }
        Update: { role?: 'admin' | 'super_admin'; full_name?: string | null }
      }
      categories: {
        Row: { id: string; name: string; slug: string; description: string | null; sort_order: number; created_at: string; deleted_at: string | null }
        Insert: { id?: string; name: string; slug: string; description?: string | null; sort_order?: number }
        Update: { name?: string; slug?: string; description?: string | null; sort_order?: number; deleted_at?: string | null }
      }
      products: {
        Row: { id: string; name: string; category_id: string | null; price: number; work_types: string[]; status: 'PUBLISHED' | 'DRAFT'; description: string | null; image_url: string | null; created_at: string; updated_at: string; deleted_at: string | null }
        Insert: { id?: string; name: string; category_id?: string | null; price: number; work_types?: string[]; status?: 'PUBLISHED' | 'DRAFT'; description?: string | null; image_url?: string | null }
        Update: { name?: string; category_id?: string | null; price?: number; work_types?: string[]; status?: 'PUBLISHED' | 'DRAFT'; description?: string | null; image_url?: string | null; deleted_at?: string | null }
      }
      customers: {
        Row: { id: string; name: string; email: string | null; phone: string | null; city: string | null; created_at: string }
        Insert: { id?: string; name: string; email?: string | null; phone?: string | null; city?: string | null }
        Update: { name?: string; email?: string | null; phone?: string | null; city?: string | null }
      }
      orders: {
        Row: { id: string; order_number: string; customer_id: string | null; status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'; total: number; notes: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; order_number?: string; customer_id?: string | null; status?: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'; total: number; notes?: string | null }
        Update: { status?: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'; total?: number; notes?: string | null }
      }
      order_items: {
        Row: { id: string; order_id: string; product_id: string | null; product_name: string; quantity: number; unit_price: number; created_at: string }
        Insert: { id?: string; order_id: string; product_id?: string | null; product_name: string; quantity?: number; unit_price: number }
        Update: { quantity?: number; unit_price?: number }
      }
      enquiries: {
        Row: { id: string; name: string; email: string; phone: string | null; message: string; status: 'NEW' | 'REPLIED' | 'CLOSED'; admin_reply: string | null; replied_at: string | null; replied_by: string | null; created_at: string }
        Insert: { id?: string; name: string; email: string; phone?: string | null; message: string; status?: 'NEW' | 'REPLIED' | 'CLOSED' }
        Update: { status?: 'NEW' | 'REPLIED' | 'CLOSED'; admin_reply?: string | null; replied_at?: string | null; replied_by?: string | null }
      }
      banners: {
        Row: { id: string; title: string; image_url: string; link_url: string | null; is_active: boolean; sort_order: number; created_at: string; updated_at: string }
        Insert: { id?: string; title: string; image_url: string; link_url?: string | null; is_active?: boolean; sort_order?: number }
        Update: { title?: string; image_url?: string; link_url?: string | null; is_active?: boolean; sort_order?: number }
      }
      settings: {
        Row: { key: string; value: unknown; description: string | null; updated_at: string; updated_by: string | null }
        Insert: { key: string; value: unknown; description?: string | null; updated_by?: string | null }
        Update: { value?: unknown; description?: string | null; updated_by?: string | null }
      }
      audit_logs: {
        Row: { id: string; admin_id: string | null; action: string; resource_type: string; resource_id: string | null; old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null; user_agent: string | null; session_id: string | null; created_at: string }
        Insert: { id?: string; admin_id?: string | null; action: string; resource_type: string; resource_id?: string | null; old_data?: Record<string, unknown> | null; new_data?: Record<string, unknown> | null; user_agent?: string | null; session_id?: string | null }
        Update: never
      }
    }
    Enums: {
      admin_role: 'admin' | 'super_admin'
      order_status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
      product_status: 'PUBLISHED' | 'DRAFT'
      enquiry_status: 'NEW' | 'REPLIED' | 'CLOSED'
    }
  }
}
