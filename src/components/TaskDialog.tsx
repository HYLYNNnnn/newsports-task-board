import { useState, type FormEvent } from "react";
import { ArrowUpRight, Check, Plus, Trash2 } from "lucide-react";
import {
  COLUMNS,
  type BoardRepository,
  type Snapshot,
  type Status,
  type Task,
  type TaskInput,
} from "../types";
import { dueInfo, labelStyle } from "../lib/utils";
import { TaskDiscussion } from "./TaskDiscussion";
import { Modal } from "./Modal";
import { LabelCreator } from "./Labels";

export type RunAction = (
  operation: (repository: BoardRepository) => Promise<void>,
  message: string,
) => Promise<boolean>;
export function TaskDialog({
  task,
  initialStatus,
  snapshot,
  busy,
  runAction,
  onClose,
}: {
  task?: Task;
  initialStatus: Status;
  snapshot: Snapshot;
  busy: boolean;
  runAction: RunAction;
  onClose: () => void;
}) {
  const [input, setInput] = useState<TaskInput>({
    title: task?.title || "",
    description: task?.description || "",
    status: task?.status || initialStatus,
    priority: task?.priority || "normal",
    due_date: task?.due_date || null,
    assignee_id: task?.assignee_id || null,
    labels: task?.labels || [],
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showLabelCreator, setShowLabelCreator] = useState(false);
  function field<K extends keyof TaskInput>(key: K, value: TaskInput[K]) {
    setInput((input) => ({ ...input, [key]: value }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !input.title.trim()) return;
    const clean = {
      ...input,
      title: input.title.trim(),
      description: input.description.trim(),
    };
    if (
      await runAction(
        (repository) =>
          task
            ? repository.updateTask(task.id, clean)
            : repository.createTask(clean),
        task
          ? "Task updated. Looking good!"
          : "Task created. Let’s make it happen.",
      )
    )
      onClose();
  }
  const due = dueInfo(input);
  return (
    <Modal
      title={task ? "Edit task" : "A new thing to make happen."}
      subtitle={
        task
          ? "Every detail moves the work forward."
          : "Start with an idea. We’ll keep the details organized."
      }
      onClose={onClose}
      wide
      busy={busy}
    >
      <form onSubmit={submit} id="task-form" className="task-form">
        <label className="field">
          Task title <span>*</span>
          <input
            data-autofocus
            name="title"
            value={input.title}
            onChange={(event) => field("title", event.target.value)}
            placeholder="What are we working on?"
            required
            maxLength={160}
            disabled={busy}
          />
        </label>
        <label className="field">
          Description
          <textarea
            name="description"
            value={input.description}
            onChange={(event) => field("description", event.target.value)}
            placeholder="A little context goes a long way…"
            rows={3}
            maxLength={5000}
            disabled={busy}
          />
        </label>
        <div className="field-grid">
          <label className="field">
            Status
            <select
              value={input.status}
              onChange={(event) =>
                field("status", event.target.value as Status)
              }
              disabled={busy}
            >
              {COLUMNS.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Priority
            <select
              value={input.priority}
              onChange={(event) =>
                field("priority", event.target.value as TaskInput["priority"])
              }
              disabled={busy}
            >
              <option value="low">Low</option>
              <option value="normal">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="field">
            Due date
            <input
              type="date"
              aria-label="Due date"
              aria-describedby={
                due && (due.overdue || due.soon) ? "task-due-hint" : undefined
              }
              value={input.due_date || ""}
              min="1900-01-01"
              max="9999-12-31"
              onInput={(event) =>
                field("due_date", event.currentTarget.value || null)
              }
              onChange={(event) =>
                field("due_date", event.target.value || null)
              }
              disabled={busy}
            />
            {due && (due.overdue || due.soon) && (
              <small
                id="task-due-hint"
                className={`date-hint ${due.overdue ? "overdue" : "due-soon"}`}
              >
                {due.hint}
              </small>
            )}
          </label>
          <label className="field">
            Assignee
            <select
              value={input.assignee_id || ""}
              onChange={(event) =>
                field("assignee_id", event.target.value || null)
              }
              disabled={busy}
            >
              <option value="">Unassigned</option>
              {snapshot.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="field">
          <span>
            Labels{" "}
            <small className="label-count">{input.labels.length}/20</small>
          </span>
          <div className="label-picker">
            {snapshot.labels.map((label) => (
              <button
                type="button"
                key={label.id}
                className={`tag ${input.labels.includes(label.name) ? "label-selected" : ""}`}
                style={labelStyle(
                  label.name,
                  snapshot.labels,
                  input.labels.includes(label.name),
                )}
                onClick={() =>
                  field(
                    "labels",
                    input.labels.includes(label.name)
                      ? input.labels.filter((item) => item !== label.name)
                      : [...input.labels, label.name],
                  )
                }
                aria-pressed={input.labels.includes(label.name)}
                disabled={
                  busy ||
                  (!input.labels.includes(label.name) &&
                    input.labels.length >= 20)
                }
              >
                {input.labels.includes(label.name) && <Check size={11} />}
                {label.name}
              </button>
            ))}
            <button
              type="button"
              className="new-label-button"
              aria-expanded={showLabelCreator}
              onClick={() => setShowLabelCreator(!showLabelCreator)}
              disabled={busy}
            >
              <Plus size={12} />
              New label
            </button>
          </div>
        </div>
        {showLabelCreator && (
          <LabelCreator
            labels={snapshot.labels}
            busy={busy}
            runAction={runAction}
            onCreated={(name) => {
              setInput((current) => ({
                ...current,
                labels:
                  current.labels.length < 20
                    ? [...current.labels, name]
                    : current.labels,
              }));
              setShowLabelCreator(false);
            }}
          />
        )}
      </form>
      {task && (
        <TaskDiscussion
          taskId={task.id}
          snapshot={snapshot}
          busy={busy}
          runAction={runAction}
        />
      )}
      <div className="modal-footer">
        {task && !confirmDelete && (
          <button
            className="button button-danger-text"
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
          >
            <Trash2 size={15} />
            Delete task
          </button>
        )}
        {confirmDelete ? (
          <div className="delete-confirm" key="delete-confirm">
            <span>Delete this task and its comments?</span>
            <button
              type="button"
              className="button button-quiet"
              onClick={() => setConfirmDelete(false)}
              disabled={busy}
            >
              Keep task
            </button>
            <button
              type="button"
              className="button button-danger"
              disabled={busy}
              onClick={async () => {
                if (
                  task &&
                  (await runAction(
                    (repository) => repository.deleteTask(task.id),
                    "Task deleted.",
                  ))
                )
                  onClose();
              }}
            >
              Delete
            </button>
          </div>
        ) : (
          <div className="footer-actions" key="task-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              className="button button-primary"
              type="submit"
              form="task-form"
              disabled={busy || !input.title.trim()}
            >
              {busy ? "Saving…" : task ? "Save changes" : "Create task"}
              <ArrowUpRight size={15} />
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
