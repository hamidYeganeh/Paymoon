"use client";
import { useState } from "react";
import { useCommerce, useQuery, useResource, date } from "./client";
import { AppLink, BackButton } from "../motion";
import { Avatar } from "../social-shell";
import { Panel, ErrorBox, Loading, Empty, Action } from "./components";
type Comment = {
  id: string;
  body: string;
  author_id: string;
  author_name: string;
  created_at: string;
};
export function CommentsPage() {
  const id = useQuery("id"),
    c = useCommerce(),
    [offset, setOffset] = useState(0),
    [text, setText] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const path = id ? `/v1/marketplace/products/${id}/comments` : null,
    r = useResource<Comment[]>(path ? path + "?offset=" + offset : null);
  return (
    <Panel title="پرسش و نظر" action={<BackButton />}>
      <p className="muted">
        سؤال دربارهٔ محصول یا تجربهٔ خود را بنویسید. این نظرها در پی‌مون ثبت
        می‌شوند.
      </p>
      <ErrorBox message={r.error || error} />
      {r.loading ? (
        <Loading />
      ) : r.data?.length ? (
        r.data.map((comment) => (
          <article className="comment-card" key={comment.id}>
            <Avatar name={comment.author_name} size={36} />
            <div>
              <strong>{comment.author_name}</strong>
              <p>{comment.body}</p>
              <time>{date(comment.created_at)}</time>
              {c.user?.id === comment.author_id && (
                <Action
                  run={() => c.request(`${path}/${comment.id}`, "DELETE")}
                  done={r.reload}
                >
                  حذف
                </Action>
              )}
            </div>
          </article>
        ))
      ) : (
        !r.error && (
          <Empty>
            <h2>گفت‌وگو را شروع کنید</h2>
            <p>اولین سؤال یا نظر دربارهٔ این محصول را بنویسید.</p>
          </Empty>
        )
      )}
      <div className="pagination">
        <button
          disabled={!offset}
          onClick={() => setOffset(Math.max(0, offset - 30))}
        >
          قبلی
        </button>
        <button
          disabled={!r.data || r.data.length < 30}
          onClick={() => setOffset(offset + 30)}
        >
          بعدی
        </button>
      </div>
      {c.user ? (
        <form
          className="comment-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!path || !text.trim() || busy) return;
            setBusy(true);
            setError("");
            void c
              .request(path, "POST", { body: text })
              .then(() => {
                setText("");
                setOffset(0);
                r.reload();
              })
              .catch((e) => setError(e.message))
              .finally(() => setBusy(false));
          }}
        >
          <input
            aria-label="متن پرسش یا نظر"
            placeholder="نظر خود را بنویسید…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            maxLength={1000}
          />
          <button
            type="submit"
            className="primary"
            disabled={busy || !text.trim()}
          >
            ارسال
          </button>
        </form>
      ) : (
        <AppLink className="text-link" href="/login/">
          برای نوشتن نظر وارد شوید
        </AppLink>
      )}
    </Panel>
  );
}
