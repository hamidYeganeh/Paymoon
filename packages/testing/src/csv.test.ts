import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProductCsv, PRODUCT_CSV_HEADER } from "@paymoon/validation";
test("CSV preserves Persian, quoted commas/newlines and rejects malformed, duplicate and unsafe rows", () => {
  const rows = parseProductCsv(
    "\uFEFF" +
      PRODUCT_CSV_HEADER +
      '\r\n"ماگ","خط اول, متن\nخط دوم ""نقل قول""",MUG,150000,3,https://cdn.example.test/a.png,کرم,M\r\n',
  );
  assert.equal(rows[0]!.description, 'خط اول, متن\nخط دوم "نقل قول"');
  assert.equal(rows[0]!.priceToman, "150000");
  assert.throws(() => parseProductCsv(PRODUCT_CSV_HEADER + '\n"title,bad'));
  assert.throws(() =>
    parseProductCsv(PRODUCT_CSV_HEADER + "\nماگ,,S,1,-3,,,\n"),
  );
  assert.throws(() =>
    parseProductCsv(
      PRODUCT_CSV_HEADER + "\nماگ,,S,1,3,javascript:alert(1),,\n",
    ),
  );
  assert.throws(() =>
    parseProductCsv(PRODUCT_CSV_HEADER + "\nماگ,,S,1,3,,,\nماگ,,S,1,3,,,\n"),
  );
});
