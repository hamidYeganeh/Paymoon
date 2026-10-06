import { EmptyState } from "@paymoon/ui";
export default function Page() {
  return (
    <>
      <h1>محصولات</h1>
      <EmptyState
        title="محصولات"
        description="هنوز رابط مدیریت محصولات متصل نشده است."
      />
    </>
  );
}
