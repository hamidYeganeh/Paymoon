import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes, randomUUID } from "node:crypto";
export type TraceContext = {
  requestId: string;
  traceId: string;
  spanId: string;
  traceparent: string;
};
export const context = new AsyncLocalStorage<TraceContext>();
export function traceContext(parent?: string): TraceContext {
  const match = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/.exec(
    parent ?? "",
  );
  const traceId =
    match && match[1] !== "0".repeat(32) && match[2] !== "0".repeat(16)
      ? match[1]!
      : randomBytes(16).toString("hex");
  const spanId = randomBytes(8).toString("hex");
  return {
    requestId: randomUUID(),
    traceId,
    spanId,
    traceparent: `00-${traceId}-${spanId}-01`,
  };
}
