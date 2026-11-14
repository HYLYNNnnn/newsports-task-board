import { useState, type FormEvent } from "react";
import { Clock3, MessageSquare, Send } from "lucide-react";
import type { Snapshot } from "../types";
import { formatTimestamp, relativeTime } from "../lib/utils";
import { Avatar } from "./TaskPrimitives";
import type { RunAction } from "./TaskDialog";

export function TaskDiscussion({
  taskId,
  snapshot,
  busy,
  runAction,
  commentsOnly = false,
  autofocus = false,
}: {
  taskId: string;
  snapshot: Snapshot;
  busy: boolean;
  runAction: RunAction;
  commentsOnly?: boolean;
  autofocus?: boolean;
}) {
  const [tab, setTab] = useState<"comments" | "activity">("comments");
  const [comment, setComment] = useState("");
  const comments = snapshot.comments
    .filter((item) => item.task_id === taskId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const activity = snapshot.activities
    .filter((item) => item.task_id === taskId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .reverse();
  async function post(event: FormEvent) {
    event.preventDefault();
    if (!comment.trim() || busy) return;
    if (
      await runAction(
        (repository) => repository.addComment(taskId, comment.trim()),
        "Comment added.",
      )
    )
      setComment("");
  }
  return (
    <div className={`task-conversation ${commentsOnly ? "comments-only" : ""}`}>
      {!commentsOnly && (
        <div className="conversation-tabs">
          <button
            type="button"
            className={tab === "comments" ? "active" : ""}
            onClick={() => setTab("comments")}
          >
            <MessageSquare size={15} />
            Comments<span>{comments.length}</span>
          </button>
          <button
            type="button"
            className={tab === "activity" ? "active" : ""}
            onClick={() => setTab("activity")}
          >
            <Clock3 size={15} />
            Activity<span>{activity.length}</span>
          </button>
        </div>
      )}
      {commentsOnly || tab === "comments" ? (
        <>
          <div className="comments">
            {comments.length ? (
              comments.map((item) => (
                <div className="comment" key={item.id}>
                  <Avatar
                    member={{ name: "Guest", color: "#e6eaff" }}
                    size="avatar-small"
                  />
                  <div>
                    <div className="comment-author">
                      Guest{" "}
                      <time
                        dateTime={item.created_at}
                        title={formatTimestamp(item.created_at)}
                      >
                        {formatTimestamp(item.created_at)}
                      </time>
                    </div>
                    <p>{item.body}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="subtle-empty">
                A little conversation makes great work. Add the first comment.
              </p>
            )}
          </div>
          <form className="comment-form" onSubmit={post}>
            <input
              data-autofocus={autofocus || undefined}
              aria-label="Write a comment"
              placeholder="Share a thought or leave an update…"
              value={comment}
              maxLength={3000}
              onChange={(event) => setComment(event.target.value)}
              disabled={busy}
            />
            <button
              type="submit"
              className="icon-button"
              aria-label="Post comment"
              disabled={busy || !comment.trim()}
            >
              <Send size={17} />
            </button>
          </form>
        </>
      ) : (
        <div className="activity-list">
          {activity.map((item) => (
            <div className="activity" key={item.id}>
              <span className="activity-dot" />
              <p>{item.message}</p>
              <time
                dateTime={item.created_at}
                title={formatTimestamp(item.created_at)}
              >
                <span>{relativeTime(item.created_at)}</span>
                <span className="timestamp-detail">
                  {formatTimestamp(item.created_at)}
                </span>
              </time>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
