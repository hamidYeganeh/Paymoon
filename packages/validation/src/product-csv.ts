import { z } from "zod";
const rowSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().max(5000),
  sku: z.string().trim().min(1).max(100),
  priceToman: z.string().regex(/^\d{1,12}$/),
  quantity: z.coerce.number().int().min(0).max(1000000),
  imageUrl: z.union([
    z.literal(""),
    z.url().refine((v) => new URL(v).protocol === "https:"),
  ]),
  color: z.string().max(100),
  size: z.string().max(100),
});
export type ProductCsvRow = z.infer<typeof rowSchema>;
export const PRODUCT_CSV_HEADER =
  "title,description,sku,price_toman,quantity,image_url,color,size";
export function parseProductCsv(input: string): ProductCsvRow[] {
  if (input.length > 250000)
    throw new Error("فایل باید کمتر از ۲۵۰ هزار کاراکتر باشد.");
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false;
  const push = () => {
    row.push(field);
    field = "";
    closed = false;
  };
  const line = () => {
    push();
    if (row.some((x) => x.length)) rows.push(row);
    row = [];
    if (rows.length > 101) throw new Error("حداکثر ۱۰۰ ردیف در هر بار.");
  };
  const csv = input.replace(/^\uFEFF/, "");
  for (let i = 0; i < csv.length; i++) {
    const x = csv[i]!;
    if (quoted) {
      if (x === '"') {
        if (csv[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += x;
      continue;
    }
    if (x === ",") {
      push();
      continue;
    }
    if (x === "\n" || x === "\r") {
      if (x === "\r" && csv[i + 1] === "\n") i++;
      line();
      continue;
    }
    if (x === '"' && !field && !closed) {
      quoted = true;
      continue;
    }
    if (closed || x === '"') throw new Error("نقل‌قول CSV معتبر نیست.");
    field += x;
  }
  if (quoted) throw new Error("نقل‌قول CSV بسته نشده است.");
  if (field || row.length || closed) line();
  const header = rows.shift();
  if (!header || header.join(",") !== PRODUCT_CSV_HEADER)
    throw new Error("ستون‌های فایل با قالب نمونه یکسان نیستند.");
  if (!rows.length) throw new Error("فایل محصولی ندارد.");
  const skus = new Set<string>();
  return rows.map((r, i) => {
    if (r.length !== 8)
      throw new Error(`ردیف ${i + 2}: تعداد ستون‌ها صحیح نیست.`);
    const v = rowSchema.safeParse({
      title: r[0],
      description: r[1],
      sku: r[2],
      priceToman: r[3],
      quantity: r[4],
      imageUrl: r[5],
      color: r[6],
      size: r[7],
    });
    if (!v.success)
      throw new Error(
        `ردیف ${i + 2}: عنوان، SKU، قیمت، موجودی یا تصویر معتبر نیست.`,
      );
    if (skus.has(v.data.sku)) throw new Error(`ردیف ${i + 2}: SKU تکراری است.`);
    skus.add(v.data.sku);
    return v.data;
  });
}
