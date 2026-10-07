import { ConflictException } from "@nestjs/common";
import type { PoolClient } from "@paymoon/db";
export async function redeemCoupon(
  c: PoolClient,
  org: string,
  buyer: string,
  code: string | undefined,
  subtotal: bigint,
) {
  if (!code) return { discount: 0n, coupon: undefined };
  const coupon = (
    await c.query(
      "SELECT * FROM commerce.coupons WHERE organization_id=$1 AND code=$2 FOR UPDATE",
      [org, code],
    )
  ).rows[0];
  if (
    !coupon ||
    !coupon.active ||
    new Date(coupon.starts_at).getTime() > Date.now() ||
    new Date(coupon.ends_at).getTime() <= Date.now() ||
    subtotal < BigInt(coupon.minimum_minor)
  )
    throw new ConflictException("Coupon unavailable or minimum not met");
  const usage = (
    await c.query(
      `SELECT count(*)::integer AS total,count(*) FILTER(WHERE r.buyer_id=$2)::integer AS own FROM commerce.coupon_redemptions r JOIN commerce.orders o ON o.id=r.order_id WHERE r.coupon_id=$1 AND (o.status IN('paid','fulfilling','shipped','completed','refunded') OR (o.status='pending_payment' AND o.expires_at>now()))`,
      [coupon.id, buyer],
    )
  ).rows[0];
  if (
    usage.total >= coupon.usage_limit ||
    usage.own >= coupon.per_customer_limit
  )
    throw new ConflictException("Coupon limit reached");
  let discount =
    coupon.kind === "percent"
      ? (subtotal * BigInt(coupon.value)) / 100n
      : BigInt(coupon.value);
  if (
    coupon.maximum_discount_minor &&
    discount > BigInt(coupon.maximum_discount_minor)
  )
    discount = BigInt(coupon.maximum_discount_minor);
  // Keep a positive order amount; zero-value checkout has a different payment lifecycle.
  if (discount >= subtotal) discount = subtotal - 1n;
  if (discount <= 0n) throw new ConflictException("Coupon cannot apply");
  return { discount, coupon };
}
