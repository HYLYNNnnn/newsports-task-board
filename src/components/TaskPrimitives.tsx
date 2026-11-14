import { CheckCircle2, Circle, CircleDashed, Clock3 } from "lucide-react";
import type { Member, Status } from "../types";
import { initials } from "../lib/utils";

export function StatusIcon({
  status,
  size = 16,
}: {
  status: Status;
  size?: number;
}) {
  const Icon =
    status === "done"
      ? CheckCircle2
      : status === "in_progress"
        ? Clock3
        : status === "in_review"
          ? CircleDashed
          : Circle;
  return <Icon className={`status-icon status-${status}`} size={size} />;
}
export function Avatar({
  member,
  size = "",
}: {
  member?: Pick<Member, "name" | "color">;
  size?: string;
}) {
  return (
    <span
      className={`avatar ${size}`}
      style={{ background: member?.color || "#edf0f5" }}
      title={member?.name || "Unassigned"}
    >
      {member ? initials(member.name) : "–"}
    </span>
  );
}
