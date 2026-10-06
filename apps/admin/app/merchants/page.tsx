import { EmptyState } from "@paymoon/ui";
export default function Page() {
  return (
    <>
      <h1>فروشندگان</h1>
      <EmptyState
        title="فروشندگان"
        description="بررسی و تأیید فروشندگان هنوز فعال نیست."
      />
    </>
  );
}
