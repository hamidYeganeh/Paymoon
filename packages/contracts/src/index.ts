export type { OrderState, Stock } from "@paymoon/validation";
export type { Money, Currency, LedgerLine } from "@paymoon/money";
export type { Role, Permission } from "@paymoon/auth";
export type ApiError = {
  statusCode: number;
  message: string;
  requestId?: string;
};
export type PaymentAmount = { amountMinor: string; currency: "IRR" };
