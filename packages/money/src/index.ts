export type Currency = "IRR";
export type Money = { amountMinor: bigint; currency: Currency };
export function money(value: string): Money {
  if (!/^(0|[1-9][0-9]{0,17})$/.test(value))
    throw new Error("Invalid IRR amount");
  return { amountMinor: BigInt(value), currency: "IRR" };
}
export type LedgerLine = { accountId: string; debit: bigint; credit: bigint };
export function assertBalanced(lines: readonly LedgerLine[]) {
  if (lines.length < 2) throw new Error("At least two entries required");
  let debit = 0n,
    credit = 0n;
  for (const l of lines) {
    if (l.debit < 0n || l.credit < 0n || l.debit > 0n === l.credit > 0n)
      throw new Error("One positive side required");
    debit += l.debit;
    credit += l.credit;
  }
  if (debit !== credit) throw new Error("Unbalanced journal");
}
