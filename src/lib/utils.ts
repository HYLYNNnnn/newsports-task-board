import {
  COLUMNS,
  type Priority,
  type Status,
  type Task,
  type TaskInput,
  type Member,
  type WorkspaceLabel,
} from "../types";

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function dateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDate(date);
}
export function dueInfo(task: Pick<Task, "due_date" | "status">) {
  if (!task.due_date) return null;
  const today = localDate();
  const days = Math.round(
    (Date.parse(`${task.due_date}T00:00:00Z`) -
      Date.parse(`${today}T00:00:00Z`)) /
      86400000,
  );
  const active = task.status !== "done";
  const overdue = active && days < 0;
  const soon = active && days >= 0 && days <= 3;
  const date = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(task.due_date + "T12:00:00"));
  const label =
    days === 0
      ? "Today"
      : soon && days === 1
        ? "Tomorrow"
        : soon
          ? `In ${days} days`
          : date;
  const hint = overdue
    ? `Overdue · ${date}`
    : days === 0 && active
      ? "Due today"
      : soon && days === 1
        ? "Due tomorrow"
        : soon
          ? `Due in ${days} days`
          : `Due ${date}`;
  return { label, overdue, soon, days, hint };
}
export function labelStyle(
  name: string,
  labels: WorkspaceLabel[],
  selected = true,
) {
  const stored =
    labels.find((label) => label.name === name)?.color || "#2864dc";
  // Refresh the original sample palette without rewriting anyone's saved data.
  const sampleColors: Record<string, [string, string]> = {
    Design: ["#9c71a4", "#a632bc"],
    Engineering: ["#718bb4", "#2864dc"],
    Research: ["#a19060", "#9a570d"],
    Marketing: ["#789981", "#087f61"],
    Bug: ["#b77e7e", "#d33251"],
  };
  const preset = sampleColors[name];
  const color = preset?.[0] === stored.toLowerCase() ? preset[1] : stored;
  const rgb = [1, 3, 5].map((index) =>
    parseInt(color.slice(index, index + 2), 16),
  );
  const linear = rgb.map((value) => {
    const channel = value / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance =
    linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  const darkColor =
    luminance > 0.18
      ? `rgb(${rgb.map((value) => Math.round(value * 0.58)).join(", ")})`
      : color;
  return selected
    ? {
        color: luminance > 0.183 ? "#000000" : "#ffffff",
        backgroundColor: color,
        borderColor: color,
      }
    : {
        color: darkColor,
        backgroundColor: `${color}12`,
        borderColor: `${color}66`,
      };
}
export function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
export function taskChanges(
  previous: Task,
  next: TaskInput,
  members: Member[],
) {
  const messages: string[] = [];
  if (previous.title !== next.title)
    messages.push(`Renamed task from “${previous.title}” to “${next.title}”`);
  if (previous.description !== next.description)
    messages.push("Updated the description");
  if (previous.status !== next.status)
    messages.push(
      `Moved from ${statusTitle(previous.status)} → ${statusTitle(next.status)}`,
    );
  if (previous.priority !== next.priority)
    messages.push(
      `Changed priority from ${priorityTitle(previous.priority)} → ${priorityTitle(next.priority)}`,
    );
  if (previous.due_date !== next.due_date) {
    messages.push(
      next.due_date
        ? `Set due date to ${next.due_date}`
        : "Cleared the due date",
    );
  }
  if (previous.assignee_id !== next.assignee_id) {
    const memberName = (id: string | null) =>
      members.find((member) => member.id === id)?.name || "Unassigned";
    messages.push(
      next.assignee_id
        ? previous.assignee_id
          ? `Reassigned from ${memberName(previous.assignee_id)} → ${memberName(next.assignee_id)}`
          : `Assigned to ${memberName(next.assignee_id)}`
        : `Unassigned ${memberName(previous.assignee_id)}`,
    );
  }
  for (const label of next.labels)
    if (!previous.labels.includes(label))
      messages.push(`Added label “${label}”`);
  for (const label of previous.labels)
    if (!next.labels.includes(label)) messages.push(`Removed label “${label}”`);
  return messages;
}
export function statusTitle(status: Status) {
  return COLUMNS.find((column) => column.id === status)!.title;
}
export function priorityTitle(priority: Priority) {
  return priority === "normal"
    ? "Medium"
    : priority === "high"
      ? "High"
      : "Low";
}
export function readableError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String(error.message)
        : "Something went wrong. Please try again.";
  if (/anonymous.*disabled/i.test(message))
    return "Enable anonymous sign-ins in Supabase → Authentication → Sign In / Providers.";
  if (/schema cache|does not exist|relation .* not found/i.test(message))
    return "Database setup is missing. Run supabase/schema.sql in the Supabase SQL editor, then retry.";
  if (/Failed to fetch|NetworkError/i.test(message))
    return "Could not reach Supabase. Check your internet connection and project URL, then retry.";
  if (/quota|storage|SecurityError/i.test(message))
    return "Browser storage is unavailable or full. Allow site storage or free some space, then retry.";
  return message;
}
export function relativeTime(value: string) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60000),
  );
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
