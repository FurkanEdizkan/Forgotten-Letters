"use client";

/**
 * Threaded comments.
 *
 * Bodies are already sanitized on write (lib/sanitize.ts), so rendering
 * with dangerouslySetInnerHTML here is safe — but only because of that.
 * Never render a body that has not been through sanitizeComment.
 *
 * Nesting is capped at one level: deep threads are hard to follow and
 * hard to lay out, and a reply-to-a-reply attaches to the top-level
 * parent instead.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MessageSquare, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { createCommentAction, deleteCommentAction } from "@/lib/actions/social";
import type { CommentView } from "@/lib/queries/social";
import type { TargetType } from "@/lib/db/votes";

export function CommentThread({
  targetType,
  targetId,
  comments,
  currentUsername,
}: {
  targetType: TargetType;
  targetId: string;
  comments: CommentView[];
  /** Null when signed out — the composer is replaced with a prompt. */
  currentUsername: string | null;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const roots = comments.filter((c) => !c.parentId);
  const repliesByParent = new Map<string, CommentView[]>();
  for (const c of comments) {
    if (c.parentId) {
      repliesByParent.set(c.parentId, [...(repliesByParent.get(c.parentId) ?? []), c]);
    }
  }

  function submit(text: string, parentId: string | null) {
    if (!text.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createCommentAction({
        targetType,
        targetId,
        parentId,
        body: text,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBody("");
      setReplyBody("");
      setReplyTo(null);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteCommentAction(id);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <section className="mt-10 border-t border-border pt-8">
      <h2 className="flex items-center gap-2 font-mono text-[0.625rem] uppercase tracking-[0.2em] text-accent">
        <MessageSquare className="size-3.5" />
        {comments.length} {comments.length === 1 ? "comment" : "comments"}
      </h2>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded border border-primary/40 bg-primary-soft px-3 py-2 text-sm text-primary-ink"
        >
          {error}
        </p>
      )}

      {currentUsername ? (
        <div className="mt-4 flex flex-col gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Add a comment…"
            aria-label="Add a comment"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => submit(body, null)}
              disabled={pending || !body.trim()}
            >
              {pending ? "Posting…" : "Post"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">
          <Link href="/login" className="text-primary hover:underline">
            Log in
          </Link>{" "}
          to join the discussion.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-5">
        {roots.map((comment) => (
          <div key={comment.id}>
            <CommentBody
              comment={comment}
              currentUsername={currentUsername}
              onDelete={() => remove(comment.id)}
              onReply={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
              pending={pending}
            />

            {replyTo === comment.id && currentUsername && (
              <div className="ml-6 mt-3 flex flex-col gap-2 border-l border-border pl-4">
                <Textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  rows={2}
                  placeholder="Reply…"
                  aria-label={`Reply to ${comment.author?.username ?? "comment"}`}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setReplyTo(null)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => submit(replyBody, comment.id)}
                    disabled={pending || !replyBody.trim()}
                  >
                    Post reply
                  </Button>
                </div>
              </div>
            )}

            {(repliesByParent.get(comment.id) ?? []).map((reply) => (
              <div key={reply.id} className="ml-6 mt-3 border-l border-border pl-4">
                <CommentBody
                  comment={reply}
                  currentUsername={currentUsername}
                  onDelete={() => remove(reply.id)}
                  pending={pending}
                />
              </div>
            ))}
          </div>
        ))}

        {roots.length === 0 && <p className="text-sm text-muted">No comments yet.</p>}
      </div>
    </section>
  );
}

function CommentBody({
  comment,
  currentUsername,
  onDelete,
  onReply,
  pending,
}: {
  comment: CommentView;
  currentUsername: string | null;
  onDelete: () => void;
  onReply?: () => void;
  pending: boolean;
}) {
  const isAuthor = Boolean(
    currentUsername && comment.author?.username === currentUsername,
  );

  if (comment.isDeleted) {
    // Tombstone, so replies beneath keep their position in the thread.
    return <p className="text-sm italic text-faint">This comment was deleted.</p>;
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        {comment.author ? (
          <Link
            href={`/user/${comment.author.username}`}
            className="font-mono text-[0.6875rem] uppercase tracking-wider text-muted hover:text-primary"
          >
            @{comment.author.username}
          </Link>
        ) : (
          <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-faint">
            deleted user
          </span>
        )}
        <time
          dateTime={new Date(comment.createdAt).toISOString()}
          className="font-mono text-[0.625rem] text-faint"
        >
          {new Date(comment.createdAt).toLocaleDateString()}
        </time>
      </div>

      {/* Sanitized on write in createCommentAction. */}
      <div
        data-testid="comment-body"
        className="mt-1.5 text-sm leading-relaxed text-muted [&_a]:text-primary [&_a]:underline [&_p]:mb-2 [&_strong]:text-ink"
        dangerouslySetInnerHTML={{ __html: comment.body }}
      />

      <div className="mt-1.5 flex items-center gap-3">
        {onReply && currentUsername && (
          <button
            type="button"
            onClick={onReply}
            className="font-mono text-[0.625rem] uppercase tracking-wider text-faint hover:text-primary"
          >
            Reply
          </button>
        )}
        {isAuthor && (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="inline-flex items-center gap-1 font-mono text-[0.625rem] uppercase tracking-wider text-faint hover:text-danger disabled:opacity-60"
          >
            <Trash2 className="size-3" /> Delete
          </button>
        )}
      </div>
    </div>
  );
}
