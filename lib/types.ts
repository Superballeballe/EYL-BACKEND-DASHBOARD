// Database row shapes (what Supabase returns). Loose but practical.

export type Knight = {
  id: string;
  full_name: string;
  display_name: string;
  role: "walker" | "biker" | null;
  joining_date: string | null;
  default_location: string | null;
  active: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type EylKnight = {
  id: string;
  user_id: string;
  profile_id: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  documents: Record<string, string>;
  work_areas: string[];
  knight_role: "walker" | "biker" | null;
  status: "pending" | "documents" | "submitted" | "approved" | "rejected";
  submitted_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  review_note: string | null;
  knight_id: string | null;
  created_at: string;
  updated_at: string;
};

export type KnightSalary = {
  id: string;
  knight_id: string;
  month: string;
  travel: number | null;
  salary: number | null;
  total: number | null;
  created_at: string;
  updated_at: string;
};

export type WorkDay = {
  work_date: string;
  is_sunday: boolean;
  note: string | null;
  walker_count: number | null;
  biker_count: number | null;
  src_sheet: string | null;
  created_at: string;
  updated_at: string;
};

export type DailyAssignment = {
  id: string;
  work_date: string;
  knight_id: string | null;
  knight_name: string | null;
  role: "walker" | "biker" | null;
  location: string | null;
  shift_time: string | null;
  status: "working" | "leave" | "half_day";
  note: string | null;
  position: number | null;
  created_at: string;
  updated_at: string;
};

export type Client = {
  id: string;
  client_name: string;
  company_name: string | null;
  address: string | null;
  gst_no: string | null;
  phone: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type RateTier = {
  id: string;
  provider: string;
  label: string | null;
  min_km: number | null;
  max_km: number | null;
  fee: number | null;
  fee_ex_gst: number | null;
  gst_amount: number | null;
  effective_from: string | null;
  is_current: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type MonthlyCoupon = {
  id: string;
  year_month: string;
  code: string;
  type: "percent" | "flat";
  value: number;
  label: string;
  active: boolean;
  redemption_count: number;
  created_at: string;
  updated_at: string;
};

export type CouponRedemption = {
  id: string;
  coupon_id: string;
  user_id: string;
  order_id: string;
  code: string;
  redeemed_at: string;
  orders?: { order_code: string | null } | null;
  monthly_coupons?: { code: string; label: string } | null;
};

export type AppInvoice = {
  id: string;
  order_id: string;
  invoice_number: string;
  invoice_type: string | null;
  payment_method: string | null;
  payment_status: string | null;
  subtotal: number | null;
  discount_amount: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  is_gst: boolean | null;
  seller_gstin: string | null;
  buyer_gstin: string | null;
  taxable_value: number | null;
  cgst_amount: number | null;
  sgst_amount: number | null;
  igst_amount: number | null;
  is_interstate: boolean | null;
  issued_at: string;
  metadata: {
    coupon?: { code?: string; label?: string; discount?: number } | null;
    payment_label?: string | null;
  } | null;
  orders?: { order_code: string | null } | null;
};

export type Delivery = {
  id: string;
  app_order_id: string | null;
  serial_no: number | null;
  booking_date: string | null;
  task_date: string | null;
  mode_of_booking: "b2b" | "online" | null;
  sender_name: string | null;
  sender_last_name: string | null;
  pickup_location: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  pickup_time_window: string | null;
  pickup_actual_time: string | null;
  drop_location: string | null;
  drop_lat: number | null;
  drop_lng: number | null;
  drop_recipient_name: string | null;
  recipient_phone: string | null;
  drop_time_window: string | null;
  drop_actual_time: string | null;
  knight_id: string | null;
  knight_name: string | null;
  assignment_status: "assigned" | "cancelled";
  fulfillment_status: "booked" | "accepted" | "active" | "completed" | "cancelled";
  fees: number | null;
  kms: number | null;
  working_hours: string | null;
  cod_remark: string | null;
  cab_auto_fare: string | null;
  payment_status: "paid" | "unpaid" | "free" | "partial" | null;
  final_bill_amount: number | null;
  payment_mode: string | null;
  payment_received_date: string | null;
  billing_name: string | null;
  billing_address: string | null;
  gst_no: string | null;
  invoice_no: string | null;
  invoice_date: string | null;
  client_id: string | null;
  content: string | null;
  remark: string | null;
  src_sheet: string | null;
  src_row: number | null;
  needs_review: boolean;
  raw: unknown;
  app_order?: {
    id: string;
    order_code: string | null;
    status: "registered" | "accepted" | "rider_assigned" | "picked_up" | "delivered" | "cancelled" | string | null;
    rider_name?: string | null;
    scheduled_for?: string | null;
    pickup_scheduled_at?: string | null;
    delivery_scheduled_at?: string | null;
    accepted_at?: string | null;
    rider_assigned_at?: string | null;
  } | null;
  created_at: string;
  updated_at: string;
};

/**
 * An app order that was confirmed/assigned, then reverted to "draft" by the
 * app's own payment-expiry sweep because the customer never paid in time.
 * Has no linked `deliveries` row — the sweep detaches it — so it's read from
 * `orders` directly, not the deliveries table.
 */
export type DraftOrder = {
  id: string;
  order_code: string | null;
  pickup_address: string | null;
  delivery_address: string | null;
  recipient_name: string | null;
  total_price: number | null;
  expires_at: string | null;
  draft_reverted_at: string | null;
};
