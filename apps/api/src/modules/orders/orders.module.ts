import { Module } from "@nestjs/common";
import { assertOrderTransition, type OrderState } from "@paymoon/validation";
import type { PoolClient } from "@paymoon/db";
import { emit } from "@paymoon/events";
// Internal domain operation only; payment status may only advance after verified provider callbacks.
export async function transitionOrder(
  c: PoolClient,
  organizationId: string,
  id: string,
  to: OrderState,
  version: number,
) {
  const order = (
    await c.query(
      "SELECT status,version FROM commerce.orders WHERE id=$1 AND organization_id=$2 FOR UPDATE",
      [id, organizationId],
    )
  ).rows[0];
  if (!order || order.version !== version)
    throw new Error("Order version conflict");
  assertOrderTransition(order.status, to);
  await c.query(
    "UPDATE commerce.orders SET status=$2,version=version+1 WHERE id=$1",
    [id, to],
  );
  await emit(c, "order.transitioned", {
    organizationId,
    orderId: id,
    status: to,
  });
}
@Module({})
export class OrdersModule {}
