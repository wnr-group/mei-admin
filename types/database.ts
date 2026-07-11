export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_logs: {
        Row: { action: string; admin_id: string | null; created_at: string; id: string; new_data: Json | null; old_data: Json | null; resource_id: string | null; resource_type: string; session_id: string | null; user_agent: string | null; }
        Insert: { action: string; admin_id?: string | null; created_at?: string; id?: string; new_data?: Json | null; old_data?: Json | null; resource_id?: string | null; resource_type: string; session_id?: string | null; user_agent?: string | null; }
        Update: { action?: string; admin_id?: string | null; created_at?: string; id?: string; new_data?: Json | null; old_data?: Json | null; resource_id?: string | null; resource_type?: string; session_id?: string | null; user_agent?: string | null; }
        Relationships: []
      }
      banners: {
        Row: { created_at: string; deleted_at: string | null; id: string; image_url: string; is_active: boolean; link_url: string | null; sort_order: number; title: string; updated_at: string; }
        Insert: { created_at?: string; deleted_at?: string | null; id?: string; image_url: string; is_active?: boolean; link_url?: string | null; sort_order?: number; title: string; updated_at?: string; }
        Update: { created_at?: string; deleted_at?: string | null; id?: string; image_url?: string; is_active?: boolean; link_url?: string | null; sort_order?: number; title?: string; updated_at?: string; }
        Relationships: []
      }
      categories: {
        Row: { id: string; name: string; slug: string; subtitle: string | null; description: string | null; image_url: string | null; is_active: boolean; sort_order: number; rule_match_type: 'ALL' | 'ANY'; measurement_template_id: string | null; created_at: string; updated_at: string; deleted_at: string | null }
        Insert: { id?: string; name: string; slug: string; subtitle?: string | null; description?: string | null; image_url?: string | null; is_active?: boolean; sort_order?: number; rule_match_type?: 'ALL' | 'ANY'; measurement_template_id?: string | null }
        Update: { name?: string; slug?: string; subtitle?: string | null; description?: string | null; image_url?: string | null; is_active?: boolean; sort_order?: number; rule_match_type?: 'ALL' | 'ANY'; measurement_template_id?: string | null; deleted_at?: string | null }
      }
      category_rules: {
        Row: { id: string; category_id: string; field: 'name' | 'work_types' | 'price'; operator: 'contains' | 'is' | 'greater_than' | 'less_than'; value: string; created_at: string; updated_at: string }
        Insert: { id?: string; category_id: string; field: 'name' | 'work_types' | 'price'; operator: 'contains' | 'is' | 'greater_than' | 'less_than'; value: string }
        Update: { field?: 'name' | 'work_types' | 'price'; operator?: 'contains' | 'is' | 'greater_than' | 'less_than'; value?: string }
      }
      product_categories: {
        Row: { id: string; product_id: string; category_id: string; source: 'manual' | 'rule'; created_at: string }
        Insert: { id?: string; product_id: string; category_id: string; source: 'manual' | 'rule' }
        Update: { source?: 'manual' | 'rule' }
      }
      blouse_configurations: {
        Row: { blouse_measurement_template_id: string | null; created_at: string; customization_type: | Database["public"]["Enums"]["customization_type"] | null; id: string; includes_blouse: boolean; product_id: string; stitching_options: string[]; }
        Insert: { blouse_measurement_template_id?: string | null; created_at?: string; customization_type?: | Database["public"]["Enums"]["customization_type"] | null; id?: string; includes_blouse?: boolean; product_id: string; stitching_options?: string[]; }
        Update: { blouse_measurement_template_id?: string | null; created_at?: string; customization_type?: | Database["public"]["Enums"]["customization_type"] | null; id?: string; includes_blouse?: boolean; product_id?: string; stitching_options?: string[]; }
        Relationships: [
          {
            foreignKeyName: "blouse_configurations_blouse_measurement_template_id_fkey"
            columns: ["blouse_measurement_template_id"]
            isOneToOne: false
            referencedRelation: "measurement_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blouse_configurations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blouse_configurations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products_storefront"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: { city: string | null; created_at: string; email: string | null; id: string; name: string; phone: string | null; }
        Insert: { city?: string | null; created_at?: string; email?: string | null; id?: string; name: string; phone?: string | null; }
        Update: { city?: string | null; created_at?: string; email?: string | null; id?: string; name?: string; phone?: string | null; }
        Relationships: []
      }
      enquiries: {
        Row: { admin_reply: string | null; budget: string | null; created_at: string; deleted_at: string | null; email: string; id: string; measurements: Json | null; message: string; name: string; occasion: string | null; phone: string | null; reference_images: Json | null; replied_at: string | null; replied_by: string | null; status: Database["public"]["Enums"]["enquiry_status"]; }
        Insert: { admin_reply?: string | null; budget?: string | null; created_at?: string; deleted_at?: string | null; email: string; id?: string; measurements?: Json | null; message: string; name: string; occasion?: string | null; phone?: string | null; reference_images?: Json | null; replied_at?: string | null; replied_by?: string | null; status?: Database["public"]["Enums"]["enquiry_status"]; }
        Update: { admin_reply?: string | null; budget?: string | null; created_at?: string; deleted_at?: string | null; email?: string; id?: string; measurements?: Json | null; message?: string; name?: string; occasion?: string | null; phone?: string | null; reference_images?: Json | null; replied_at?: string | null; replied_by?: string | null; status?: Database["public"]["Enums"]["enquiry_status"]; }
        Relationships: []
      }
      measurement_template_fields: {
        Row: { created_at: string; field_key: Database["public"]["Enums"]["measurement_field_key"]; help_text: string | null; id: string; is_required: boolean; label: string | null; sort_order: number; template_id: string; }
        Insert: { created_at?: string; field_key: Database["public"]["Enums"]["measurement_field_key"]; help_text?: string | null; id?: string; is_required?: boolean; label?: string | null; sort_order?: number; template_id: string; }
        Update: { created_at?: string; field_key?: Database["public"]["Enums"]["measurement_field_key"]; help_text?: string | null; id?: string; is_required?: boolean; label?: string | null; sort_order?: number; template_id?: string; }
        Relationships: [
          {
            foreignKeyName: "measurement_template_fields_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "measurement_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_templates: {
        Row: { category_id: string | null; created_at: string; created_by: string | null; customization_type: | Database["public"]["Enums"]["customization_type"] | null; deleted_at: string | null; id: string; is_active: boolean; name: string; product_id: string | null; updated_by: string | null; version: number; }
        Insert: { category_id?: string | null; created_at?: string; created_by?: string | null; customization_type?: | Database["public"]["Enums"]["customization_type"] | null; deleted_at?: string | null; id?: string; is_active?: boolean; name: string; product_id?: string | null; updated_by?: string | null; version?: number; }
        Update: { category_id?: string | null; created_at?: string; created_by?: string | null; customization_type?: | Database["public"]["Enums"]["customization_type"] | null; deleted_at?: string | null; id?: string; is_active?: boolean; name?: string; product_id?: string | null; updated_by?: string | null; version?: number; }
        Relationships: [
          {
            foreignKeyName: "measurement_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurement_templates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurement_templates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products_storefront"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_events: {
        Row: { event_data: Json | null; event_type: string; id: string; job_id: string | null; provider_message_id: string | null; received_at: string; }
        Insert: { event_data?: Json | null; event_type: string; id?: string; job_id?: string | null; provider_message_id?: string | null; received_at?: string; }
        Update: { event_data?: Json | null; event_type?: string; id?: string; job_id?: string | null; provider_message_id?: string | null; received_at?: string; }
        Relationships: [
          {
            foreignKeyName: "notification_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "notification_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_jobs: {
        Row: { attempts: number; created_at: string; id: string; idempotency_key: string; last_error: string | null; max_attempts: number; next_attempt_at: string; payload: Json; priority: number; provider_message_id: string | null; recipient_email: string; sent_at: string | null; status: Database["public"]["Enums"]["notification_job_status"]; type: Database["public"]["Enums"]["notification_type"]; updated_at: string; }
        Insert: { attempts?: number; created_at?: string; id?: string; idempotency_key: string; last_error?: string | null; max_attempts?: number; next_attempt_at?: string; payload?: Json; priority?: number; provider_message_id?: string | null; recipient_email: string; sent_at?: string | null; status?: Database["public"]["Enums"]["notification_job_status"]; type: Database["public"]["Enums"]["notification_type"]; updated_at?: string; }
        Update: { attempts?: number; created_at?: string; id?: string; idempotency_key?: string; last_error?: string | null; max_attempts?: number; next_attempt_at?: string; payload?: Json; priority?: number; provider_message_id?: string | null; recipient_email?: string; sent_at?: string | null; status?: Database["public"]["Enums"]["notification_job_status"]; type?: Database["public"]["Enums"]["notification_type"]; updated_at?: string; }
        Relationships: []
      }
      order_item_measurements: {
        Row: { field_key: Database["public"]["Enums"]["measurement_field_key"]; id: string; label: string | null; notes: string | null; order_item_id: string; recorded_at: string; recorded_by: string | null; value_in: number; }
        Insert: { field_key: Database["public"]["Enums"]["measurement_field_key"]; id?: string; label?: string | null; notes?: string | null; order_item_id: string; recorded_at?: string; recorded_by?: string | null; value_in: number; }
        Update: { field_key?: Database["public"]["Enums"]["measurement_field_key"]; id?: string; label?: string | null; notes?: string | null; order_item_id?: string; recorded_at?: string; recorded_by?: string | null; value_in?: number; }
        Relationships: [
          {
            foreignKeyName: "order_item_measurements_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: { created_at: string; id: string; order_id: string; product_id: string | null; product_name: string; product_snapshot: Json | null; quantity: number; unit_price: number; variant_id: string | null; variant_snapshot: Json | null; stitching_type: 'stitched' | 'unstitched' | null; }
        Insert: { created_at?: string; id?: string; order_id: string; product_id?: string | null; product_name: string; product_snapshot?: Json | null; quantity?: number; unit_price: number; variant_id?: string | null; variant_snapshot?: Json | null; stitching_type?: 'stitched' | 'unstitched' | null; }
        Update: { created_at?: string; id?: string; order_id?: string; product_id?: string | null; product_name?: string; product_snapshot?: Json | null; quantity?: number; unit_price?: number; variant_id?: string | null; variant_snapshot?: Json | null; stitching_type?: 'stitched' | 'unstitched' | null; }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products_storefront"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: { created_at: string; customer_id: string | null; deleted_at: string | null; id: string; notes: string | null; order_number: string; payment_id: string | null; payment_metadata: Json | null; payment_provider: string | null; shipping_address: Json | null; status: Database["public"]["Enums"]["order_status"]; total: number; updated_at: string; }
        Insert: { created_at?: string; customer_id?: string | null; deleted_at?: string | null; id?: string; notes?: string | null; order_number?: string; payment_id?: string | null; payment_metadata?: Json | null; payment_provider?: string | null; shipping_address?: Json | null; status?: Database["public"]["Enums"]["order_status"]; total: number; updated_at?: string; }
        Update: { created_at?: string; customer_id?: string | null; deleted_at?: string | null; id?: string; notes?: string | null; order_number?: string; payment_id?: string | null; payment_metadata?: Json | null; payment_provider?: string | null; shipping_address?: Json | null; status?: Database["public"]["Enums"]["order_status"]; total?: number; updated_at?: string; }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_colors: {
        Row: { created_at: string; deleted_at: string | null; hex_code: string | null; id: string; label: string; product_id: string; sort_order: number; swatch_image_url: string | null; }
        Insert: { created_at?: string; deleted_at?: string | null; hex_code?: string | null; id?: string; label: string; product_id: string; sort_order?: number; swatch_image_url?: string | null; }
        Update: { created_at?: string; deleted_at?: string | null; hex_code?: string | null; id?: string; label?: string; product_id?: string; sort_order?: number; swatch_image_url?: string | null; }
        Relationships: [
          {
            foreignKeyName: "product_colors_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_colors_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products_storefront"
            referencedColumns: ["id"]
          },
        ]
      }
      product_media: {
        Row: { alt_text: string | null; color_id: string | null; created_at: string; created_by: string | null; deleted_at: string | null; id: string; is_primary: boolean; media_type: Database["public"]["Enums"]["media_type"]; product_id: string; sort_order: number; thumbnail_url: string | null; url: string; variant_id: string | null; video_provider: string | null; }
        Insert: { alt_text?: string | null; color_id?: string | null; created_at?: string; created_by?: string | null; deleted_at?: string | null; id?: string; is_primary?: boolean; media_type?: Database["public"]["Enums"]["media_type"]; product_id: string; sort_order?: number; thumbnail_url?: string | null; url: string; variant_id?: string | null; video_provider?: string | null; }
        Update: { alt_text?: string | null; color_id?: string | null; created_at?: string; created_by?: string | null; deleted_at?: string | null; id?: string; is_primary?: boolean; media_type?: Database["public"]["Enums"]["media_type"]; product_id?: string; sort_order?: number; thumbnail_url?: string | null; url?: string; variant_id?: string | null; video_provider?: string | null; }
        Relationships: [
          {
            foreignKeyName: "product_media_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "product_colors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "v_product_colors_storefront"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products_storefront"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: { allow_backorder: boolean; color_id: string | null; created_at: string; created_by: string | null; customization_type: Database["public"]["Enums"]["customization_type"]; deleted_at: string | null; id: string; is_available: boolean; low_stock_threshold: number; price_override: number | null; product_id: string; size_entry_id: string | null; size_label: string | null; sku: string | null; sort_order: number; stock_quantity: number; track_inventory: boolean; updated_at: string; updated_by: string | null; }
        Insert: { allow_backorder?: boolean; color_id?: string | null; created_at?: string; created_by?: string | null; customization_type: Database["public"]["Enums"]["customization_type"]; deleted_at?: string | null; id?: string; is_available?: boolean; low_stock_threshold?: number; price_override?: number | null; product_id: string; size_entry_id?: string | null; size_label?: string | null; sku?: string | null; sort_order?: number; stock_quantity?: number; track_inventory?: boolean; updated_at?: string; updated_by?: string | null; }
        Update: { allow_backorder?: boolean; color_id?: string | null; created_at?: string; created_by?: string | null; customization_type?: Database["public"]["Enums"]["customization_type"]; deleted_at?: string | null; id?: string; is_available?: boolean; low_stock_threshold?: number; price_override?: number | null; product_id?: string; size_entry_id?: string | null; size_label?: string | null; sku?: string | null; sort_order?: number; stock_quantity?: number; track_inventory?: boolean; updated_at?: string; updated_by?: string | null; }
        Relationships: [
          {
            foreignKeyName: "product_variants_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "product_colors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "v_product_colors_storefront"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products_storefront"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_size_entry_id_fkey"
            columns: ["size_entry_id"]
            isOneToOne: false
            referencedRelation: "size_system_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: { category_id: string | null; created_at: string; deleted_at: string | null; description: string | null; has_variants: boolean; id: string; image_url: string | null; is_featured: boolean; is_new_arrival: boolean; name: string; price: number; price_unstitched: number | null; price_stitched: number | null; product_code: string; short_description: string | null; size_system_id: string | null; slug: string | null; status: Database["public"]["Enums"]["product_status"]; supported_customization_types: Database["public"]["Enums"]["customization_type"][]; updated_at: string; work_types: string[]; }
        Insert: { category_id?: string | null; created_at?: string; deleted_at?: string | null; description?: string | null; has_variants?: boolean; id?: string; image_url?: string | null; is_featured?: boolean; is_new_arrival?: boolean; name: string; price: number; price_unstitched?: number | null; price_stitched?: number | null; product_code: string; short_description?: string | null; size_system_id?: string | null; slug?: string | null; status?: Database["public"]["Enums"]["product_status"]; supported_customization_types?: Database["public"]["Enums"]["customization_type"][]; updated_at?: string; work_types?: string[]; }
        Update: { category_id?: string | null; created_at?: string; deleted_at?: string | null; description?: string | null; has_variants?: boolean; id?: string; image_url?: string | null; is_featured?: boolean; is_new_arrival?: boolean; name?: string; price?: number; price_unstitched?: number | null; price_stitched?: number | null; product_code?: string; short_description?: string | null; size_system_id?: string | null; slug?: string | null; status?: Database["public"]["Enums"]["product_status"]; supported_customization_types?: Database["public"]["Enums"]["customization_type"][]; updated_at?: string; work_types?: string[]; }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_size_system_id_fkey"
            columns: ["size_system_id"]
            isOneToOne: false
            referencedRelation: "size_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: { created_at: string; full_name: string | null; id: string; role: Database["public"]["Enums"]["admin_role"]; }
        Insert: { created_at?: string; full_name?: string | null; id: string; role?: Database["public"]["Enums"]["admin_role"]; }
        Update: { created_at?: string; full_name?: string | null; id?: string; role?: Database["public"]["Enums"]["admin_role"]; }
        Relationships: []
      }
      settings: {
        Row: { description: string | null; key: string; updated_at: string; updated_by: string | null; value: Json; }
        Insert: { description?: string | null; key: string; updated_at?: string; updated_by?: string | null; value: Json; }
        Update: { description?: string | null; key?: string; updated_at?: string; updated_by?: string | null; value?: Json; }
        Relationships: []
      }
      size_system_entries: {
        Row: { bust_cm: number | null; created_at: string; deleted_at: string | null; hip_cm: number | null; id: string; label: string; sort_order: number; system_id: string; waist_cm: number | null; }
        Insert: { bust_cm?: number | null; created_at?: string; deleted_at?: string | null; hip_cm?: number | null; id?: string; label: string; sort_order?: number; system_id: string; waist_cm?: number | null; }
        Update: { bust_cm?: number | null; created_at?: string; deleted_at?: string | null; hip_cm?: number | null; id?: string; label?: string; sort_order?: number; system_id?: string; waist_cm?: number | null; }
        Relationships: [
          {
            foreignKeyName: "size_system_entries_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "size_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      size_systems: {
        Row: { created_at: string; created_by: string | null; deleted_at: string | null; description: string | null; id: string; name: string; }
        Insert: { created_at?: string; created_by?: string | null; deleted_at?: string | null; description?: string | null; id?: string; name: string; }
        Update: { created_at?: string; created_by?: string | null; deleted_at?: string | null; description?: string | null; id?: string; name?: string; }
        Relationships: []
      }
    }
    Views: {
      notification_health: {
        Row: { avg_attempts: number | null; count: number | null; newest: string | null; oldest: string | null; status: Database["public"]["Enums"]["notification_job_status"] | null; }
        Relationships: []
      }
      v_product_colors_storefront: {
        Row: { created_at: string | null; deleted_at: string | null; hex_code: string | null; id: string | null; label: string | null; primary_image_url: string | null; product_id: string | null; sort_order: number | null; swatch_image_url: string | null; }
        Insert: { created_at?: string | null; deleted_at?: string | null; hex_code?: string | null; id?: string | null; label?: string | null; primary_image_url?: never; product_id?: string | null; sort_order?: number | null; swatch_image_url?: string | null; }
        Update: { created_at?: string | null; deleted_at?: string | null; hex_code?: string | null; id?: string | null; label?: string | null; primary_image_url?: never; product_id?: string | null; sort_order?: number | null; swatch_image_url?: string | null; }
        Relationships: [
          {
            foreignKeyName: "product_colors_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_colors_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products_storefront"
            referencedColumns: ["id"]
          },
        ]
      }
      v_products_storefront: {
        Row: { category_id: string | null; created_at: string | null; deleted_at: string | null; description: string | null; effective_min_price: number | null; has_variants: boolean | null; id: string | null; image_url: string | null; name: string | null; price: number | null; primary_image_url: string | null; product_code: string | null; short_description: string | null; size_system_id: string | null; slug: string | null; status: Database["public"]["Enums"]["product_status"] | null; supported_customization_types: | Database["public"]["Enums"]["customization_type"][] | null; updated_at: string | null; work_types: string[] | null; }
        Insert: { category_id?: string | null; created_at?: string | null; deleted_at?: string | null; description?: string | null; effective_min_price?: never; has_variants?: boolean | null; id?: string | null; image_url?: string | null; name?: string | null; price?: number | null; primary_image_url?: never; product_code?: string | null; short_description?: string | null; size_system_id?: string | null; slug?: string | null; status?: Database["public"]["Enums"]["product_status"] | null; supported_customization_types?: | Database["public"]["Enums"]["customization_type"][] | null; updated_at?: string | null; work_types?: string[] | null; }
        Update: { category_id?: string | null; created_at?: string | null; deleted_at?: string | null; description?: string | null; effective_min_price?: never; has_variants?: boolean | null; id?: string | null; image_url?: string | null; name?: string | null; price?: number | null; primary_image_url?: never; product_code?: string | null; short_description?: string | null; size_system_id?: string | null; slug?: string | null; status?: Database["public"]["Enums"]["product_status"] | null; supported_customization_types?: | Database["public"]["Enums"]["customization_type"][] | null; updated_at?: string | null; work_types?: string[] | null; }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_size_system_id_fkey"
            columns: ["size_system_id"]
            isOneToOne: false
            referencedRelation: "size_systems"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      claim_notification_jobs: {
        Args: { p_batch_size?: number }
        Returns: {
          attempts: number
          created_at: string
          id: string
          idempotency_key: string
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          payload: Json
          priority: number
          provider_message_id: string | null
          recipient_email: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_job_status"]
          type: Database["public"]["Enums"]["notification_type"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notification_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_notification_job: {
        Args: { p_job_id: string; p_provider_message_id: string }
        Returns: undefined
      }
      create_order_txn: {
        Args: {
          p_customer: Json
          p_items: Json
          p_payment_id: string
          p_payment_metadata?: Json
          p_payment_provider?: string
          p_shipping_address: Json
        }
        Returns: Json
      }
      enqueue_notification: {
        Args: {
          p_idempotency_key: string
          p_payload: Json
          p_priority?: number
          p_recipient_email: string
          p_type: Database["public"]["Enums"]["notification_type"]
        }
        Returns: Json
      }
      fail_notification_job: {
        Args: { p_error: string; p_job_id: string }
        Returns: undefined
      }
      generate_variant_sku: {
        Args: {
          p_color: string
          p_product_code: string
          p_size: string
          p_type: Database["public"]["Enums"]["customization_type"]
        }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      reset_dead_notification_jobs: {
        Args: { p_job_ids: string[] }
        Returns: number
      }
    }
    Enums: {
      admin_role: "super_admin" | "admin"
      rule_field: "name" | "work_types" | "price"
      rule_operator: "contains" | "is" | "greater_than" | "less_than"
      category_match_type: "ALL" | "ANY"
      product_category_source: "manual" | "rule"
      customization_type:
        | "UNSTITCHED"
        | "SEMI_STITCHED"
        | "STANDARD_SIZE"
        | "CUSTOM_TAILORED"
      enquiry_status: "NEW" | "REPLIED" | "CLOSED"
      measurement_field_key:
        | "bust"
        | "upper_bust"
        | "under_bust"
        | "waist"
        | "hip"
        | "shoulder"
        | "blouse_length"
        | "sleeve_length"
        | "lehenga_length"
        | "bottom_length"
        | "dupatta_length"
        | "torso_length"
        | "back_length"
        | "front_length"
        | "height"
        | "armhole"
        | "neck_depth_front"
        | "neck_depth_back"
        | "neck_circumference"
        | "bicep"
        | "wrist"
        | "elbow"
        | "inseam"
        | "thigh"
        | "knee"
        | "calf"
        | "ankle"
        | "custom"
      media_type: "IMAGE" | "VIDEO"
      notification_job_status:
        | "PENDING"
        | "PROCESSING"
        | "SENT"
        | "RETRYING"
        | "DEAD"
        | "CANCELLED"
      notification_type:
        | "ORDER_CONFIRMATION_CUSTOMER"
        | "ORDER_CONFIRMATION_ADMIN"
        | "ORDER_STATUS_UPDATE_CUSTOMER"
        | "ENQUIRY_RECEIPT_CUSTOMER"
        | "ENQUIRY_ADMIN_NOTIFICATION"
      order_status:
        | "PENDING"
        | "CONFIRMED"
        | "PROCESSING"
        | "SHIPPED"
        | "DELIVERED"
        | "CANCELLED"
      product_status: "PUBLISHED" | "DRAFT"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      admin_role: ["super_admin", "admin"],
      customization_type: [
        "UNSTITCHED",
        "SEMI_STITCHED",
        "STANDARD_SIZE",
        "CUSTOM_TAILORED",
      ],
      enquiry_status: ["NEW", "REPLIED", "CLOSED"],
      measurement_field_key: [
        "bust",
        "upper_bust",
        "under_bust",
        "waist",
        "hip",
        "shoulder",
        "blouse_length",
        "sleeve_length",
        "lehenga_length",
        "bottom_length",
        "dupatta_length",
        "torso_length",
        "back_length",
        "front_length",
        "height",
        "armhole",
        "neck_depth_front",
        "neck_depth_back",
        "neck_circumference",
        "bicep",
        "wrist",
        "elbow",
        "inseam",
        "thigh",
        "knee",
        "calf",
        "ankle",
      ],
      media_type: ["IMAGE", "VIDEO"],
      notification_job_status: [
        "PENDING",
        "PROCESSING",
        "SENT",
        "RETRYING",
        "DEAD",
        "CANCELLED",
      ],
      notification_type: [
        "ORDER_CONFIRMATION_CUSTOMER",
        "ORDER_CONFIRMATION_ADMIN",
        "ORDER_STATUS_UPDATE_CUSTOMER",
        "ENQUIRY_RECEIPT_CUSTOMER",
        "ENQUIRY_ADMIN_NOTIFICATION",
      ],
      order_status: [
        "PENDING",
        "CONFIRMED",
        "PROCESSING",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
      ],
      product_status: ["PUBLISHED", "DRAFT"],
    },
  },
} as const

