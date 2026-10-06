import { Module } from "@nestjs/common";
import type { Money } from "@paymoon/money";
export interface PaymentProvider {
  readonly name: string;
  initiate(input: {
    orderId: string;
    amount: Money;
    idempotencyKey: string;
    returnUrl: string;
  }): Promise<{ reference: string; redirectUrl: string }>;
  verify(reference: string): Promise<{
    status: "pending" | "succeeded" | "failed";
    amount: Money;
    reference: string;
  }>;
  refund(input: {
    reference: string;
    amount: Money;
    idempotencyKey: string;
  }): Promise<{ reference: string }>;
}
// Intentionally no live or auto-success implementation. Inject a verified provider in the checkout phase.
export const PAYMENT_PROVIDER = Symbol("PAYMENT_PROVIDER");
@Module({})
export class PaymentsModule {}
