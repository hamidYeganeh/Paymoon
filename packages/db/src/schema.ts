import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
export const commerce = pgSchema("commerce");
const id = () => uuid("id").primaryKey().defaultRandom();
const created = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
export const users = commerce.table("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: created(),
});
export const sessions = commerce.table("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const organizations = commerce.table("organizations", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: created(),
});
export const memberships = commerce.table(
  "memberships",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role", {
      enum: ["owner", "admin", "staff", "viewer"],
    }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.organizationId, t.userId] }),
    check(
      "membership_role",
      sql`${t.role} in ('owner','admin','staff','viewer')`,
    ),
  ],
);
export const merchants = commerce.table(
  "merchants",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .unique()
      .references(() => organizations.id),
    displayName: text("display_name").notNull(),
    instagramHandle: text("instagram_handle"),
    bio: text("bio").notNull().default(""),
    shippingFeeMinor: bigint("shipping_fee_minor", { mode: "bigint" })
      .notNull()
      .default(0n),
    shippingDays: integer("shipping_days").notNull().default(3),
    returnPolicy: text("return_policy").notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: text("status").notNull().default("draft"),
    createdAt: created(),
  },
  (t) => [
    check(
      "merchant_status",
      sql`${t.status} in ('draft','submitted','approved','rejected')`,
    ),
  ],
);
export const categories = commerce.table("categories", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
});
export const products = commerce.table(
  "products",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    categoryId: uuid("category_id").references(() => categories.id),
    title: text("title").notNull(),
    status: text("status").notNull().default("draft"),
    description: text("description").notNull().default(""),
    media: jsonb("media").notNull().default([]),
    sourceMediaId: text("source_media_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    version: integer("version").notNull().default(1),
    embedding: vector("embedding", { dimensions: 1536 }),
    createdAt: created(),
  },
  (t) => [
    unique("product_tenant_id").on(t.organizationId, t.id),
    check(
      "product_status",
      sql`${t.status} in ('draft','published','archived')`,
    ),
  ],
);
export const variants = commerce.table(
  "variants",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    sku: text("sku").notNull(),
    attributes: jsonb("attributes").notNull().default({}),
    priceMinor: bigint("price_minor", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull().default("IRR"),
  },
  (t) => [
    unique("variant_sku").on(t.organizationId, t.sku),
    unique("variant_tenant_id").on(t.organizationId, t.id),
    check("price_nonnegative", sql`${t.priceMinor}>=0`),
  ],
);
export const inventory = commerce.table(
  "inventory",
  {
    variantId: uuid("variant_id")
      .primaryKey()
      .references(() => variants.id),
    available: integer("available").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    committed: integer("committed").notNull().default(0),
  },
  (t) => [
    check(
      "stock_nonnegative",
      sql`${t.available}>=0 and ${t.reserved}>=0 and ${t.committed}>=0`,
    ),
  ],
);
export const stockMovements = commerce.table("stock_movements", {
  id: id(),
  variantId: uuid("variant_id")
    .notNull()
    .references(() => variants.id),
  kind: text("kind").notNull(),
  quantity: integer("quantity").notNull(),
  actorId: uuid("actor_id")
    .notNull()
    .references(() => users.id),
  createdAt: created(),
});
export const orders = commerce.table("orders", {
  id: id(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  shippingAddress: jsonb("shipping_address").notNull().default({}),
  shippingFeeMinor: bigint("shipping_fee_minor", { mode: "bigint" })
    .notNull()
    .default(0n),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  trackingCode: text("tracking_code"),
  carrier: text("carrier"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  buyerId: uuid("buyer_id")
    .notNull()
    .references(() => users.id),
  status: text("status").notNull().default("draft"),
  amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
  currency: text("currency").notNull().default("IRR"),
  version: integer("version").notNull().default(1),
  createdAt: created(),
});
export const payments = commerce.table("payments", {
  id: id(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id),
  provider: text("provider").notNull(),
  providerReference: text("provider_reference").unique(),
  status: text("status").notNull().default("pending"),
  amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
  createdAt: created(),
});
export const ledgerAccounts = commerce.table(
  "ledger_accounts",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    code: text("code").notNull(),
    currency: text("currency").notNull().default("IRR"),
  },
  (t) => [unique("account_code").on(t.organizationId, t.code)],
);
export const journals = commerce.table(
  "journals",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    reference: text("reference").notNull(),
    createdAt: created(),
  },
  (t) => [unique("journal_reference").on(t.organizationId, t.reference)],
);
export const ledgerEntries = commerce.table("ledger_entries", {
  id: id(),
  journalId: uuid("journal_id")
    .notNull()
    .references(() => journals.id),
  accountId: uuid("account_id")
    .notNull()
    .references(() => ledgerAccounts.id),
  debit: bigint("debit", { mode: "bigint" }).notNull(),
  credit: bigint("credit", { mode: "bigint" }).notNull(),
});
export const outbox = commerce.table("outbox", {
  id: id(),
  topic: text("topic").notNull(),
  payload: jsonb("payload").notNull(),
  traceparent: text("traceparent"),
  createdAt: created(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});
export const inbox = commerce.table("instagram_inbox", {
  id: id(),
  digest: text("digest").notNull().unique(),
  payload: jsonb("payload").notNull(),
  status: text("status").notNull().default("received"),
  createdAt: created(),
});
export const idempotency = commerce.table(
  "idempotency",
  {
    scope: text("scope").notNull(),
    key: text("key").notNull(),
    hash: text("hash").notNull(),
    response: jsonb("response").notNull(),
    createdAt: created(),
  },
  (t) => [primaryKey({ columns: [t.scope, t.key] })],
);
export const notifications = commerce.table("notifications", {
  id: id(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  eventId: uuid("event_id")
    .notNull()
    .unique()
    .references(() => outbox.id),
  kind: text("kind").notNull(),
  createdAt: created(),
});

export const instagramOAuthStates = commerce.table("instagram_oauth_states", {
  stateHash: text("state_hash").primaryKey(),
  browserHash: text("browser_hash").notNull(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  sessionHash: text("session_hash")
    .notNull()
    .references(() => sessions.tokenHash, { onDelete: "cascade" }),
  scopes: text("scopes").array().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: created(),
});
export const instagramConnections = commerce.table("instagram_connections", {
  organizationId: uuid("organization_id")
    .primaryKey()
    .references(() => organizations.id),
  accountId: text("account_id").notNull().unique(),
  username: text("username").notNull(),
  tokenCiphertext: text("token_ciphertext").notNull(),
  scopes: text("scopes").array().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  refreshedAt: timestamp("refreshed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  connectedBy: uuid("connected_by")
    .notNull()
    .references(() => users.id),
  connectedAt: timestamp("connected_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  version: integer("version").notNull().default(1),
  subscribedFields: text("subscribed_fields")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
});
export const instagramMedia = commerce.table(
  "instagram_media",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => instagramConnections.organizationId, {
        onDelete: "cascade",
      }),
    mediaId: text("media_id").notNull(),
    accountId: text("account_id").notNull(),
    payload: jsonb("payload").notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.mediaId] })],
);
export const instagramDeliveries = commerce.table(
  "instagram_deliveries",
  {
    inboxId: uuid("inbox_id")
      .notNull()
      .references(() => inbox.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => instagramConnections.organizationId, {
        onDelete: "cascade",
      }),
    entryIndex: integer("entry_index").notNull(),
    payload: jsonb("payload").notNull(),
  },
  (t) => [primaryKey({ columns: [t.inboxId, t.entryIndex] })],
);

export const orderItems = commerce.table(
  "order_items",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => variants.id),
    title: text("title").notNull(),
    sku: text("sku").notNull(),
    attributes: jsonb("attributes").notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceMinor: bigint("unit_price_minor", { mode: "bigint" }).notNull(),
  },
  (t) => [unique().on(t.orderId, t.variantId)],
);
export const addresses = commerce.table("addresses", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  label: text("label").notNull(),
  recipient: text("recipient").notNull(),
  phone: text("phone").notNull(),
  province: text("province").notNull(),
  city: text("city").notNull(),
  postalCode: text("postal_code").notNull(),
  address: text("address").notNull(),
  createdAt: created(),
});
export const savedProducts = commerce.table(
  "saved_products",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    createdAt: created(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.productId] })],
);
export const followedMerchants = commerce.table(
  "followed_merchants",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id),
    createdAt: created(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.merchantId] })],
);
export const reviews = commerce.table("reviews", {
  id: id(),
  orderId: uuid("order_id")
    .notNull()
    .unique()
    .references(() => orders.id),
  buyerId: uuid("buyer_id")
    .notNull()
    .references(() => users.id),
  rating: integer("rating").notNull(),
  body: text("body").notNull(),
  createdAt: created(),
});
export const supportTickets = commerce.table("support_tickets", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  orderId: uuid("order_id").references(() => orders.id),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("open"),
  reply: text("reply"),
  createdAt: created(),
});
export const userNotifications = commerce.table("user_notifications", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  orderId: uuid("order_id").references(() => orders.id),
  kind: text("kind").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: created(),
});
export const analyticsEvents = commerce.table("analytics_events", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  organizationId: uuid("organization_id").references(() => organizations.id),
  name: text("name").notNull(),
  properties: jsonb("properties").notNull().default({}),
  createdAt: created(),
});
export const instagramLaunchTickets = commerce.table(
  "instagram_launch_tickets",
  {
    digest: text("digest").primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    sessionHash: text("session_hash")
      .notNull()
      .references(() => sessions.tokenHash, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
);

export const productLikes = commerce.table(
  "product_likes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    createdAt: created(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.productId] })],
);
export const productComments = commerce.table("product_comments", {
  id: id(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id),
  body: text("body").notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: created(),
});
