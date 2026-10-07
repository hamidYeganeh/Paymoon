"use client";
import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useCommerce, useResource, date } from "./client";
import {
  Panel,
  Gate,
  ErrorBox,
  Empty,
  Form,
  Action,
  Loading,
} from "./components";
type Thread = {
  id: string;
  display_name: string;
  status: string;
  assigned_to: string | null;
  updated_at: string;
};
type Message = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
};
export function InboxPage({ seller = false }: { seller?: boolean }) {
  const c = useCommerce(),
    merchantId = useSearchParams().get("merchant"),
    [selected, setSelected] = useState(""),
    [offset, setOffset] = useState(0),
    [body, setBody] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const base = seller
      ? c.org
        ? `/v1/organizations/${c.org.id}/conversations`
        : null
      : c.user
        ? "/v1/me/conversations"
        : null,
    r = useResource<Thread[]>(base),
    messages = useResource<Message[]>(
      base && selected ? `${base}/${selected}/messages?offset=${offset}` : null,
    );
  const operators = useResource<{ user_id: string; email: string }[]>(
    seller && c.org ? `/v1/organizations/${c.org.id}/operators` : null,
  );
  const sendAttempt = useRef<{ payload: string; key: string } | null>(null);
  const current = r.data?.find((x) => x.id === selected);
  useEffect(() => {
    setSelected("");
    setOffset(0);
    setBody("");
  }, [c.org?.id]);
  useEffect(() => {
    if (!base) return;
    const timer = setInterval(() => {
      r.reload();
      if (selected && offset === 0) messages.reload();
    }, 20000);
    return () => clearInterval(timer);
  }, [base, selected, offset]);
  return (
    <Gate seller={seller}>
      <Panel title={seller ? "صندوق پیام تیم" : "پیام‌های من"}>
        <p className="notice-banner">
          گفتگوهای این صفحه داخل Paymoon هستند. دایرکت Instagram هنوز متصل نشده
          است.
        </p>
        {!seller && merchantId && (
          <Action
            run={async () => {
              const x = await c.request<Thread>(
                "/v1/me/conversations",
                "POST",
                { merchantId },
              );
              setSelected(x.id);
              r.reload();
            }}
          >
            شروع گفتگو با فروشگاه
          </Action>
        )}
        <ErrorBox message={r.error} />
        <div className="inbox-layout">
          <aside className="conversation-list">
            {r.data?.map((x) => (
              <button
                key={x.id}
                aria-pressed={selected === x.id}
                onClick={() => {
                  setSelected(x.id);
                  setOffset(0);
                  setBody("");
                  setError("");
                }}
              >
                <strong dir={seller ? "ltr" : undefined}>
                  {x.display_name}
                </strong>
                <small>
                  {
                    { open: "باز", pending: "در انتظار", resolved: "حل‌شده" }[
                      x.status
                    ]
                  }{" "}
                  · {date(x.updated_at)}
                </small>
              </button>
            ))}
            {!r.loading && !r.data?.length && <p>گفتگویی ثبت نشده است.</p>}
          </aside>
          <section className="conversation-detail">
            {selected ? (
              <>
                <h2>{current?.display_name ?? "گفتگو"}</h2>
                {seller && current && (
                  <Form
                    key={`${selected}:${current.status}:${current.assigned_to}`}
                    fields={[
                      {
                        name: "status",
                        label: "وضعیت گفتگو",
                        options: [
                          { value: "open", label: "باز" },
                          { value: "pending", label: "در انتظار" },
                          { value: "resolved", label: "حل‌شده" },
                        ],
                      },
                      {
                        name: "assignedTo",
                        label: "مسئول گفتگو",
                        options: [
                          { value: "", label: "تخصیص داده نشده" },
                          ...(operators.data ?? []).map((x) => ({
                            value: x.user_id,
                            label: x.email,
                          })),
                        ],
                      },
                    ]}
                    initial={{
                      status: current.status,
                      assignedTo: current.assigned_to ?? "",
                    }}
                    submit={(v) =>
                      c.request(`${base}/${selected}`, "PUT", {
                        status: v.status,
                        assignedTo: v.assignedTo || null,
                      })
                    }
                    onSuccess={r.reload}
                  />
                )}
                <ErrorBox message={messages.error} />
                {messages.loading ? (
                  <Loading />
                ) : (
                  <div className="message-list">
                    {messages.data?.map((m) => (
                      <article
                        className={
                          "chat-bubble " +
                          (m.author_id === c.user?.id ? "own" : "")
                        }
                        key={m.id}
                      >
                        <p>{m.body}</p>
                        <small>{date(m.created_at)}</small>
                      </article>
                    ))}
                  </div>
                )}
                <div className="pagination">
                  <button
                    disabled={(messages.data?.length ?? 0) < 50}
                    onClick={() => setOffset(offset + 50)}
                  >
                    قدیمی‌تر
                  </button>
                  <button
                    disabled={offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - 50))}
                  >
                    تازه‌تر
                  </button>
                  <button onClick={messages.reload}>تازه‌کردن</button>
                </div>
                <form
                  className="commerce-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setBusy(true);
                    setError("");
                    const payload = JSON.stringify({ base, selected, body });
                    if (sendAttempt.current?.payload !== payload)
                      sendAttempt.current = {
                        payload,
                        key: crypto.randomUUID(),
                      };
                    void c
                      .request(
                        `${base}/${selected}/messages`,
                        "POST",
                        { body },
                        sendAttempt.current.key,
                      )
                      .then(() => {
                        sendAttempt.current = null;
                        setBody("");
                        setOffset(0);
                        r.reload();
                        messages.reload();
                      })
                      .catch((e) => setError(e.message))
                      .finally(() => setBusy(false));
                  }}
                >
                  <label>
                    پیام
                    <textarea
                      value={body}
                      maxLength={2000}
                      required
                      onChange={(e) => setBody(e.target.value)}
                    />
                  </label>
                  <ErrorBox message={error} />
                  <button className="primary" disabled={busy || !body.trim()}>
                    {busy ? "در حال ارسال…" : "ارسال در پی‌مون"}
                  </button>
                </form>
              </>
            ) : (
              <Empty>برای دیدن پیام‌ها، گفتگو را انتخاب کنید.</Empty>
            )}
          </section>
        </div>
      </Panel>
    </Gate>
  );
}
