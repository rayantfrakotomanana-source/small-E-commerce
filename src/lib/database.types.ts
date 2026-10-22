export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      blocked_phones: Table<
        { phone: string; reason: string; created_at: string },
        { phone: string; reason: string; created_at?: string }
      >;
      cash_closings: Table<
        {
          id: string;
          day: string;
          livreur_id: string;
          expected_ar: number;
          received_ar: number;
          difference_ar: number;
          note: string | null;
          created_by: string | null;
        },
        {
          id?: string;
          day: string;
          livreur_id: string;
          expected_ar: number;
          received_ar: number;
          note?: string | null;
          created_by?: string | null;
        }
      >;
      categories: Table<
        { id: string; slug: string; name_fr: string; name_mg: string; kind: Database['public']['Enums']['category_kind']; sort: number },
        { id?: string; slug: string; name_fr: string; name_mg: string; kind: Database['public']['Enums']['category_kind']; sort?: number }
      >;
      order_events: Table<
        { id: string; order_id: string; actor_id: string | null; event: string; from_value: string | null; to_value: string | null; note: string | null; created_at: string },
        { id?: string; order_id: string; actor_id?: string | null; event: string; from_value?: string | null; to_value?: string | null; note?: string | null; created_at?: string }
      >;
      order_items: Table<
        { id: string; order_id: string; product_id: string; name_snapshot: string; unit_price: number; qty: number; image_snapshot: string | null },
        { id?: string; order_id: string; product_id: string; name_snapshot: string; unit_price: number; qty: number; image_snapshot?: string | null }
      >;
      order_number_years: Table<
        { year: number; last_number: number },
        { year: number; last_number: number }
      >;
      orders: Table<
        {
          id: string;
          order_number: string;
          public_token: string;
          source: Database['public']['Enums']['order_source'];
          customer_name: string;
          phone: string;
          phone2: string | null;
          address: string;
          landmark: string | null;
          note: string | null;
          is_province: boolean;
          city: string | null;
          transport_info: string | null;
          transport_url: string | null;
          items_total: number;
          delivery_fee: number;
          total: number;
          status: Database['public']['Enums']['order_status'];
          payment_status: Database['public']['Enums']['payment_status'];
          payment_mode: Database['public']['Enums']['payment_mode'];
          payer_name: string | null;
          payer_phone: string | null;
          payment_ref: string | null;
          livreur_id: string | null;
          cash_collected_ar: number | null;
          cash_handed_over: boolean;
          cancel_reason: string | null;
          is_spam: boolean;
          ip_hash: string | null;
          created_by: string | null;
          created_at: string;
          confirmed_at: string | null;
          paid_at: string | null;
          delivered_at: string | null;
        },
        {
          id?: string;
          order_number: string;
          public_token: string;
          source?: Database['public']['Enums']['order_source'];
          customer_name: string;
          phone: string;
          phone2?: string | null;
          address: string;
          landmark?: string | null;
          note?: string | null;
          is_province?: boolean;
          city?: string | null;
          transport_info?: string | null;
          transport_url?: string | null;
          items_total: number;
          delivery_fee: number;
          status?: Database['public']['Enums']['order_status'];
          payment_status?: Database['public']['Enums']['payment_status'];
          payment_mode: Database['public']['Enums']['payment_mode'];
          payer_name?: string | null;
          payer_phone?: string | null;
          payment_ref?: string | null;
          livreur_id?: string | null;
          cash_collected_ar?: number | null;
          cash_handed_over?: boolean;
          cancel_reason?: string | null;
          is_spam?: boolean;
          ip_hash?: string | null;
          created_by?: string | null;
          created_at?: string;
          confirmed_at?: string | null;
          paid_at?: string | null;
          delivered_at?: string | null;
        }
      >;
      products: Table<
        { id: string; category_id: string; name_fr: string; name_mg: string; desc_fr: string; desc_mg: string; price_ar: number; stock: number; reserved: number; images: string[]; warranty_months: number; is_sold_out: boolean; is_active: boolean; deleted_at: string | null; created_at: string },
        { id?: string; category_id: string; name_fr: string; name_mg: string; desc_fr?: string; desc_mg?: string; price_ar: number; stock?: number; reserved?: number; images?: string[]; warranty_months?: number; is_sold_out?: boolean; is_active?: boolean; deleted_at?: string | null; created_at?: string }
      >;
      profiles: Table<
        { id: string; full_name: string; phone: string | null; role: Database['public']['Enums']['user_role']; active: boolean },
        { id: string; full_name: string; phone?: string | null; role?: Database['public']['Enums']['user_role']; active?: boolean }
      >;
      settings: Table<
        { key: string; value: Json },
        { key: string; value: Json }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      admin_mark_delivered: { Args: { note?: string; target_order_id: string }; Returns: undefined };
      assign_livreur: { Args: { target_livreur_id: string; target_order_id: string }; Returns: undefined };
      cancel_order: { Args: { reason: string; target_order_id: string }; Returns: undefined };
      close_livreur_cash: { Args: { closing_day: string; closing_note?: string; received: number; target_livreur_id: string }; Returns: string };
      confirm_order: { Args: { target_order_id: string }; Returns: undefined };
      create_order: { Args: { payload: Json }; Returns: string };
      create_manual_order: { Args: { payload: Json }; Returns: string };
      expire_unconfirmed_orders: { Args: Record<PropertyKey, never>; Returns: number };
      livreur_set_outcome: { Args: { cash_collected?: number; outcome: string; reason?: string; target_order_id: string }; Returns: undefined };
      mark_paid: { Args: { ref?: string; target_order_id: string }; Returns: undefined };
      next_order_number: { Args: Record<PropertyKey, never>; Returns: string };
      reject_spam: { Args: { target_order_id: string }; Returns: undefined };
      set_order_transport: { Args: { info: string; location_url: string | null; target_order_id: string }; Returns: undefined };
    };
    Enums: {
      category_kind: 'tech' | 'divers';
      order_source: 'app' | 'facebook' | 'whatsapp' | 'appel';
      order_status: 'a_confirmer' | 'en_cours' | 'livree' | 'annulee';
      payment_mode: 'cash' | 'mvola' | 'orange';
      payment_status: 'non_paye' | 'paye';
      user_role: 'superadmin' | 'admin' | 'livreur';
    };
    CompositeTypes: Record<string, never>;
  };
};