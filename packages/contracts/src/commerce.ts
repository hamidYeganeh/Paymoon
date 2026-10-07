export type User = { id: string; email: string };
export type Org = { id: string; name: string; slug: string; role: string };
export type Variant = {
  id: string;
  sku: string;
  price_minor: string;
  attributes: Record<string, string>;
  available: number;
  reserved?: number;
  committed?: number;
};
export type Product = {
  id: string;
  organization_id: string;
  title: string;
  description: string;
  media: string[];
  variants: Variant[];
  status: string;
  version: number;
  price_minor: string;
  available: number;
  display_name: string;
  merchant_slug: string;
  category_id: string | null;
  source_media_id?: string;
};
export type Merchant = {
  id: string;
  organization_id: string;
  display_name: string;
  instagram_handle: string;
  bio: string;
  status: string;
  shipping_fee_minor: string;
  shipping_days: number;
  return_policy: string;
  slug: string;
  product_count: string;
  avatar_url?: string;
  followers_count?: string;
};
export type Address = {
  id: string;
  label: string;
  recipient: string;
  phone: string;
  province: string;
  city: string;
  postal_code: string;
  address: string;
};
export type Order = {
  id: string;
  status: string;
  amount_minor: string;
  created_at: string;
  expires_at: string;
  paymentMode: string;
  shipping_address: Address;
  tracking_code: string;
  carrier: string;
  items: {
    id: string;
    title: string;
    sku: string;
    quantity: number;
    unit_price_minor: string;
  }[];
};
export type Ticket = {
  id: string;
  subject: string;
  body: string;
  reply: string;
  status: string;
  created_at: string;
};
export type Notice = {
  id: string;
  kind: string;
  order_id: string;
  read_at: string;
  created_at: string;
};
export type CartItem = {
  variantId: string;
  productId: string;
  organizationId: string;
  title: string;
  sku: string;
  priceMinor: string;
  image: string;
  quantity: number;
};
