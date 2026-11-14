import { useEffect, useState, type CSSProperties } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  defaultDropAnimationSideEffects,
  useDndContext,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  ArrowUp,
  CalendarDays,
  Check,
  Clock3,
  MessageSquare,
  Pencil,
  GripVertical,
  Plus,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import {
  COLUMNS,
  type Comment,
  type Member,
  type Status,
  type Task,
  type WorkspaceLabel,
  type Snapshot,
} from "../types";
import { dueInfo, priorityTitle } from "../lib/utils";
import { LabelBadge } from "./Labels";
import { Avatar, StatusIcon } from "./TaskPrimitives";
import { TaskDetails } from "./TaskDetails";
import { useTaskClick } from "../lib/useTaskClick";
import type { RunAction } from "./TaskDialog";
export { Avatar, StatusIcon } from "./TaskPrimitives";

export function TaskContent({
  task,
  members,
  comments,
  labels,
  interactive = false,
}: {
  task: Task;
  members: Member[];
  comments: Comment[];
  labels: WorkspaceLabel[];
  interactive?: boolean;
}) {
  const due = dueInfo(task);
  const member = members.find((member) => member.id === task.assignee_id);
  const commentCount = comments.filter(
    (comment) => comment.task_id === task.id,
  ).length;
  return (
    <>
      <div className="card-top">
        <div className="label-group">
          {task.labels.length ? (
            task.labels.map((label) => (
              <LabelBadge key={label} name={label} labels={labels} />
            ))
          ) : (
            <span className="task-label-placeholder">Task</span>
          )}
        </div>
        <GripVertical
          size={17}
          className={`card-grip ${interactive ? "card-grip-placeholder" : ""}`}
          aria-hidden="true"
        />
      </div>
      <h3 className={task.status === "done" ? "completed-title" : ""}>
        {task.title}
      </h3>
      {task.description && (
        <p className="card-description">{task.description}</p>
      )}
      <div className="card-footer">
        <div className="card-metadata">
          <span
            className={`priority priority-${task.priority}`}
            title={`${priorityTitle(task.priority)} priority`}
          >
            {task.priority === "high" ? (
              <ArrowUp size={13} strokeWidth={2.5} />
            ) : (
              <span className="priority-bars">
                <i />
                <i />
                <i />
              </span>
            )}
            {priorityTitle(task.priority)}
          </span>
          {due && (
            <span
              className={`due ${due.overdue ? "overdue" : due.soon ? "due-soon" : ""}`}
              title={`${due.hint} · ${task.due_date}`}
              aria-label={due.hint}
            >
              {due.overdue ? (
                <TriangleAlert size={12} />
              ) : due.soon ? (
                <Clock3 size={12} />
              ) : (
                <CalendarDays size={12} />
              )}
              {due.label}
            </span>
          )}
        </div>
        <div className="card-people">
          {commentCount > 0 && (
            <span
              className={`comment-count ${interactive ? "card-comment-placeholder" : ""}`}
              aria-hidden={interactive || undefined}
            >
              <MessageSquare size={12} />
              {commentCount}
            </span>
          )}
          <Avatar member={member} size="avatar-small" />
        </div>
      </div>
    </>
  );
}
function TaskCard({
  task,
  snapshot,
  onEdit,
  onComments,
  onToggle,
  expanded,
  disabled,
  justDropped,
  runAction,
}: {
  task: Task;
  snapshot: Snapshot;
  onEdit: (task: Task) => void;
  onComments: (task: Task) => void;
  onToggle: (task: Task) => void;
  expanded: boolean;
  disabled: boolean;
  justDropped: boolean;
  runAction: RunAction;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } =
    useDraggable({ id: task.id, data: { task }, disabled });
  const clicks = useTaskClick(
    () => {
      if (!isDragging && !disabled) onToggle(task);
    },
    () => {
      if (!isDragging && !disabled) onEdit(task);
    },
  );
  useEffect(() => {
    if (isDragging) clicks.cancel();
  }, [isDragging]);
  const commentCount = snapshot.comments.filter(
    (comment) => comment.task_id === task.id,
  ).length;
  return (
    <article
      ref={setNodeRef}
      className={`task-card task-priority-${task.priority} ${isDragging ? "is-dragging" : ""} ${justDropped ? "card-just-dropped" : ""} ${expanded ? "card-expanded" : ""}`}
      data-testid="task-card"
      data-task-id={task.id}
    >
      <div className="task-summary-wrap">
        <div
          className="task-summary"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Open task: ${task.title}`}
          aria-expanded={expanded}
          aria-controls={expanded ? `task-details-${task.id}` : undefined}
          title="Click to expand · Double-click to edit · Drag to move"
          onClick={clicks.onClick}
          onDoubleClick={clicks.onDoubleClick}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !isDragging) {
              event.preventDefault();
              clicks.cancel();
              if (!disabled) onToggle(task);
              return;
            }
            listeners?.onKeyDown?.(event);
          }}
        >
          <TaskContent
            task={task}
            members={snapshot.members}
            comments={snapshot.comments}
            labels={snapshot.labels}
            interactive
          />
        </div>
        <button
          type="button"
          className="card-edit-button"
          aria-label={`Edit task: ${task.title}`}
          title="Edit task"
          disabled={disabled}
          onClick={() => {
            clicks.cancel();
            onEdit(task);
          }}
        >
          <Pencil size={15} />
        </button>
        {commentCount > 0 && (
          <button
            type="button"
            className="card-comment-button"
            aria-label={`Open comments: ${task.title}`}
            title={`${commentCount} ${commentCount === 1 ? "comment" : "comments"}`}
            disabled={disabled}
            onClick={() => {
              clicks.cancel();
              onComments(task);
            }}
          >
            <MessageSquare size={13} />
            <span>{commentCount}</span>
          </button>
        )}
      </div>
      {expanded && (
        <section
          className="task-expanded-panel"
          id={`task-details-${task.id}`}
          role="region"
          aria-label={`Details: ${task.title}`}
        >
          <TaskDetails
            task={task}
            snapshot={snapshot}
            busy={disabled}
            runAction={runAction}
          />
          <button
            type="button"
            className="collapse-task-button"
            onClick={() => onToggle(task)}
            disabled={disabled}
          >
            Collapse details
          </button>
        </section>
      )}
    </article>
  );
}
function Column({
  status,
  tasks,
  snapshot,
  onEdit,
  onComments,
  onToggle,
  expandedId,
  runAction,
  onAdd,
  disabled,
  landed,
}: {
  status: Status;
  tasks: Task[];
  snapshot: Snapshot;
  onEdit: (task: Task) => void;
  onComments: (task: Task) => void;
  onToggle: (task: Task) => void;
  expandedId: string | null;
  runAction: RunAction;
  onAdd: (status: Status) => void;
  disabled: boolean;
  landed: { id: string; status: Status } | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled });
  const column = COLUMNS.find((column) => column.id === status)!;
  const { active } = useDndContext();
  const draggingTask = active?.data.current?.task as Task | undefined;
  const isTarget = isOver && draggingTask?.status !== status;
  return (
    <section
      ref={setNodeRef}
      className={`board-column column-${status} ${draggingTask && draggingTask.status !== status ? "column-can-drop" : ""} ${isTarget ? "column-over" : ""} ${landed?.status === status ? "column-landed" : ""}`}
      data-testid={`column-${status}`}
      aria-label={`${column.title} column`}
    >
      <div className="column-heading">
        <div className="column-title">
          <StatusIcon status={status} />
          <h2>{column.title}</h2>
          <span className="column-count">{tasks.length}</span>
        </div>
        <button
          className="icon-button"
          onClick={() => onAdd(status)}
          disabled={disabled}
          aria-label={`Add task to ${column.title}`}
        >
          <Plus size={17} />
        </button>
      </div>
      <p className="column-subtitle">{column.subtitle}</p>
      <div className="column-cards">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            snapshot={snapshot}
            onEdit={onEdit}
            onComments={onComments}
            onToggle={onToggle}
            expanded={expandedId === task.id}
            runAction={runAction}
            disabled={disabled}
            justDropped={landed?.id === task.id && landed.status === status}
          />
        ))}
        {!tasks.length && (
          <div className="column-empty">
            <span>
              <StatusIcon status={status} size={22} />
            </span>
            <p>
              {status === "done"
                ? "Good work ends up here"
                : "A little room for what’s next"}
            </p>
            <small>
              {status === "done"
                ? "Move a finished task here to celebrate."
                : "Drop a task here or add a new one."}
            </small>
          </div>
        )}
      </div>
      {draggingTask && draggingTask.status !== status && (
        <div
          className={`column-drop-hint ${isTarget ? "drop-hint-active" : ""}`}
          aria-hidden="true"
        >
          <Plus size={17} />
          <span>
            {isTarget ? "Release to move here" : `Move to ${column.title}`}
          </span>
        </div>
      )}
      {landed?.status === status && (
        <span className="drop-success" aria-hidden="true">
          <Check size={14} />
          Moved
        </span>
      )}
      <button
        className="add-column-task"
        onClick={() => onAdd(status)}
        disabled={disabled}
      >
        <Plus size={15} />
        Add task
      </button>
    </section>
  );
}
export function Board({
  tasks,
  snapshot,
  onEdit,
  onComments,
  onAdd,
  onMove,
  disabled,
  runAction,
}: {
  tasks: Task[];
  snapshot: Snapshot;
  onEdit: (task: Task) => void;
  onComments: (task: Task) => void;
  onAdd: (status: Status) => void;
  onMove: (task: Task, status: Status) => void;
  disabled: boolean;
  runAction: RunAction;
}) {
  const { members, comments, labels } = snapshot;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toggle = (task: Task) =>
    setExpandedId((current) => (current === task.id ? null : task.id));
  const [active, setActive] = useState<Task | null>(null);
  const [tilt, setTilt] = useState(2);
  const [landed, setLanded] = useState<{ id: string; status: Status } | null>(
    null,
  );
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!landed) return;
    const timeout = window.setTimeout(() => setLanded(null), 1000);
    return () => window.clearTimeout(timeout);
  }, [landed]);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 7 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
    useSensor(KeyboardSensor),
  );
  function end(event: DragEndEvent) {
    setActive(null);
    if (!event.over) return;
    const task = tasks.find((task) => task.id === event.active.id);
    const status = event.over.id as Status;
    if (
      task &&
      task.status !== status &&
      COLUMNS.some((column) => column.id === status)
    ) {
      setLanded({ id: task.id, status });
      onMove(task, status);
    }
  }
  return (
    <DndContext
      sensors={sensors}
      onDragStart={(event) => {
        setLanded(null);
        setTilt(2);
        setActive(tasks.find((task) => task.id === event.active.id) ?? null);
      }}
      onDragMove={(event) => {
        if (Math.abs(event.delta.x) > 12) setTilt(event.delta.x < 0 ? -2 : 2);
      }}
      onDragEnd={end}
      onDragCancel={() => setActive(null)}
    >
      <div
        className={`board ${active ? "board-dragging" : ""} ${expandedId && tasks.some((task) => task.id === expandedId) ? "board-details-open" : ""}`}
        aria-label="Task board"
      >
        {COLUMNS.map((column) => (
          <Column
            key={column.id}
            status={column.id}
            tasks={tasks.filter((task) => task.status === column.id)}
            snapshot={snapshot}
            onEdit={onEdit}
            onComments={onComments}
            onToggle={toggle}
            expandedId={expandedId}
            runAction={runAction}
            onAdd={onAdd}
            disabled={disabled}
            landed={landed}
          />
        ))}
      </div>
      <DragOverlay
        dropAnimation={
          reducedMotion
            ? null
            : {
                duration: 380,
                easing: "cubic-bezier(0.16, 1, 0.3, 1)",
                sideEffects: (args) => {
                  const cleanup = defaultDropAnimationSideEffects({
                    styles: { active: { opacity: "0" } },
                  })(args);
                  const preview =
                    args.dragOverlay.node.querySelector<HTMLElement>(
                      ".drag-overlay",
                    );
                  const rotation = preview?.animate(
                    [
                      { transform: getComputedStyle(preview).transform },
                      { transform: "rotate(0deg) scale(1)" },
                    ],
                    {
                      duration: 380,
                      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
                      fill: "forwards",
                    },
                  );
                  return () => {
                    rotation?.cancel();
                    cleanup?.();
                  };
                },
              }
        }
      >
        {active ? (
          <div
            className={`task-card drag-overlay task-priority-${active.priority}`}
            style={{ "--drag-tilt": `${tilt}deg` } as CSSProperties}
            data-testid="drag-preview"
          >
            <TaskContent
              task={active}
              members={members}
              comments={comments}
              labels={labels}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
function TaskListRow({
  task,
  members,
  onOpen,
  onEdit,
  disabled,
}: {
  task: Task;
  members: Member[];
  onOpen: (task: Task) => void;
  onEdit: (task: Task) => void;
  disabled: boolean;
}) {
  const clicks = useTaskClick(
    () => onOpen(task),
    () => onEdit(task),
  );
  return (
    <div className="list-row">
      <button
        type="button"
        className="list-row-main"
        aria-label={`Open task: ${task.title}`}
        disabled={disabled}
        onClick={clicks.onClick}
        onDoubleClick={clicks.onDoubleClick}
      >
        <span className="list-task-title">
          <StatusIcon status={task.status} />
          <strong>{task.title}</strong>
        </span>
        <span className={`list-status status-${task.status}`}>
          {COLUMNS.find((column) => column.id === task.status)?.title}
        </span>
        <span className={`priority priority-${task.priority}`}>
          {priorityTitle(task.priority)}
        </span>
        <span
          className={
            dueInfo(task)?.overdue
              ? "overdue"
              : dueInfo(task)?.soon
                ? "due-soon"
                : ""
          }
          title={dueInfo(task)?.hint}
        >
          {dueInfo(task)?.label || "No date"}
        </span>
        <span>
          <Avatar
            member={members.find((member) => member.id === task.assignee_id)}
            size="avatar-small"
          />
        </span>
      </button>
      <button
        type="button"
        className="list-row-edit"
        aria-label={`Edit task: ${task.title}`}
        title="Edit task"
        disabled={disabled}
        onClick={() => {
          clicks.cancel();
          onEdit(task);
        }}
      >
        <Pencil size={15} />
      </button>
    </div>
  );
}
export function TaskList({
  tasks,
  members,
  onOpen,
  onEdit,
  disabled,
}: {
  tasks: Task[];
  members: Member[];
  onOpen: (task: Task) => void;
  onEdit: (task: Task) => void;
  disabled: boolean;
}) {
  return (
    <div className="task-list">
      <div className="list-head">
        <span>Task name</span>
        <span>Status</span>
        <span>Priority</span>
        <span>Due date</span>
        <span>Assignee</span>
      </div>
      {tasks.length ? (
        tasks.map((task) => (
          <TaskListRow
            key={task.id}
            task={task}
            members={members}
            onOpen={onOpen}
            onEdit={onEdit}
            disabled={disabled}
          />
        ))
      ) : (
        <div className="list-empty">
          <Sparkles size={25} />
          <h3>No tasks found</h3>
          <p>Try another search or clear your filters.</p>
        </div>
      )}
    </div>
  );
}
export function CompletionMark() {
  return (
    <span className="completion-mark">
      <Check size={13} />
    </span>
  );
}
