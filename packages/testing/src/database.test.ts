import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { database, transaction } from "@paymoon/db";
import { idempotent } from "@paymoon/events";
const url = process.env.COMMERCE_DATABASE_TEST_URL;
test(
  "PostgreSQL transactions: idempotency races, rollback, balanced ledger and tenant isolation",
  { skip: !url },
  async () => {
    if (!new URL(url!).pathname.endsWith("_test"))
      throw new Error("Use an isolated _test database");
    const { pool } = database(url!);
    const org = randomUUID(),
      user = randomUUID(),
      product = randomUUID(),
      variant = randomUUID();
    try {
      await pool.query(
        "INSERT INTO commerce.users(id,email,password_hash) VALUES($1,$2,$3)",
        [user, `${user}@test.invalid`, "test-only"],
      );
      await pool.query(
        "INSERT INTO commerce.organizations(id,name,slug) VALUES($1,$2,$3)",
        [org, "Integration", org],
      );
      await pool.query(
        "INSERT INTO commerce.products(id,organization_id,title) VALUES($1,$2,$3)",
        [product, org, "Test"],
      );
      await pool.query(
        "INSERT INTO commerce.variants(id,organization_id,product_id,sku,price_minor) VALUES($1,$2,$3,'test',10)",
        [variant, org, product],
      );
      await pool.query(
        "INSERT INTO commerce.inventory(variant_id,available) VALUES($1,5)",
        [variant],
      );
      const run = () =>
        transaction(pool, (c) =>
          idempotent(c, org, "same-key-123", { n: 1 }, async () => {
            await c.query(
              "UPDATE commerce.inventory SET available=available-1 WHERE variant_id=$1",
              [variant],
            );
            return { id: randomUUID() };
          }),
        );
      const [a, b] = await Promise.all([run(), run()]);
      assert.deepEqual(a, b);
      assert.equal(
        (
          await pool.query(
            "SELECT available FROM commerce.inventory WHERE variant_id=$1",
            [variant],
          )
        ).rows[0].available,
        4,
      );
      await assert.rejects(() =>
        transaction(pool, (c) =>
          idempotent(c, org, "same-key-123", { n: 2 }, async () => ({})),
        ),
      );
      await assert.rejects(() =>
        transaction(pool, async (c) => {
          await c.query(
            "UPDATE commerce.inventory SET available=-1 WHERE variant_id=$1",
            [variant],
          );
        }),
      );
      await assert.rejects(() =>
        transaction(pool, async (c) => {
          await c.query(
            "INSERT INTO commerce.journals(organization_id,reference) VALUES($1,'empty')",
            [org],
          );
        }),
      );
      const account = (
        await pool.query(
          "INSERT INTO commerce.ledger_accounts(organization_id,code) VALUES($1,'cash') RETURNING id",
          [org],
        )
      ).rows[0].id;
      await transaction(pool, async (c) => {
        const journal = (
          await c.query(
            "INSERT INTO commerce.journals(organization_id,reference) VALUES($1,'balanced') RETURNING id",
            [org],
          )
        ).rows[0].id;
        await c.query(
          "INSERT INTO commerce.ledger_entries(journal_id,account_id,debit,credit) VALUES($1,$2,10,0),($1,$2,0,10)",
          [journal, account],
        );
      });
      await assert.rejects(() =>
        pool.query(
          "UPDATE commerce.ledger_entries SET debit=11 WHERE account_id=$1",
          [account],
        ),
      );
      const other = (
        await pool.query(
          "INSERT INTO commerce.organizations(name,slug) VALUES('other',$1) RETURNING id",
          [randomUUID()],
        )
      ).rows[0].id;
      await assert.rejects(() =>
        pool.query(
          "INSERT INTO commerce.variants(organization_id,product_id,sku,price_minor) VALUES($1,$2,'foreign',10)",
          [other, product],
        ),
      );
    } finally {
      await pool.end();
    }
  },
);
