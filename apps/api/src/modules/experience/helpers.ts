import { ConflictException } from "@nestjs/common";
import { moveStock, type Stock } from "@paymoon/validation";
import type { PoolClient } from "@paymoon/db";
export async function stock(
  c: PoolClient,
  variant: string,
  kind: "reserve" | "release" | "commit" | "ship",
  quantity: number,
  actor: string,
) {
  const row = (
    await c.query(
      "SELECT * FROM commerce.inventory WHERE variant_id=$1 FOR UPDATE",
      [variant],
    )
  ).rows[0] as Stock | undefined;
  if (!row) throw new ConflictException("Inventory unavailable");
  let next: Stock;
  try {
    next = moveStock(row, kind, quantity);
  } catch {
    throw new ConflictException("Insufficient stock");
  }
  await c.query(
    "UPDATE commerce.inventory SET available=$2,reserved=$3,committed=$4 WHERE variant_id=$1",
    [variant, next.available, next.reserved, next.committed],
  );
  await c.query(
    "INSERT INTO commerce.stock_movements(variant_id,kind,quantity,actor_id) VALUES($1,$2,$3,$4)",
    [variant, kind, quantity, actor],
  );
}
export async function orderItems(c: PoolClient, id: string) {
  return (
    await c.query(
      "SELECT * FROM commerce.order_items WHERE order_id=$1 ORDER BY variant_id",
      [id],
    )
  ).rows;
}
export async function notify(
  c: PoolClient,
  user: string,
  id: string,
  kind: string,
) {
  await c.query(
    "INSERT INTO commerce.user_notifications(user_id,order_id,kind) VALUES($1,$2,$3)",
    [user, id, kind],
  );
}
