export type Customer = {
  buyer_id: string;
  email: string;
  orders: number;
  paid_orders: number;
  lifetime_minor: string;
  last_purchase: string | null;
  note: string | null;
  segment: string;
};
export type Coupon = {
  id: string;
  code: string;
  kind: "percent" | "fixed";
  value: string;
  minimum_minor: string;
  usage_limit: number;
  per_customer_limit: number;
  ends_at: string;
  active: boolean;
  used: number;
};
export type Campaign = {
  id: string;
  title: string;
  body: string;
  segment: string;
  recipient_count: number;
  created_at: string;
};
export type ReturnRequest = {
  id: string;
  order_id: string;
  reason: string;
  status: string;
  seller_reply: string;
  created_at: string;
};
export type StockAlert = {
  variant_id: string;
  title: string;
  sku: string;
  available: number;
  low_stock_threshold: number;
};
export type SalesReport = {
  days: number;
  summary: {
    orders: number;
    paid_orders: number;
    revenue_minor: string;
    discount_minor: string;
    customers: number;
  };
  daily: { day: string; orders: number; revenue_minor: string }[];
  top: {
    variant_id: string;
    title: string;
    quantity: number;
    gross_minor: string;
  }[];
  statuses: { status: string; count: number }[];
};

export type ProductAlert = {
  id: string;
  product_id: string;
  title: string;
  kind: "price" | "restock";
  target_minor: string | null;
  active: boolean;
  notified_at: string | null;
};
