import { Module } from "@nestjs/common";
import { assertBalanced, type LedgerLine } from "@paymoon/money";
import type { PoolClient } from "@paymoon/db";
export async function postJournal(
  c: PoolClient,
  organizationId: string,
  reference: string,
  lines: LedgerLine[],
) {
  assertBalanced(lines);
  const journal = (
    await c.query(
      "INSERT INTO commerce.journals(organization_id,reference) VALUES($1,$2) RETURNING id",
      [organizationId, reference],
    )
  ).rows[0];
  for (const line of lines)
    await c.query(
      "INSERT INTO commerce.ledger_entries(journal_id,account_id,debit,credit) VALUES($1,$2,$3,$4)",
      [
        journal.id,
        line.accountId,
        line.debit.toString(),
        line.credit.toString(),
      ],
    );
  return journal.id as string;
}
@Module({})
export class LedgerModule {}
