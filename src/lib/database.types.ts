export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Table<
  Row extends Record<string, unknown>,
  Insert extends Record<string, unknown>,
  Update extends Record<string, unknown> = Partial<Insert>,
> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type Rpc<Args extends Record<string, unknown>, Returns> = {
  Args: Args;
  Returns: Returns;
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
      bms_categories: Table<
        { id: string; name: string; sort_order: number; archived_at: string | null; created_at: string },
        { id?: string; name: string; sort_order?: number; archived_at?: string | null; created_at?: string }
      >;
      bms_products: Table<
        { id: string; category_id: string | null; name: string; sku: string | null; description: string; purchase_price: number; selling_price: number; stock_quantity: number; minimum_stock: number; image_url: string | null; archived_at: string | null; created_at: string; updated_at: string },
        { id?: string; category_id?: string | null; name: string; sku?: string | null; description?: string; purchase_price?: number; selling_price?: number; stock_quantity?: number; minimum_stock?: number; image_url?: string | null; archived_at?: string | null; created_at?: string; updated_at?: string }
      >;
      bms_customers: Table<
        { id: string; name: string; phone: string | null; address: string | null; notes: string | null; created_at: string; updated_at: string },
        { id?: string; name: string; phone?: string | null; address?: string | null; notes?: string | null; created_at?: string; updated_at?: string }
      >;
      bms_sales: Table<
        { id: string; sale_number: string; customer_id: string | null; subtotal: number; discount: number; total: number; payment_status: 'paid' | 'partial' | 'unpaid' | 'cancelled'; status: 'completed' | 'cancelled' | 'returned'; note: string | null; sold_at: string; created_by: string | null; cancelled_at: string | null; cancellation_reason: string | null; created_at: string },
        { id?: string; sale_number: string; customer_id?: string | null; subtotal: number; discount?: number; total: number; payment_status?: 'paid' | 'partial' | 'unpaid' | 'cancelled'; status?: 'completed' | 'cancelled' | 'returned'; note?: string | null; sold_at?: string; created_by?: string | null; cancelled_at?: string | null; cancellation_reason?: string | null; created_at?: string }
      >;
      bms_sale_items: Table<
        { id: string; sale_id: string; product_id: string | null; product_name: string; purchase_price: number; unit_price: number; quantity: number; line_total: number },
        { id?: string; sale_id: string; product_id?: string | null; product_name: string; purchase_price: number; unit_price: number; quantity: number; line_total: number }
      >;
      bms_payments: Table<
        { id: string; sale_id: string | null; amount: number; method: 'cash' | 'mobile_money' | 'bank_transfer' | 'other'; reference: string | null; paid_at: string; created_at: string },
        { id?: string; sale_id?: string | null; amount: number; method: 'cash' | 'mobile_money' | 'bank_transfer' | 'other'; reference?: string | null; paid_at?: string; created_at?: string }
      >;
      bms_expense_categories: Table<
        { id: string; name: string; archived_at: string | null; created_at: string },
        { id?: string; name: string; archived_at?: string | null; created_at?: string }
      >;
      bms_expenses: Table<
        { id: string; category_id: string | null; description: string; amount: number; method: 'cash' | 'mobile_money' | 'bank_transfer' | 'other'; expense_date: string; created_by: string | null; created_at: string },
        { id?: string; category_id?: string | null; description: string; amount: number; method: 'cash' | 'mobile_money' | 'bank_transfer' | 'other'; expense_date: string; created_by?: string | null; created_at?: string }
      >;
      bms_stock_movements: Table<
        { id: string; product_id: string; movement_type: 'purchase' | 'sale' | 'return' | 'adjustment' | 'sale_cancellation'; quantity_change: number; quantity_before: number; quantity_after: number; reference_type: string | null; reference_id: string | null; note: string | null; created_by: string | null; created_at: string },
        { id?: string; product_id: string; movement_type: 'purchase' | 'sale' | 'return' | 'adjustment' | 'sale_cancellation'; quantity_change: number; quantity_before: number; quantity_after: number; reference_type?: string | null; reference_id?: string | null; note?: string | null; created_by?: string | null; created_at?: string }
      >;
      bms_cash_transactions: Table<
        { id: string; transaction_type: 'opening_balance' | 'sale_payment' | 'expense' | 'adjustment' | 'closing_count'; amount: number; description: string | null; transaction_date: string; created_by: string | null; created_at: string },
        { id?: string; transaction_type: 'opening_balance' | 'sale_payment' | 'expense' | 'adjustment' | 'closing_count'; amount: number; description?: string | null; transaction_date: string; created_by?: string | null; created_at?: string }
      >;
      bms_cash_snapshots: Table<
        { id: string; snapshot_date: string; opening_balance: number; expected_closing: number; physically_counted: number | null; discrepancy: number | null; note: string | null; created_by: string | null; created_at: string },
        { id?: string; snapshot_date: string; opening_balance: number; expected_closing: number; physically_counted?: number | null; discrepancy?: number | null; note?: string | null; created_by?: string | null; created_at?: string }
      >;
      bms_settings: Table<
        { key: string; value: Json; updated_at: string },
        { key: string; value: Json; updated_at?: string }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      admin_mark_delivered: Rpc<{ note?: string; target_order_id: string }, undefined>;
      assign_livreur: Rpc<{ target_livreur_id: string; target_order_id: string }, undefined>;
      cancel_order: Rpc<{ reason: string; target_order_id: string }, undefined>;
      close_livreur_cash: Rpc<{ closing_day: string; closing_note?: string; received: number; target_livreur_id: string }, string>;
      confirm_order: Rpc<{ target_order_id: string }, undefined>;
      create_order: Rpc<{ payload: Json }, string>;
      create_manual_order: Rpc<{ payload: Json }, string>;
      expire_unconfirmed_orders: Rpc<Record<PropertyKey, never>, number>;
      livreur_set_outcome: Rpc<{ cash_collected?: number | null; outcome: string; reason?: string | null; target_order_id: string }, undefined>;
      mark_paid: Rpc<{ ref?: string | null; target_order_id: string }, undefined>;
      next_order_number: Rpc<Record<PropertyKey, never>, string>;
      reject_spam: Rpc<{ target_order_id: string }, undefined>;
      set_order_transport: Rpc<{ info: string; location_url: string | null; target_order_id: string }, undefined>;
      bms_adjust_stock: Rpc<{ p_product_id: string; p_quantity_change: number; p_note: string }, undefined>;
      bms_cancel_sale: Rpc<{ p_sale_id: string; p_reason: string }, undefined>;
      bms_create_sale: Rpc<{ p_customer_id: string | null; p_discount: number; p_items: Json; p_payments: Json; p_note?: string | null; p_sold_at: string }, string>;
      bms_record_expense: Rpc<{ p_category_id: string | null; p_description: string; p_amount: number; p_method: string; p_expense_date: string }, string>;
      bms_record_purchase: Rpc<{ p_product_id: string; p_quantity: number; p_unit_cost: number; p_note: string }, string>;
      bms_record_payment: Rpc<{ p_sale_id: string; p_amount: number; p_method: string; p_reference?: string | null }, string>;
      bms_return_sale: Rpc<{ p_sale_id: string; p_reason: string }, undefined>;
      bms_upsert_category: Rpc<{ p_id: string | null; p_name: string }, string>;
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