import { z } from "zod";
export const uuid = z.uuid();
export const credentials = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    password: z.string().min(12).max(128),
  })
  .strict();
export const organizationInput = z
  .object({
    name: z.string().trim().min(2).max(100),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(80),
  })
  .strict();
export const merchantInput = z
  .object({
    displayName: z.string().trim().min(2).max(100),
    instagramHandle: z
      .string()
      .regex(/^[a-zA-Z0-9_.]{1,30}$/)
      .optional(),
  })
  .strict();
export const movementInput = z
  .object({
    variantId: uuid,
    kind: z.enum(["receive", "reserve", "release", "commit", "ship"]),
    quantity: z.number().int().positive().max(1000000),
  })
  .strict();
export const productInput = z
  .object({
    title: z.string().trim().min(1).max(200),
    categoryId: uuid.optional(),
    variants: z
      .array(
        z
          .object({
            sku: z.string().min(1).max(100),
            attributes: z.record(z.string(), z.string()).default({}),
            priceMinor: z.string().regex(/^(0|[1-9][0-9]{0,17})$/),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();
export const orderStates = [
  "draft",
  "pending_payment",
  "paid",
  "fulfilling",
  "shipped",
  "completed",
  "cancelled",
  "refunded",
] as const;
export type OrderState = (typeof orderStates)[number];
const transitions: Record<OrderState, readonly OrderState[]> = {
  draft: ["pending_payment", "cancelled"],
  pending_payment: ["paid", "cancelled"],
  paid: ["fulfilling", "refunded"],
  fulfilling: ["shipped", "refunded"],
  shipped: ["completed"],
  completed: ["refunded"],
  cancelled: [],
  refunded: [],
};
export function assertOrderTransition(from: OrderState, to: OrderState) {
  if (!transitions[from].includes(to))
    throw new Error("Invalid order transition");
}
export type Stock = { available: number; reserved: number; committed: number };
export function moveStock(
  stock: Stock,
  kind: z.infer<typeof movementInput>["kind"],
  quantity: number,
): Stock {
  if (!Number.isSafeInteger(quantity) || quantity <= 0)
    throw new Error("Invalid quantity");
  const next = {
    available: stock.available,
    reserved: stock.reserved,
    committed: stock.committed,
  };
  if (kind === "receive") next.available += quantity;
  if (kind === "reserve") {
    next.available -= quantity;
    next.reserved += quantity;
  }
  if (kind === "release") {
    next.reserved -= quantity;
    next.available += quantity;
  }
  if (kind === "commit") {
    next.reserved -= quantity;
    next.committed += quantity;
  }
  if (kind === "ship") next.committed -= quantity;
  if (Object.values(next).some((v) => !Number.isSafeInteger(v) || v < 0))
    throw new Error("Insufficient stock");
  return next;
}
