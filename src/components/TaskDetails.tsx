import { CalendarDays, Check, MessageSquare, Pencil } from "lucide-react";
import type { Snapshot, Task } from "../types";
import {
  dueInfo,
  formatTimestamp,
  priorityTitle,
  statusTitle,
} from "../lib/utils";
import { Avatar, StatusIcon } from "./TaskPrimitives";
import { TaskDiscussion } from "./TaskDiscussion";
import { Modal } from "./Modal";
import type { RunAction } from "./TaskDialog";
import { LabelBadge } from "./Labels";

type TaskViewProps = {
  task: Task;
  snapshot: Snapshot;
  busy: boolean;
  runAction: RunAction;
};

export function TaskDetails({
  task,
  snapshot,
  busy,
  runAction,
}: TaskViewProps) {
  const member = snapshot.members.find(
    (member) => member.id === task.assignee_id,
  );
  const due = dueInfo(task);
  return (
    <div className="task-readout">
      <section className="readout-description">
        <h4>Description</h4>
        <p>{task.description || "No description yet."}</p>
      </section>
      <dl className="task-info-grid">
        <div>
          <dt>Status</dt>
          <dd>
            <StatusIcon status={task.status} />
            <span>{statusTitle(task.status)}</span>
          </dd>
        </div>
        <div>
          <dt>Priority</dt>
          <dd>
            <span className={`priority priority-${task.priority}`}>
              {priorityTitle(task.priority)}
            </span>
          </dd>
        </div>
        <div>
          <dt>Assignee</dt>
          <dd>
            <Avatar member={member} size="avatar-small" />
            <span>{member?.name || "Unassigned"}</span>
          </dd>
        </div>
        <div>
          <dt>Due date</dt>
          <dd
            className={due?.overdue ? "overdue" : due?.soon ? "due-soon" : ""}
          >
            <CalendarDays size={14} />
            <span>
              {task.due_date || "No due date"}
              {due && (due.overdue || due.soon) && <small>{due.hint}</small>}
            </span>
          </dd>
        </div>
      </dl>
      <div className="readout-labels">
        <h4>Labels</h4>
        <div className="label-group">
          {task.labels.length ? (
            task.labels.map((name) => (
              <LabelBadge key={name} name={name} labels={snapshot.labels} />
            ))
          ) : (
            <span className="readout-empty-value">No labels</span>
          )}
        </div>
      </div>
      <div className="task-readout-times">
        <span>
          Created{" "}
          <time dateTime={task.created_at}>
            {formatTimestamp(task.created_at)}
          </time>
        </span>
        <span>
          Updated{" "}
          <time dateTime={task.updated_at}>
            {formatTimestamp(task.updated_at)}
          </time>
        </span>
      </div>
      <TaskDiscussion
        taskId={task.id}
        snapshot={snapshot}
        busy={busy}
        runAction={runAction}
      />
    </div>
  );
}

export function TaskDetailsDialog({
  task,
  snapshot,
  busy,
  runAction,
  onEdit,
  onClose,
}: TaskViewProps & { onEdit: (task: Task) => void; onClose: () => void }) {
  return (
    <Modal
      title={task.title}
      subtitle="Task overview"
      onClose={onClose}
      busy={busy}
      wide
      headerActions={
        <button
          type="button"
          className="button button-secondary"
          aria-label={`Edit task: ${task.title}`}
          onClick={() => onEdit(task)}
          disabled={busy}
        >
          <Pencil size={14} />
          Edit
        </button>
      }
    >
      <TaskDetails
        task={task}
        snapshot={snapshot}
        busy={busy}
        runAction={runAction}
      />
      <div className="modal-footer">
        <button
          type="button"
          className="button button-primary footer-actions"
          onClick={onClose}
          disabled={busy}
        >
          Done
          <Check size={14} />
        </button>
      </div>
    </Modal>
  );
}

export function TaskCommentsDialog({
  task,
  snapshot,
  busy,
  runAction,
  onClose,
}: TaskViewProps & { onClose: () => void }) {
  const count = snapshot.comments.filter(
    (comment) => comment.task_id === task.id,
  ).length;
  return (
    <Modal title="Comments" subtitle={task.title} onClose={onClose} busy={busy}>
      <div className="comments-panel-heading">
        <MessageSquare size={17} />
        <strong>
          {count} {count === 1 ? "comment" : "comments"}
        </strong>
      </div>
      <TaskDiscussion
        taskId={task.id}
        snapshot={snapshot}
        busy={busy}
        runAction={runAction}
        commentsOnly
        autofocus
      />
      <div className="modal-footer">
        <button
          type="button"
          className="button button-primary footer-actions"
          onClick={onClose}
          disabled={busy}
        >
          Done
          <Check size={14} />
        </button>
      </div>
    </Modal>
  );
}
